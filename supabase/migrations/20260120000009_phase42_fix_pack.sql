-- =====================================================
-- PHASE 4.2 FIX PACK - Remaining Schema Errors
-- =====================================================
-- Fixes:
-- A) v.question_key -> v.prompt_key in mechanic vetting query
-- B) Removes decision_reason dependency from metrics
-- C) jc.final_price_cents -> uses j.final_price_cents or jc.subtotal_cents
-- =====================================================

-- =====================================================
-- A) FIX admin_get_mechanic_detail - vetting uses prompt_key not question_key
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_get_mechanic_detail(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_mechanic_detail(p_mechanic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic jsonb;
  v_docs jsonb;
  v_vetting jsonb;
  v_jobs jsonb;
  v_reviews jsonb;
  v_disputes jsonb;
  v_support jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT jsonb_build_object(
    'id', mp.id,
    'full_name', p.full_name::text,
    'email', p.email::text,
    'phone', p.phone::text,
    'role', p.role::text,
    'city', p.city::text,
    'state', p.state::text,
    'hub_id', p.hub_id,
    'hub_name', h.name::text,
    'verification_status', mp.verification_status::text,
    'verification_reason', mp.verification_reason::text,
    'tier', COALESCE(mp.tier, 'bronze')::text,
    'bio', mp.bio::text,
    'years_experience', mp.years_experience,
    'hourly_rate_cents', mp.hourly_rate_cents,
    'service_radius_km', mp.service_radius_km,
    'mobile_service', mp.mobile_service,
    'is_available', mp.is_available,
    'rating_avg', mp.rating_avg,
    'rating_count', COALESCE(mp.rating_count, 0),
    'jobs_completed', COALESCE(mp.jobs_completed, 0),
    'stripe_account_id', mp.stripe_account_id::text,
    'stripe_onboarding_complete', mp.stripe_onboarding_complete,
    'created_at', mp.created_at,
    'updated_at', mp.updated_at
  ) INTO v_mechanic
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON p.id = mp.id
  LEFT JOIN public.service_hubs h ON h.id = p.hub_id
  WHERE mp.id = p_mechanic_id;

  IF v_mechanic IS NULL THEN
    RETURN jsonb_build_object('error', 'Mechanic not found');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'doc_type', d.doc_type::text,
    'status', d.status::text,
    'uploaded_at', d.uploaded_at,
    'reviewed_at', d.reviewed_at,
    'review_notes', d.review_notes::text
  ) ORDER BY d.uploaded_at DESC)
  INTO v_docs
  FROM public.mechanic_verification_documents d
  WHERE d.mechanic_id = p_mechanic_id;

  -- FIXED: Use prompt_key, prompt_text, response_text (NOT question_key)
  SELECT jsonb_agg(jsonb_build_object(
    'id', v.id,
    'prompt_key', v.prompt_key::text,
    'prompt_text', v.prompt_text::text,
    'response_text', v.response_text::text,
    'created_at', v.created_at
  ) ORDER BY v.created_at)
  INTO v_vetting
  FROM public.mechanic_vetting_responses v
  WHERE v.mechanic_id = p_mechanic_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id', j.id,
    'title', j.title::text,
    'status', j.status::text,
    'customer_name', pc.full_name::text,
    'created_at', j.created_at,
    'completed_at', j.completed_at
  ) ORDER BY j.created_at DESC)
  INTO v_jobs
  FROM (
    SELECT j.* FROM public.jobs j
    JOIN public.job_contracts jc ON jc.job_id = j.id
    WHERE jc.mechanic_id = p_mechanic_id
    ORDER BY j.created_at DESC
    LIMIT 20
  ) j
  JOIN public.profiles pc ON pc.id = j.customer_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id', r.id,
    'overall_rating', r.overall_rating,
    'comment', r.comment::text,
    'reviewer_name', pr.full_name::text,
    'created_at', r.created_at
  ) ORDER BY r.created_at DESC)
  INTO v_reviews
  FROM public.reviews r
  JOIN public.profiles pr ON pr.id = r.reviewer_id
  WHERE r.reviewee_id = p_mechanic_id
  LIMIT 20;

  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'job_id', d.job_id,
    'status', d.status::text,
    'category', d.category::text,
    'created_at', d.created_at,
    'resolved_at', d.resolved_at
  ) ORDER BY d.created_at DESC)
  INTO v_disputes
  FROM public.disputes d
  JOIN public.job_contracts jc ON jc.job_id = d.job_id
  WHERE jc.mechanic_id = p_mechanic_id
  LIMIT 20;

  SELECT jsonb_agg(jsonb_build_object(
    'id', sr.id,
    'job_id', sr.job_id,
    'category', sr.category::text,
    'status', sr.status::text,
    'message', sr.message::text,
    'created_at', sr.created_at
  ) ORDER BY sr.created_at DESC)
  INTO v_support
  FROM public.support_requests sr
  WHERE sr.user_id = p_mechanic_id
  LIMIT 20;

  RETURN jsonb_build_object(
    'mechanic', v_mechanic,
    'documents', COALESCE(v_docs, '[]'::jsonb),
    'vetting', COALESCE(v_vetting, '[]'::jsonb),
    'jobs', COALESCE(v_jobs, '[]'::jsonb),
    'reviews', COALESCE(v_reviews, '[]'::jsonb),
    'disputes', COALESCE(v_disputes, '[]'::jsonb),
    'support_requests', COALESCE(v_support, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_mechanic_detail(uuid) TO authenticated;

-- =====================================================
-- B) FIX admin_get_metrics - Remove decision_reason dependency entirely
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_get_metrics(uuid, int);

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
  v_start_date timestamptz;
  v_daily_jobs jsonb;
  v_daily_completed jsonb;
  v_total_jobs bigint;
  v_total_completed bigint;
  v_total_quotes bigint;
  v_total_accepted bigint;
  v_total_disputes bigint;
  v_total_refunds bigint;
  v_total_tickets bigint;
  v_quotes_per_job numeric;
  v_acceptance_rate numeric;
  v_completion_rate numeric;
  v_dispute_rate numeric;
  v_refund_rate numeric;
  v_tickets_per_job numeric;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  v_start_date := now() - (p_days || ' days')::interval;

  -- Daily jobs created
  SELECT jsonb_agg(jsonb_build_object('date', day::date, 'count', cnt) ORDER BY day)
  INTO v_daily_jobs
  FROM (
    SELECT date_trunc('day', j.created_at) as day, COUNT(*) as cnt
    FROM public.jobs j
    WHERE j.created_at >= v_start_date
      AND (p_hub_id IS NULL OR j.hub_id = p_hub_id)
    GROUP BY date_trunc('day', j.created_at)
  ) sub;

  -- Daily jobs completed
  SELECT jsonb_agg(jsonb_build_object('date', day::date, 'count', cnt) ORDER BY day)
  INTO v_daily_completed
  FROM (
    SELECT date_trunc('day', j.completed_at) as day, COUNT(*) as cnt
    FROM public.jobs j
    WHERE j.completed_at >= v_start_date
      AND j.status = 'completed'
      AND (p_hub_id IS NULL OR j.hub_id = p_hub_id)
    GROUP BY date_trunc('day', j.completed_at)
  ) sub;

  -- Totals
  SELECT COUNT(*) INTO v_total_jobs
  FROM public.jobs j
  WHERE j.created_at >= v_start_date
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id);

  SELECT COUNT(*) INTO v_total_completed
  FROM public.jobs j
  WHERE j.completed_at >= v_start_date
    AND j.status = 'completed'
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id);

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

  -- Refunds: disputes with customer_refund_cents > 0 OR payments with refunded_at
  SELECT COUNT(*) INTO v_total_refunds
  FROM (
    SELECT d.id FROM public.disputes d
    JOIN public.jobs j ON j.id = d.job_id
    WHERE d.created_at >= v_start_date
      AND d.customer_refund_cents > 0
      AND (p_hub_id IS NULL OR j.hub_id = p_hub_id)
    UNION
    SELECT p.id FROM public.payments p
    JOIN public.jobs j ON j.id = p.job_id
    WHERE p.refunded_at >= v_start_date
      AND (p_hub_id IS NULL OR j.hub_id = p_hub_id)
  ) refunds;

  SELECT COUNT(*) INTO v_total_tickets
  FROM public.support_requests sr
  LEFT JOIN public.jobs j ON j.id = sr.job_id
  WHERE sr.created_at >= v_start_date
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id OR sr.job_id IS NULL);

  -- Calculate rates
  v_quotes_per_job := CASE WHEN v_total_jobs > 0 THEN ROUND(v_total_quotes::numeric / v_total_jobs, 2) ELSE 0 END;
  v_acceptance_rate := CASE WHEN v_total_quotes > 0 THEN ROUND(v_total_accepted::numeric / v_total_quotes * 100, 1) ELSE 0 END;
  v_completion_rate := CASE WHEN v_total_jobs > 0 THEN ROUND(v_total_completed::numeric / v_total_jobs * 100, 1) ELSE 0 END;
  v_dispute_rate := CASE WHEN v_total_completed > 0 THEN ROUND(v_total_disputes::numeric / v_total_completed * 100, 1) ELSE 0 END;
  v_refund_rate := CASE WHEN v_total_completed > 0 THEN ROUND(v_total_refunds::numeric / v_total_completed * 100, 1) ELSE 0 END;
  v_tickets_per_job := CASE WHEN v_total_jobs > 0 THEN ROUND(v_total_tickets::numeric / v_total_jobs, 2) ELSE 0 END;

  -- NOTE: decision_reason removed - that table/column does not exist
  -- decline_reasons is empty since we don't have lead_decisions table
  
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
    'decline_reasons', '[]'::jsonb
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_metrics(uuid, int) TO authenticated;

-- =====================================================
-- C) FIX admin_get_job_detail - Use j.final_price_cents and jc.subtotal_cents
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_get_job_detail(uuid);

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

  SELECT jsonb_build_object(
    'id', j.id,
    'title', j.title::text,
    'description', j.description::text,
    'status', j.status::text,
    'symptom_key', j.symptom_key::text,
    'customer_id', j.customer_id,
    'customer_name', pc.full_name::text,
    'customer_email', pc.email::text,
    'customer_phone', pc.phone::text,
    'hub_id', j.hub_id,
    'hub_name', h.name::text,
    'location_lat', j.location_lat,
    'location_lng', j.location_lng,
    'location_address', j.location_address::text,
    'vehicle_id', j.vehicle_id,
    'vehicle_year', v.year,
    'vehicle_make', v.make::text,
    'vehicle_model', v.model::text,
    'vehicle_nickname', v.nickname::text,
    'preferred_time', j.preferred_time::text,
    'final_price_cents', j.final_price_cents,
    'created_at', j.created_at,
    'scheduled_at', j.scheduled_at,
    'completed_at', j.completed_at,
    'cancelled_at', j.cancelled_at
  ) INTO v_job
  FROM public.jobs j
  JOIN public.profiles pc ON pc.id = j.customer_id
  LEFT JOIN public.vehicles v ON v.id = j.vehicle_id
  LEFT JOIN public.service_hubs h ON h.id = j.hub_id
  WHERE j.id = p_job_id;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', q.id,
    'mechanic_id', q.mechanic_id,
    'mechanic_name', pm.full_name::text,
    'status', q.status::text,
    'price_cents', COALESCE(q.price_cents, 0),
    'notes', q.notes::text,
    'created_at', q.created_at
  ) ORDER BY q.created_at DESC)
  INTO v_quotes
  FROM public.quotes q
  JOIN public.profiles pm ON pm.id = q.mechanic_id
  WHERE q.job_id = p_job_id;

  -- FIXED: Use jc.quoted_price_cents and jc.subtotal_cents (NOT jc.final_price_cents)
  SELECT jsonb_build_object(
    'id', jc.id,
    'mechanic_id', jc.mechanic_id,
    'mechanic_name', pm.full_name::text,
    'status', jc.status::text,
    'quoted_price_cents', COALESCE(jc.quoted_price_cents, 0),
    'subtotal_cents', COALESCE(jc.subtotal_cents, 0),
    'total_customer_cents', COALESCE(jc.total_customer_cents, 0),
    'mechanic_payout_cents', COALESCE(jc.mechanic_payout_cents, 0),
    'accepted_at', jc.terms_accepted_at,
    'started_at', jc.payment_authorized_at,
    'completed_at', jc.payment_captured_at
  ) INTO v_contract
  FROM public.job_contracts jc
  JOIN public.profiles pm ON pm.id = jc.mechanic_id
  WHERE jc.job_id = p_job_id
  LIMIT 1;

  SELECT jsonb_agg(jsonb_build_object(
    'id', je.id,
    'event_type', je.event_type::text,
    'actor_id', je.actor_id,
    'actor_role', je.actor_role::text,
    'metadata', je.metadata,
    'created_at', je.created_at
  ) ORDER BY je.created_at DESC)
  INTO v_events
  FROM (
    SELECT * FROM public.job_events WHERE job_id = p_job_id ORDER BY created_at DESC LIMIT 50
  ) je;

  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'status', d.status::text,
    'category', d.category::text,
    'priority', d.priority::text,
    'created_at', d.created_at,
    'resolved_at', d.resolved_at
  ) ORDER BY d.created_at DESC)
  INTO v_disputes
  FROM public.disputes d WHERE d.job_id = p_job_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id', sr.id,
    'status', sr.status::text,
    'category', sr.category::text,
    'message', sr.message::text,
    'created_at', sr.created_at
  ) ORDER BY sr.created_at DESC)
  INTO v_support
  FROM public.support_requests sr WHERE sr.job_id = p_job_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id', pay.id,
    'status', pay.status::text,
    'amount_cents', COALESCE(pay.amount_cents, 0),
    'created_at', pay.created_at,
    'paid_at', pay.paid_at,
    'refunded_at', pay.refunded_at
  ) ORDER BY pay.created_at DESC)
  INTO v_payments
  FROM public.payments pay WHERE pay.job_id = p_job_id;

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