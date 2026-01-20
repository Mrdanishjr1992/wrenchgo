-- =====================================================
-- PHASE 4: Admin Console, Audit Logging, Metrics, Hub Health
-- =====================================================

-- =====================================================
-- A) AUDIT LOG TABLE (Immutable)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'admin' CHECK (actor_type IN ('admin', 'system', 'user')),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  is_immutable boolean DEFAULT true NOT NULL,
  supersedes uuid REFERENCES public.audit_log(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);

COMMENT ON TABLE public.audit_log IS 'Immutable audit trail for admin and system actions';

-- RLS: Admins can select only; no direct inserts/updates/deletes
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies - only via SECURITY DEFINER RPC

-- =====================================================
-- B) AUDIT LOG INSERT RPC (SECURITY DEFINER)
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_audit_log(
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor_type text;
BEGIN
  -- Determine actor type
  IF public.is_admin() THEN
    v_actor_type := 'admin';
  ELSE
    v_actor_type := 'system';
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_type, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), v_actor_type, p_action, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- System audit log (for triggers/background jobs)
CREATE OR REPLACE FUNCTION public.system_audit_log(
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_log (actor_id, actor_type, action, entity_type, entity_id, metadata)
  VALUES (NULL, 'system', p_action, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_audit_log(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.system_audit_log(text, text, uuid, jsonb) TO service_role;

-- =====================================================
-- C) UPDATE EXISTING ADMIN RPCs TO WRITE AUDIT LOG
-- =====================================================

-- C.1) Update admin_resolve_dispute to write audit_log
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_status text,
  p_resolution_type text DEFAULT NULL,
  p_resolution_notes text DEFAULT NULL,
  p_customer_refund_cents int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute disputes;
  v_job_id uuid;
  v_contract_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id;
  IF v_dispute IS NULL THEN
    RETURN jsonb_build_object('error', 'Dispute not found');
  END IF;

  v_job_id := v_dispute.job_id;
  v_contract_id := v_dispute.contract_id;

  UPDATE public.disputes
  SET 
    status = p_status::dispute_status,
    resolution_type = COALESCE(p_resolution_type, resolution_type),
    resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
    customer_refund_cents = COALESCE(p_customer_refund_cents, customer_refund_cents),
    resolved_at = CASE WHEN p_status IN ('resolved_customer', 'resolved_mechanic', 'resolved_split', 'dismissed') THEN now() ELSE resolved_at END,
    resolved_by = auth.uid(),
    updated_at = now()
  WHERE id = p_dispute_id;

  -- Log job event
  INSERT INTO public.job_events (job_id, contract_id, event_type, actor_id, actor_role, metadata)
  VALUES (
    v_job_id,
    v_contract_id,
    'dispute_resolved'::job_event_type,
    auth.uid(),
    'admin'::user_role,
    jsonb_build_object(
      'dispute_id', p_dispute_id,
      'resolution_status', p_status,
      'resolution_type', p_resolution_type,
      'refund_cents', p_customer_refund_cents
    )
  );

  -- Write to audit_log
  PERFORM public.admin_audit_log(
    'ADMIN_RESOLVE_DISPUTE',
    'disputes',
    p_dispute_id,
    jsonb_build_object(
      'old_status', v_dispute.status,
      'new_status', p_status,
      'resolution_type', p_resolution_type,
      'resolution_notes', p_resolution_notes,
      'refund_cents', p_customer_refund_cents,
      'job_id', v_job_id
    )
  );

  RETURN jsonb_build_object('success', true, 'dispute_id', p_dispute_id);
END;
$$;

-- C.2) Update set_mechanic_verification_status to write audit_log
CREATE OR REPLACE FUNCTION public.set_mechanic_verification_status(
  p_mechanic_id uuid,
  p_status text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT verification_status INTO v_old_status
  FROM public.mechanic_profiles
  WHERE id = p_mechanic_id;

  IF v_old_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Mechanic not found');
  END IF;

  UPDATE public.mechanic_profiles
  SET 
    verification_status = p_status,
    rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
    verified_at = CASE WHEN p_status = 'approved' THEN now() ELSE verified_at END,
    updated_at = now()
  WHERE id = p_mechanic_id;

  -- Write to audit_log
  PERFORM public.admin_audit_log(
    'ADMIN_SET_VERIFICATION_STATUS',
    'mechanic_profiles',
    p_mechanic_id,
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_status,
      'rejection_reason', p_rejection_reason
    )
  );

  -- Notify mechanic
  PERFORM public.notify_user(
    p_mechanic_id,
    CASE 
      WHEN p_status = 'approved' THEN 'verification_approved'
      WHEN p_status = 'rejected' THEN 'verification_rejected'
      ELSE 'verification_update'
    END,
    jsonb_build_object('status', p_status, 'reason', p_rejection_reason)
  );

  RETURN jsonb_build_object('success', true, 'mechanic_id', p_mechanic_id);
END;
$$;

-- C.3) Update set_mechanic_tier to write audit_log
CREATE OR REPLACE FUNCTION public.set_mechanic_tier(
  p_mechanic_id uuid,
  p_tier text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_tier text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT tier INTO v_old_tier
  FROM public.mechanic_profiles
  WHERE id = p_mechanic_id;

  IF v_old_tier IS NULL THEN
    RETURN jsonb_build_object('error', 'Mechanic not found');
  END IF;

  UPDATE public.mechanic_profiles
  SET tier = p_tier, updated_at = now()
  WHERE id = p_mechanic_id;

  -- Write to audit_log
  PERFORM public.admin_audit_log(
    'ADMIN_SET_MECHANIC_TIER',
    'mechanic_profiles',
    p_mechanic_id,
    jsonb_build_object('old_tier', v_old_tier, 'new_tier', p_tier)
  );

  RETURN jsonb_build_object('success', true, 'mechanic_id', p_mechanic_id);
END;
$$;

-- C.4) Update add_mechanic_strike to write audit_log
CREATE OR REPLACE FUNCTION public.add_mechanic_strike(
  p_mechanic_id uuid,
  p_reason text,
  p_details jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_strikes int;
  v_new_strikes int;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT COALESCE(strikes, 0) INTO v_old_strikes
  FROM public.mechanic_profiles
  WHERE id = p_mechanic_id;

  IF v_old_strikes IS NULL THEN
    RETURN jsonb_build_object('error', 'Mechanic not found');
  END IF;

  v_new_strikes := v_old_strikes + 1;

  UPDATE public.mechanic_profiles
  SET 
    strikes = v_new_strikes,
    updated_at = now()
  WHERE id = p_mechanic_id;

  -- Write to audit_log
  PERFORM public.admin_audit_log(
    'ADMIN_ADD_STRIKE',
    'mechanic_profiles',
    p_mechanic_id,
    jsonb_build_object(
      'old_strikes', v_old_strikes,
      'new_strikes', v_new_strikes,
      'reason', p_reason,
      'details', p_details
    )
  );

  -- Notify mechanic
  PERFORM public.notify_user(
    p_mechanic_id,
    'strike_added',
    jsonb_build_object('total_strikes', v_new_strikes, 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'new_strikes', v_new_strikes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_mechanic_verification_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_mechanic_tier(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_mechanic_strike(uuid, text, jsonb) TO authenticated;

-- =====================================================
-- D) ADMIN METRICS RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_metrics(
  p_hub_id uuid DEFAULT NULL,
  p_days int DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date date;
  v_result jsonb;
  v_daily_jobs jsonb;
  v_daily_completed jsonb;
  v_quotes_per_job numeric;
  v_acceptance_rate numeric;
  v_completion_rate numeric;
  v_dispute_rate numeric;
  v_refund_rate numeric;
  v_tickets_per_job numeric;
  v_total_jobs bigint;
  v_total_completed bigint;
  v_total_quotes bigint;
  v_total_accepted bigint;
  v_total_disputes bigint;
  v_total_refunds bigint;
  v_total_tickets bigint;
  v_decline_reasons jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  v_start_date := CURRENT_DATE - p_days;

  -- Daily jobs created
  SELECT jsonb_agg(jsonb_build_object('date', d.day, 'count', COALESCE(j.cnt, 0)) ORDER BY d.day)
  INTO v_daily_jobs
  FROM generate_series(v_start_date, CURRENT_DATE, '1 day'::interval) d(day)
  LEFT JOIN (
    SELECT DATE(created_at) as day, COUNT(*) as cnt
    FROM public.jobs
    WHERE created_at >= v_start_date
      AND (p_hub_id IS NULL OR hub_id = p_hub_id)
    GROUP BY DATE(created_at)
  ) j ON d.day = j.day;

  -- Daily jobs completed
  SELECT jsonb_agg(jsonb_build_object('date', d.day, 'count', COALESCE(j.cnt, 0)) ORDER BY d.day)
  INTO v_daily_completed
  FROM generate_series(v_start_date, CURRENT_DATE, '1 day'::interval) d(day)
  LEFT JOIN (
    SELECT DATE(completed_at) as day, COUNT(*) as cnt
    FROM public.jobs
    WHERE completed_at >= v_start_date
      AND status = 'completed'
      AND (p_hub_id IS NULL OR hub_id = p_hub_id)
    GROUP BY DATE(completed_at)
  ) j ON d.day = j.day;

  -- Totals for ratios
  SELECT COUNT(*) INTO v_total_jobs
  FROM public.jobs
  WHERE created_at >= v_start_date
    AND (p_hub_id IS NULL OR hub_id = p_hub_id);

  SELECT COUNT(*) INTO v_total_completed
  FROM public.jobs
  WHERE completed_at >= v_start_date
    AND status = 'completed'
    AND (p_hub_id IS NULL OR hub_id = p_hub_id);

  SELECT COUNT(*) INTO v_total_quotes
  FROM public.quotes q
  JOIN public.jobs j ON j.id = q.job_id
  WHERE q.created_at >= v_start_date
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id);

  SELECT COUNT(*) INTO v_total_accepted
  FROM public.job_contracts jc
  JOIN public.jobs j ON j.id = jc.job_id
  WHERE jc.created_at >= v_start_date
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id);

  SELECT COUNT(*) INTO v_total_disputes
  FROM public.disputes d
  JOIN public.jobs j ON j.id = d.job_id
  WHERE d.created_at >= v_start_date
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id);

  -- Refunds (disputes resolved with refund or payments with refunded_at)
  SELECT COUNT(*) INTO v_total_refunds
  FROM public.disputes d
  JOIN public.jobs j ON j.id = d.job_id
  WHERE d.created_at >= v_start_date
    AND d.customer_refund_cents > 0
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id);

  SELECT COUNT(*) INTO v_total_tickets
  FROM public.support_requests sr
  JOIN public.jobs j ON j.id = sr.job_id
  WHERE sr.created_at >= v_start_date
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id);

  -- Calculate rates
  v_quotes_per_job := CASE WHEN v_total_jobs > 0 THEN ROUND(v_total_quotes::numeric / v_total_jobs, 2) ELSE 0 END;
  v_acceptance_rate := CASE WHEN v_total_quotes > 0 THEN ROUND(v_total_accepted::numeric / v_total_quotes * 100, 1) ELSE 0 END;
  v_completion_rate := CASE WHEN v_total_jobs > 0 THEN ROUND(v_total_completed::numeric / v_total_jobs * 100, 1) ELSE 0 END;
  v_dispute_rate := CASE WHEN v_total_completed > 0 THEN ROUND(v_total_disputes::numeric / v_total_completed * 100, 1) ELSE 0 END;
  v_refund_rate := CASE WHEN v_total_completed > 0 THEN ROUND(v_total_refunds::numeric / v_total_completed * 100, 1) ELSE 0 END;
  v_tickets_per_job := CASE WHEN v_total_jobs > 0 THEN ROUND(v_total_tickets::numeric / v_total_jobs, 2) ELSE 0 END;

  -- Top decline reasons (from lead_decisions if exists)
  BEGIN
    SELECT jsonb_agg(jsonb_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC)
    INTO v_decline_reasons
    FROM (
      SELECT decision_reason as reason, COUNT(*) as cnt
      FROM public.lead_decisions ld
      JOIN public.jobs j ON j.id = ld.job_id
      WHERE ld.decision = 'decline'
        AND ld.created_at >= v_start_date
        AND (p_hub_id IS NULL OR j.hub_id = p_hub_id)
      GROUP BY decision_reason
      ORDER BY cnt DESC
      LIMIT 10
    ) sub;
  EXCEPTION WHEN undefined_table THEN
    v_decline_reasons := '[]'::jsonb;
  END;

  v_result := jsonb_build_object(
    'period_days', p_days,
    'hub_id', p_hub_id,
    'daily_jobs_created', COALESCE(v_daily_jobs, '[]'::jsonb),
    'daily_jobs_completed', COALESCE(v_daily_completed, '[]'::jsonb),
    'totals', jsonb_build_object(
      'jobs_created', v_total_jobs,
      'jobs_completed', v_total_completed,
      'quotes', v_total_quotes,
      'accepted', v_total_accepted,
      'disputes', v_total_disputes,
      'refunds', v_total_refunds,
      'support_tickets', v_total_tickets
    ),
    'rates', jsonb_build_object(
      'quotes_per_job', v_quotes_per_job,
      'acceptance_rate', v_acceptance_rate,
      'completion_rate', v_completion_rate,
      'dispute_rate', v_dispute_rate,
      'refund_rate', v_refund_rate,
      'tickets_per_job', v_tickets_per_job
    ),
    'decline_reasons', COALESCE(v_decline_reasons, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_metrics(uuid, int) TO authenticated;

-- =====================================================
-- E) HUB HEALTH RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_hub_health(
  p_hub_id uuid,
  p_days int DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date date;
  v_hub service_hubs;
  v_jobs_requested bigint;
  v_jobs_completed bigint;
  v_completion_rate numeric;
  v_active_mechanics bigint;
  v_disputes bigint;
  v_support_tickets bigint;
  v_avg_response_minutes numeric;
  v_health_score int;
  v_can_expand boolean;
  v_avg_jobs_per_day numeric;
  v_disputes_per_40 numeric;
  v_tickets_per_job numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT * INTO v_hub FROM public.service_hubs WHERE id = p_hub_id;
  IF v_hub IS NULL THEN
    RETURN jsonb_build_object('error', 'Hub not found');
  END IF;

  v_start_date := CURRENT_DATE - p_days;

  -- Jobs requested
  SELECT COUNT(*) INTO v_jobs_requested
  FROM public.jobs
  WHERE hub_id = p_hub_id AND created_at >= v_start_date;

  -- Jobs completed
  SELECT COUNT(*) INTO v_jobs_completed
  FROM public.jobs
  WHERE hub_id = p_hub_id AND status = 'completed' AND completed_at >= v_start_date;

  -- Completion rate
  v_completion_rate := CASE WHEN v_jobs_requested > 0 
    THEN ROUND(v_jobs_completed::numeric / v_jobs_requested * 100, 1) 
    ELSE 0 END;

  -- Active mechanics (at least 1 completed job in period)
  SELECT COUNT(DISTINCT jc.mechanic_id) INTO v_active_mechanics
  FROM public.job_contracts jc
  JOIN public.jobs j ON j.id = jc.job_id
  WHERE j.hub_id = p_hub_id 
    AND j.status = 'completed' 
    AND j.completed_at >= v_start_date;

  -- Disputes
  SELECT COUNT(*) INTO v_disputes
  FROM public.disputes d
  JOIN public.jobs j ON j.id = d.job_id
  WHERE j.hub_id = p_hub_id AND d.created_at >= v_start_date;

  -- Support tickets
  SELECT COUNT(*) INTO v_support_tickets
  FROM public.support_requests sr
  JOIN public.jobs j ON j.id = sr.job_id
  WHERE j.hub_id = p_hub_id AND sr.created_at >= v_start_date;

  -- Average response time (first quote after job created)
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (q.created_at - j.created_at)) / 60), 1)
  INTO v_avg_response_minutes
  FROM public.jobs j
  JOIN LATERAL (
    SELECT created_at FROM public.quotes WHERE job_id = j.id ORDER BY created_at LIMIT 1
  ) q ON true
  WHERE j.hub_id = p_hub_id AND j.created_at >= v_start_date;

  -- Calculate health score (0-100)
  v_avg_jobs_per_day := v_jobs_completed::numeric / GREATEST(p_days, 1);
  v_disputes_per_40 := CASE WHEN v_jobs_completed >= 40 
    THEN v_disputes::numeric / (v_jobs_completed / 40.0) 
    ELSE v_disputes END;
  v_tickets_per_job := CASE WHEN v_jobs_requested > 0 
    THEN v_support_tickets::numeric / v_jobs_requested 
    ELSE 0 END;

  -- Health score formula:
  -- Base 50 + completion_rate_bonus (up to 25) + response_time_bonus (up to 15) + low_disputes_bonus (up to 10)
  v_health_score := 50;
  
  -- Completion rate bonus
  IF v_completion_rate >= 95 THEN v_health_score := v_health_score + 25;
  ELSIF v_completion_rate >= 90 THEN v_health_score := v_health_score + 20;
  ELSIF v_completion_rate >= 80 THEN v_health_score := v_health_score + 15;
  ELSIF v_completion_rate >= 70 THEN v_health_score := v_health_score + 10;
  END IF;

  -- Response time bonus (if under 10 min avg)
  IF v_avg_response_minutes IS NOT NULL THEN
    IF v_avg_response_minutes <= 5 THEN v_health_score := v_health_score + 15;
    ELSIF v_avg_response_minutes <= 10 THEN v_health_score := v_health_score + 10;
    ELSIF v_avg_response_minutes <= 20 THEN v_health_score := v_health_score + 5;
    END IF;
  END IF;

  -- Low disputes bonus
  IF v_disputes_per_40 <= 1 THEN v_health_score := v_health_score + 10;
  ELSIF v_disputes_per_40 <= 2 THEN v_health_score := v_health_score + 5;
  END IF;

  v_health_score := LEAST(v_health_score, 100);

  -- Can expand criteria:
  -- - avg 8+ completed jobs/day
  -- - completion_rate >= 95%
  -- - avg response <= 10 min (if measured)
  -- - disputes <= 1 per 40 completed
  -- - tickets_per_job <= 0.15
  v_can_expand := (
    v_avg_jobs_per_day >= 8 AND
    v_completion_rate >= 95 AND
    (v_avg_response_minutes IS NULL OR v_avg_response_minutes <= 10) AND
    v_disputes_per_40 <= 1 AND
    v_tickets_per_job <= 0.15
  );

  RETURN jsonb_build_object(
    'hub_id', p_hub_id,
    'hub_name', v_hub.name,
    'period_days', p_days,
    'jobs_requested', v_jobs_requested,
    'jobs_completed', v_jobs_completed,
    'completion_rate', v_completion_rate,
    'active_mechanics', v_active_mechanics,
    'disputes', v_disputes,
    'support_tickets', v_support_tickets,
    'avg_response_minutes', v_avg_response_minutes,
    'avg_jobs_per_day', ROUND(v_avg_jobs_per_day, 1),
    'disputes_per_40_completed', ROUND(v_disputes_per_40, 2),
    'tickets_per_job', ROUND(v_tickets_per_job, 2),
    'health_score', v_health_score,
    'can_expand', v_can_expand,
    'hub_config', jsonb_build_object(
      'active_radius_miles', v_hub.active_radius_miles,
      'invite_only', v_hub.invite_only,
      'auto_expand_enabled', v_hub.auto_expand_enabled
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_hub_health(uuid, int) TO authenticated;

-- =====================================================
-- F) ADMIN GET ALL HUBS
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_hubs()
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  state text,
  latitude numeric,
  longitude numeric,
  active_radius_miles int,
  max_radius_miles int,
  invite_only boolean,
  auto_expand_enabled boolean,
  created_at timestamptz,
  active_mechanics bigint,
  jobs_last_14d bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    h.id,
    h.name,
    h.city,
    h.state,
    h.latitude,
    h.longitude,
    h.active_radius_miles,
    h.max_radius_miles,
    h.invite_only,
    h.auto_expand_enabled,
    h.created_at,
    (SELECT COUNT(DISTINCT mp.id) 
     FROM public.mechanic_profiles mp 
     WHERE mp.hub_id = h.id AND mp.verification_status = 'approved') as active_mechanics,
    (SELECT COUNT(*) 
     FROM public.jobs j 
     WHERE j.hub_id = h.id AND j.created_at >= CURRENT_DATE - 14) as jobs_last_14d
  FROM public.service_hubs h
  ORDER BY h.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_hubs() TO authenticated;

-- =====================================================
-- G) WAITLIST HEATMAP RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_waitlist_heatmap(
  p_hub_id uuid DEFAULT NULL,
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date timestamptz;
  v_by_zip jsonb;
  v_by_hub jsonb;
  v_by_user_type jsonb;
  v_total bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  v_start_date := now() - (p_days || ' days')::interval;

  -- Total count
  SELECT COUNT(*) INTO v_total
  FROM public.waitlist w
  WHERE w.created_at >= v_start_date
    AND (p_hub_id IS NULL OR w.nearest_hub_id = p_hub_id);

  -- By zip (top 20)
  SELECT jsonb_agg(sub ORDER BY sub.count DESC)
  INTO v_by_zip
  FROM (
    SELECT 
      w.zip_code as zip,
      COUNT(*) as count,
      w.nearest_hub_id as hub_id
    FROM public.waitlist w
    WHERE w.created_at >= v_start_date
      AND (p_hub_id IS NULL OR w.nearest_hub_id = p_hub_id)
    GROUP BY w.zip_code, w.nearest_hub_id
    ORDER BY COUNT(*) DESC
    LIMIT 20
  ) sub;

  -- By hub
  SELECT jsonb_agg(sub ORDER BY sub.count DESC)
  INTO v_by_hub
  FROM (
    SELECT 
      w.nearest_hub_id as hub_id,
      h.name as hub_name,
      COUNT(*) as count
    FROM public.waitlist w
    LEFT JOIN public.service_hubs h ON h.id = w.nearest_hub_id
    WHERE w.created_at >= v_start_date
      AND (p_hub_id IS NULL OR w.nearest_hub_id = p_hub_id)
    GROUP BY w.nearest_hub_id, h.name
    ORDER BY COUNT(*) DESC
  ) sub;

  -- By user type
  SELECT jsonb_agg(sub)
  INTO v_by_user_type
  FROM (
    SELECT 
      w.user_type,
      COUNT(*) as count
    FROM public.waitlist w
    WHERE w.created_at >= v_start_date
      AND (p_hub_id IS NULL OR w.nearest_hub_id = p_hub_id)
    GROUP BY w.user_type
  ) sub;

  RETURN jsonb_build_object(
    'period_days', p_days,
    'hub_id', p_hub_id,
    'total', v_total,
    'by_zip', COALESCE(v_by_zip, '[]'::jsonb),
    'by_hub', COALESCE(v_by_hub, '[]'::jsonb),
    'by_user_type', COALESCE(v_by_user_type, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_waitlist_heatmap(uuid, int) TO authenticated;

-- =====================================================
-- H) ADMIN GET JOBS LIST
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_jobs(
  p_status text DEFAULT NULL,
  p_hub_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  customer_id uuid,
  customer_name text,
  mechanic_id uuid,
  mechanic_name text,
  hub_id uuid,
  hub_name text,
  created_at timestamptz,
  completed_at timestamptz,
  quote_count bigint,
  has_dispute boolean,
  has_support_ticket boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.status::text,
    j.customer_id,
    pc.full_name as customer_name,
    jc.mechanic_id,
    pm.full_name as mechanic_name,
    j.hub_id,
    h.name as hub_name,
    j.created_at,
    j.completed_at,
    (SELECT COUNT(*) FROM public.quotes q WHERE q.job_id = j.id) as quote_count,
    EXISTS(SELECT 1 FROM public.disputes d WHERE d.job_id = j.id) as has_dispute,
    EXISTS(SELECT 1 FROM public.support_requests sr WHERE sr.job_id = j.id) as has_support_ticket
  FROM public.jobs j
  JOIN public.profiles pc ON pc.id = j.customer_id
  LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
  LEFT JOIN public.profiles pm ON pm.id = jc.mechanic_id
  LEFT JOIN public.service_hubs h ON h.id = j.hub_id
  WHERE (p_status IS NULL OR j.status::text = p_status)
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id)
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_jobs(text, uuid, int, int) TO authenticated;

-- =====================================================
-- I) ADMIN GET JOB DETAIL
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_job_detail(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jsonb;
  v_quotes jsonb;
  v_contract jsonb;
  v_events jsonb;
  v_disputes jsonb;
  v_support jsonb;
  v_payments jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  -- Job with customer info
  SELECT jsonb_build_object(
    'id', j.id,
    'title', j.title,
    'description', j.description,
    'status', j.status,
    'service_type', j.service_type,
    'urgency', j.urgency,
    'customer_id', j.customer_id,
    'customer_name', pc.full_name,
    'customer_email', pc.email,
    'hub_id', j.hub_id,
    'location_lat', j.location_lat,
    'location_lng', j.location_lng,
    'location_address', j.location_address,
    'vehicle_year', j.vehicle_year,
    'vehicle_make', j.vehicle_make,
    'vehicle_model', j.vehicle_model,
    'created_at', j.created_at,
    'scheduled_at', j.scheduled_at,
    'started_at', j.started_at,
    'completed_at', j.completed_at
  ) INTO v_job
  FROM public.jobs j
  JOIN public.profiles pc ON pc.id = j.customer_id
  WHERE j.id = p_job_id;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Quotes
  SELECT jsonb_agg(jsonb_build_object(
    'id', q.id,
    'mechanic_id', q.mechanic_id,
    'mechanic_name', pm.full_name,
    'status', q.status,
    'labor_cents', q.labor_cents,
    'parts_cents', q.parts_cents,
    'total_cents', q.total_cents,
    'eta_minutes', q.eta_minutes,
    'created_at', q.created_at
  ) ORDER BY q.created_at)
  INTO v_quotes
  FROM public.quotes q
  JOIN public.profiles pm ON pm.id = q.mechanic_id
  WHERE q.job_id = p_job_id;

  -- Contract
  SELECT jsonb_build_object(
    'id', jc.id,
    'mechanic_id', jc.mechanic_id,
    'mechanic_name', pm.full_name,
    'status', jc.status,
    'accepted_at', jc.accepted_at,
    'started_at', jc.started_at,
    'completed_at', jc.completed_at,
    'final_labor_cents', jc.final_labor_cents,
    'final_parts_cents', jc.final_parts_cents,
    'final_total_cents', jc.final_total_cents
  ) INTO v_contract
  FROM public.job_contracts jc
  JOIN public.profiles pm ON pm.id = jc.mechanic_id
  WHERE jc.job_id = p_job_id;

  -- Events (last 50)
  SELECT jsonb_agg(jsonb_build_object(
    'id', je.id,
    'event_type', je.event_type,
    'actor_id', je.actor_id,
    'actor_role', je.actor_role,
    'metadata', je.metadata,
    'created_at', je.created_at
  ) ORDER BY je.created_at DESC)
  INTO v_events
  FROM (
    SELECT * FROM public.job_events WHERE job_id = p_job_id ORDER BY created_at DESC LIMIT 50
  ) je;

  -- Disputes
  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'status', d.status,
    'category', d.category,
    'priority', d.priority,
    'created_at', d.created_at,
    'resolved_at', d.resolved_at
  ) ORDER BY d.created_at DESC)
  INTO v_disputes
  FROM public.disputes d WHERE d.job_id = p_job_id;

  -- Support requests
  SELECT jsonb_agg(jsonb_build_object(
    'id', sr.id,
    'status', sr.status,
    'category', sr.category,
    'subject', sr.subject,
    'created_at', sr.created_at,
    'resolved_at', sr.resolved_at
  ) ORDER BY sr.created_at DESC)
  INTO v_support
  FROM public.support_requests sr WHERE sr.job_id = p_job_id;

  -- Payments
  SELECT jsonb_agg(jsonb_build_object(
    'id', p.id,
    'status', p.status,
    'amount_cents', p.amount_cents,
    'created_at', p.created_at,
    'paid_at', p.paid_at,
    'refunded_at', p.refunded_at
  ) ORDER BY p.created_at DESC)
  INTO v_payments
  FROM public.payments p WHERE p.job_id = p_job_id;

  RETURN jsonb_build_object(
    'job', v_job,
    'quotes', COALESCE(v_quotes, '[]'::jsonb),
    'contract', v_contract,
    'events', COALESCE(v_events, '[]'::jsonb),
    'disputes', COALESCE(v_disputes, '[]'::jsonb),
    'support_requests', COALESCE(v_support, '[]'::jsonb),
    'payments', COALESCE(v_payments, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_job_detail(uuid) TO authenticated;

-- =====================================================
-- J) ADMIN GET MECHANICS LIST
-- =====================================================

-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS public.admin_get_mechanics(text, uuid, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_mechanics(
  p_status text DEFAULT NULL,
  p_hub_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  verification_status text,
  tier text,
  strikes int,
  hub_id uuid,
  hub_name text,
  rating_avg numeric,
  completed_jobs bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    mp.id,
    p.full_name,
    p.email,
    p.phone,
    mp.verification_status,
    mp.tier,
    COALESCE(mp.strikes, 0) as strikes,
    mp.hub_id,
    h.name as hub_name,
    mp.rating_avg,
    (SELECT COUNT(*) FROM public.job_contracts jc 
     JOIN public.jobs j ON j.id = jc.job_id 
     WHERE jc.mechanic_id = mp.id AND j.status = 'completed') as completed_jobs,
    mp.created_at
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON p.id = mp.id
  LEFT JOIN public.service_hubs h ON h.id = mp.hub_id
  WHERE (p_status IS NULL OR mp.verification_status = p_status)
    AND (p_hub_id IS NULL OR mp.hub_id = p_hub_id)
  ORDER BY mp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_mechanics(text, uuid, int, int) TO authenticated;

-- =====================================================
-- K) ADMIN GET MECHANIC DETAIL
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_mechanic_detail(p_mechanic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic jsonb;
  v_documents jsonb;
  v_recent_jobs jsonb;
  v_trust_score jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  -- Mechanic profile
  SELECT jsonb_build_object(
    'id', mp.id,
    'full_name', p.full_name,
    'email', p.email,
    'phone', p.phone,
    'verification_status', mp.verification_status,
    'rejection_reason', mp.rejection_reason,
    'tier', mp.tier,
    'strikes', COALESCE(mp.strikes, 0),
    'hub_id', mp.hub_id,
    'hub_name', h.name,
    'rating_avg', mp.rating_avg,
    'rating_count', mp.rating_count,
    'bio', mp.bio,
    'years_experience', mp.years_experience,
    'specialties', mp.specialties,
    'certifications', mp.certifications,
    'service_radius_miles', mp.service_radius_miles,
    'created_at', mp.created_at,
    'verified_at', mp.verified_at
  ) INTO v_mechanic
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON p.id = mp.id
  LEFT JOIN public.service_hubs h ON h.id = mp.hub_id
  WHERE mp.id = p_mechanic_id;

  IF v_mechanic IS NULL THEN
    RETURN jsonb_build_object('error', 'Mechanic not found');
  END IF;

  -- Verification documents
  SELECT jsonb_agg(jsonb_build_object(
    'id', vd.id,
    'document_type', vd.document_type,
    'status', vd.status,
    'uploaded_at', vd.uploaded_at,
    'reviewed_at', vd.reviewed_at
  ) ORDER BY vd.uploaded_at DESC)
  INTO v_documents
  FROM public.verification_documents vd
  WHERE vd.mechanic_id = p_mechanic_id;

  -- Recent jobs (last 10)
  SELECT jsonb_agg(jsonb_build_object(
    'job_id', j.id,
    'title', j.title,
    'status', j.status,
    'completed_at', j.completed_at,
    'customer_name', pc.full_name
  ) ORDER BY j.created_at DESC)
  INTO v_recent_jobs
  FROM public.job_contracts jc
  JOIN public.jobs j ON j.id = jc.job_id
  JOIN public.profiles pc ON pc.id = j.customer_id
  WHERE jc.mechanic_id = p_mechanic_id
  LIMIT 10;

  -- Trust score
  SELECT jsonb_build_object(
    'score', ts.score,
    'components', ts.score_components,
    'updated_at', ts.updated_at
  ) INTO v_trust_score
  FROM public.trust_scores ts
  WHERE ts.user_id = p_mechanic_id;

  RETURN jsonb_build_object(
    'mechanic', v_mechanic,
    'documents', COALESCE(v_documents, '[]'::jsonb),
    'recent_jobs', COALESCE(v_recent_jobs, '[]'::jsonb),
    'trust_score', v_trust_score
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_mechanic_detail(uuid) TO authenticated;

-- =====================================================
-- L) ADMIN GET SUPPORT REQUESTS
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_support_requests(
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  job_title text,
  user_id uuid,
  user_name text,
  user_role text,
  category text,
  subject text,
  status text,
  priority text,
  created_at timestamptz,
  resolved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    sr.id,
    sr.job_id,
    j.title as job_title,
    sr.user_id,
    p.full_name as user_name,
    p.role::text as user_role,
    sr.category,
    sr.subject,
    sr.status,
    sr.priority,
    sr.created_at,
    sr.resolved_at
  FROM public.support_requests sr
  LEFT JOIN public.jobs j ON j.id = sr.job_id
  JOIN public.profiles p ON p.id = sr.user_id
  WHERE (p_status IS NULL OR sr.status = p_status)
  ORDER BY 
    CASE sr.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
    sr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_support_requests(text, int, int) TO authenticated;

-- =====================================================
-- M) ADMIN RESOLVE SUPPORT REQUEST
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_resolve_support_request(
  p_request_id uuid,
  p_status text,
  p_resolution_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT status INTO v_old_status
  FROM public.support_requests
  WHERE id = p_request_id;

  IF v_old_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Support request not found');
  END IF;

  UPDATE public.support_requests
  SET 
    status = p_status,
    resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
    resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE resolved_at END,
    resolved_by = auth.uid(),
    updated_at = now()
  WHERE id = p_request_id;

  -- Write to audit_log
  PERFORM public.admin_audit_log(
    'ADMIN_RESOLVE_SUPPORT_REQUEST',
    'support_requests',
    p_request_id,
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_status,
      'resolution_notes', p_resolution_notes
    )
  );

  RETURN jsonb_build_object('success', true, 'request_id', p_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_support_request(uuid, text, text) TO authenticated;

-- =====================================================
-- N) ADMIN GET PAYMENTS
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_payments(
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  job_title text,
  contract_id uuid,
  customer_id uuid,
  customer_name text,
  mechanic_id uuid,
  mechanic_name text,
  amount_cents int,
  status text,
  created_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    pay.id,
    pay.job_id,
    j.title as job_title,
    pay.contract_id,
    j.customer_id,
    pc.full_name as customer_name,
    jc.mechanic_id,
    pm.full_name as mechanic_name,
    pay.amount_cents,
    pay.status,
    pay.created_at,
    pay.paid_at,
    pay.refunded_at
  FROM public.payments pay
  JOIN public.jobs j ON j.id = pay.job_id
  JOIN public.profiles pc ON pc.id = j.customer_id
  LEFT JOIN public.job_contracts jc ON jc.id = pay.contract_id
  LEFT JOIN public.profiles pm ON pm.id = jc.mechanic_id
  WHERE (p_status IS NULL OR pay.status = p_status)
  ORDER BY pay.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_payments(text, int, int) TO authenticated;

-- =====================================================
-- O) ADMIN GET PAYOUTS
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_payouts(
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  mechanic_id uuid,
  mechanic_name text,
  amount_cents int,
  status text,
  payout_method text,
  created_at timestamptz,
  processed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    po.id,
    po.mechanic_id,
    p.full_name as mechanic_name,
    po.amount_cents,
    po.status,
    po.payout_method,
    po.created_at,
    po.processed_at
  FROM public.payouts po
  JOIN public.profiles p ON p.id = po.mechanic_id
  WHERE (p_status IS NULL OR po.status = p_status)
  ORDER BY po.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_payouts(text, int, int) TO authenticated;

-- =====================================================
-- P) ADMIN GET AUDIT LOG
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_audit_log(
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  actor_id uuid,
  actor_name text,
  actor_type text,
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
    al.actor_id,
    p.full_name as actor_name,
    al.actor_type,
    al.action,
    al.entity_type,
    al.entity_id,
    al.metadata,
    al.created_at
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON p.id = al.actor_id
  WHERE (p_entity_type IS NULL OR al.entity_type = p_entity_type)
    AND (p_entity_id IS NULL OR al.entity_id = p_entity_id)
    AND (p_action IS NULL OR al.action = p_action)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_audit_log(text, uuid, text, int, int) TO authenticated;
