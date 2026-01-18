-- =====================================================
-- PHASE 3: Job Quality, Comebacks, Disputes, Chat Safety
-- =====================================================
-- Implements:
-- A) Comeback workflow (customer reports issue on completed job)
-- B) Dispute resolution enforcement (admin tools)
-- C) Chat lifecycle enforcement (strict)
-- D) Off-platform communication detection
-- E) Mechanic SLA enforcement
-- =====================================================

BEGIN;

-- =====================================================
-- A) DISPUTES TABLE ENHANCEMENTS
-- =====================================================

-- Add mechanic response fields
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS mechanic_response text,
  ADD COLUMN IF NOT EXISTS mechanic_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_breached boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- Add comeback event type if not exists
DO $$ BEGIN
  ALTER TYPE public.job_event_type ADD VALUE IF NOT EXISTS 'comeback_reported';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.job_event_type ADD VALUE IF NOT EXISTS 'dispute_escalated';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.job_event_type ADD VALUE IF NOT EXISTS 'mechanic_responded';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.job_event_type ADD VALUE IF NOT EXISTS 'chat_closed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- B) PLATFORM POLICY CONFIG FOR PHASE 3
-- =====================================================

INSERT INTO public.mechanic_policy_config (key, value, description) VALUES
  ('disputes.comeback_window_days', '14', 'Days after job completion customer can report comeback'),
  ('disputes.mechanic_response_sla_hours', '12', 'Hours mechanic has to respond to dispute'),
  ('disputes.evidence_deadline_hours', '48', 'Hours to submit evidence after dispute filed'),
  ('chat.post_completion_window_hours', '48', 'Hours chat remains open after job completion'),
  ('chat.readonly_period_days', '30', 'Days chat remains read-only before archiving')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- C) FUNCTION: Check if customer can file comeback
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_file_comeback(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_customer_id uuid := auth.uid();
  v_policy jsonb;
  v_comeback_window_days int;
  v_days_since_completion int;
  v_existing_dispute uuid;
BEGIN
  -- Get job details
  SELECT j.*, jc.id as contract_id, jp.finalized_at
  INTO v_job
  FROM public.jobs j
  LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
  LEFT JOIN public.job_progress jp ON jp.job_id = j.id
  WHERE j.id = p_job_id;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object('can_file', false, 'reason', 'Job not found');
  END IF;

  IF v_job.customer_id != v_customer_id THEN
    RETURN jsonb_build_object('can_file', false, 'reason', 'Not your job');
  END IF;

  IF v_job.status != 'completed' THEN
    RETURN jsonb_build_object('can_file', false, 'reason', 'Job not completed');
  END IF;

  -- Check for existing open dispute
  SELECT id INTO v_existing_dispute
  FROM public.disputes
  WHERE job_id = p_job_id
    AND status IN ('open', 'under_review', 'evidence_requested');

  IF v_existing_dispute IS NOT NULL THEN
    RETURN jsonb_build_object('can_file', false, 'reason', 'Dispute already exists', 'dispute_id', v_existing_dispute);
  END IF;

  -- Get policy
  v_policy := get_effective_mechanic_policy(NULL);
  v_comeback_window_days := COALESCE((v_policy->>'disputes.comeback_window_days')::int, 14);

  -- Calculate days since completion
  v_days_since_completion := EXTRACT(DAY FROM (now() - COALESCE(v_job.finalized_at, v_job.updated_at)));

  IF v_days_since_completion > v_comeback_window_days THEN
    RETURN jsonb_build_object(
      'can_file', false,
      'reason', 'Comeback window expired',
      'window_days', v_comeback_window_days,
      'days_since', v_days_since_completion
    );
  END IF;

  RETURN jsonb_build_object(
    'can_file', true,
    'window_days', v_comeback_window_days,
    'days_remaining', v_comeback_window_days - v_days_since_completion,
    'contract_id', v_job.contract_id,
    'mechanic_id', v_job.accepted_mechanic_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_file_comeback(uuid) TO authenticated;

-- =====================================================
-- D) FUNCTION: Customer files comeback
-- =====================================================

CREATE OR REPLACE FUNCTION public.customer_file_comeback(
  p_job_id uuid,
  p_description text,
  p_desired_resolution text DEFAULT NULL,
  p_evidence_urls text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid := auth.uid();
  v_can_file jsonb;
  v_job record;
  v_policy jsonb;
  v_response_sla_hours int;
  v_evidence_deadline_hours int;
  v_dispute_id uuid;
BEGIN
  -- Check if can file
  v_can_file := can_file_comeback(p_job_id);

  IF NOT (v_can_file->>'can_file')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_can_file->>'reason');
  END IF;

  -- Get job details
  SELECT j.*, jc.id as contract_id
  INTO v_job
  FROM public.jobs j
  LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
  WHERE j.id = p_job_id;

  -- Get policy for SLA
  v_policy := get_effective_mechanic_policy(NULL);
  v_response_sla_hours := COALESCE((v_policy->>'disputes.mechanic_response_sla_hours')::int, 12);
  v_evidence_deadline_hours := COALESCE((v_policy->>'disputes.evidence_deadline_hours')::int, 48);

  -- Create dispute
  INSERT INTO public.disputes (
    job_id,
    contract_id,
    filed_by,
    filed_by_role,
    filed_against,
    status,
    category,
    description,
    desired_resolution,
    evidence_urls,
    priority,
    response_deadline,
    evidence_deadline
  ) VALUES (
    p_job_id,
    v_job.contract_id,
    v_customer_id,
    'customer',
    v_job.accepted_mechanic_id,
    'open',
    'comeback',
    p_description,
    p_desired_resolution,
    p_evidence_urls,
    'normal',
    now() + (v_response_sla_hours || ' hours')::interval,
    now() + (v_evidence_deadline_hours || ' hours')::interval
  )
  RETURNING id INTO v_dispute_id;

  -- Log job event
  INSERT INTO public.job_events (
    job_id,
    contract_id,
    event_type,
    actor_id,
    actor_role,
    title,
    description,
    metadata
  ) VALUES (
    p_job_id,
    v_job.contract_id,
    'comeback_reported',
    v_customer_id,
    'customer',
    'Issue reported',
    'Customer reported: ' || LEFT(p_description, 100),
    jsonb_build_object('dispute_id', v_dispute_id, 'category', 'comeback')
  );

  -- Update chat lifecycle to mark dispute
  UPDATE public.chat_lifecycle_config
  SET has_dispute = true, updated_at = now()
  WHERE job_id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', v_dispute_id,
    'response_deadline', now() + (v_response_sla_hours || ' hours')::interval
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_file_comeback(uuid, text, text, text[]) TO authenticated;

-- =====================================================
-- E) FUNCTION: Mechanic responds to dispute
-- =====================================================

CREATE OR REPLACE FUNCTION public.mechanic_respond_to_dispute(
  p_dispute_id uuid,
  p_response text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_id uuid := auth.uid();
  v_dispute record;
BEGIN
  -- Get dispute
  SELECT * INTO v_dispute
  FROM public.disputes
  WHERE id = p_dispute_id;

  IF v_dispute IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute not found');
  END IF;

  IF v_dispute.filed_against != v_mechanic_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_dispute.mechanic_response IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already responded');
  END IF;

  IF v_dispute.status NOT IN ('open', 'under_review', 'evidence_requested') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute is closed');
  END IF;

  -- Check if past SLA
  UPDATE public.disputes
  SET 
    mechanic_response = p_response,
    mechanic_responded_at = now(),
    sla_breached = CASE WHEN now() > response_deadline THEN true ELSE false END,
    status = 'under_review',
    updated_at = now()
  WHERE id = p_dispute_id;

  -- Log job event
  INSERT INTO public.job_events (
    job_id,
    contract_id,
    event_type,
    actor_id,
    actor_role,
    title,
    description,
    metadata
  ) VALUES (
    v_dispute.job_id,
    v_dispute.contract_id,
    'mechanic_responded',
    v_mechanic_id,
    'mechanic',
    'Mechanic responded to dispute',
    LEFT(p_response, 100),
    jsonb_build_object('dispute_id', p_dispute_id, 'sla_breached', now() > v_dispute.response_deadline)
  );

  RETURN jsonb_build_object(
    'success', true,
    'sla_breached', now() > v_dispute.response_deadline
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mechanic_respond_to_dispute(uuid, text) TO authenticated;

-- =====================================================
-- F) FUNCTION: Admin resolve dispute
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id uuid,
  p_resolution_type text,
  p_resolution_notes text,
  p_customer_refund_cents int DEFAULT 0,
  p_mechanic_adjustment_cents int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_dispute record;
  v_new_status dispute_status;
BEGIN
  -- Check admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Validate resolution type
  IF p_resolution_type NOT IN ('rework', 'partial_refund', 'full_refund', 'credit', 'no_action', 'mechanic_favor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid resolution type');
  END IF;

  -- Get dispute
  SELECT * INTO v_dispute
  FROM public.disputes
  WHERE id = p_dispute_id;

  IF v_dispute IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute not found');
  END IF;

  IF v_dispute.status IN ('resolved_customer', 'resolved_mechanic', 'resolved_split', 'closed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dispute already resolved');
  END IF;

  -- Determine final status
  v_new_status := CASE p_resolution_type
    WHEN 'full_refund' THEN 'resolved_customer'::dispute_status
    WHEN 'partial_refund' THEN 'resolved_split'::dispute_status
    WHEN 'credit' THEN 'resolved_split'::dispute_status
    WHEN 'rework' THEN 'resolved_split'::dispute_status
    WHEN 'mechanic_favor' THEN 'resolved_mechanic'::dispute_status
    WHEN 'no_action' THEN 'closed'::dispute_status
    ELSE 'closed'::dispute_status
  END;

  -- Update dispute
  UPDATE public.disputes
  SET 
    status = v_new_status,
    resolved_at = now(),
    resolved_by = v_admin_id,
    resolution_type = p_resolution_type,
    resolution_notes = p_resolution_notes,
    customer_refund_cents = p_customer_refund_cents,
    mechanic_adjustment_cents = p_mechanic_adjustment_cents,
    updated_at = now()
  WHERE id = p_dispute_id;

  -- Log job event
  INSERT INTO public.job_events (
    job_id,
    contract_id,
    event_type,
    actor_id,
    actor_role,
    title,
    description,
    metadata,
    visible_to_customer,
    visible_to_mechanic
  ) VALUES (
    v_dispute.job_id,
    v_dispute.contract_id,
    'dispute_resolved',
    v_admin_id,
    'admin',
    'Dispute resolved',
    'Resolution: ' || p_resolution_type,
    jsonb_build_object(
      'dispute_id', p_dispute_id,
      'resolution_type', p_resolution_type,
      'customer_refund_cents', p_customer_refund_cents,
      'mechanic_adjustment_cents', p_mechanic_adjustment_cents
    ),
    true,
    true
  );

  -- Update chat lifecycle - close dispute flag if resolution is final
  UPDATE public.chat_lifecycle_config
  SET has_dispute = false, updated_at = now()
  WHERE job_id = v_dispute.job_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, text, int, int) TO authenticated;

-- =====================================================
-- G) FUNCTION: Get disputes for admin
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_disputes(
  p_status text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  contract_id uuid,
  filed_by uuid,
  filed_by_role user_role,
  filed_by_name text,
  filed_against uuid,
  filed_against_name text,
  status dispute_status,
  category text,
  description text,
  desired_resolution text,
  mechanic_response text,
  mechanic_responded_at timestamptz,
  evidence_urls text[],
  resolution_type text,
  resolution_notes text,
  customer_refund_cents int,
  priority text,
  response_deadline timestamptz,
  sla_breached boolean,
  created_at timestamptz,
  resolved_at timestamptz,
  job_title text,
  job_status text
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
    d.id,
    d.job_id,
    d.contract_id,
    d.filed_by,
    d.filed_by_role,
    pf.full_name as filed_by_name,
    d.filed_against,
    pa.full_name as filed_against_name,
    d.status,
    d.category,
    d.description,
    d.desired_resolution,
    d.mechanic_response,
    d.mechanic_responded_at,
    d.evidence_urls,
    d.resolution_type,
    d.resolution_notes,
    d.customer_refund_cents,
    d.priority,
    d.response_deadline,
    d.sla_breached,
    d.created_at,
    d.resolved_at,
    j.title as job_title,
    j.status::text as job_status
  FROM public.disputes d
  JOIN public.profiles pf ON pf.id = d.filed_by
  JOIN public.profiles pa ON pa.id = d.filed_against
  JOIN public.jobs j ON j.id = d.job_id
  WHERE (p_status IS NULL OR d.status::text = p_status)
    AND (p_priority IS NULL OR d.priority = p_priority)
  ORDER BY 
    CASE d.priority 
      WHEN 'high' THEN 1 
      WHEN 'normal' THEN 2 
      WHEN 'low' THEN 3 
    END,
    d.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_disputes(text, text, int, int) TO authenticated;

-- =====================================================
-- H) FUNCTION: Get single dispute for admin
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_dispute_detail(p_dispute_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_events jsonb;
  v_messages jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Get dispute with related data
  SELECT jsonb_build_object(
    'dispute', row_to_json(d),
    'job', row_to_json(j),
    'contract', row_to_json(jc),
    'customer', jsonb_build_object('id', pc.id, 'full_name', pc.full_name, 'avatar_url', pc.avatar_url),
    'mechanic', jsonb_build_object('id', pm.id, 'full_name', pm.full_name, 'avatar_url', pm.avatar_url)
  )
  INTO v_result
  FROM public.disputes d
  JOIN public.jobs j ON j.id = d.job_id
  LEFT JOIN public.job_contracts jc ON jc.job_id = d.job_id
  JOIN public.profiles pc ON pc.id = d.filed_by
  JOIN public.profiles pm ON pm.id = d.filed_against
  WHERE d.id = p_dispute_id;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'Dispute not found');
  END IF;

  -- Get job events
  SELECT jsonb_agg(row_to_json(je) ORDER BY je.created_at DESC)
  INTO v_events
  FROM public.job_events je
  WHERE je.job_id = (v_result->'dispute'->>'job_id')::uuid;

  -- Get recent messages
  SELECT jsonb_agg(jsonb_build_object(
    'id', m.id,
    'sender_id', m.sender_id,
    'body', m.body,
    'created_at', m.created_at
  ) ORDER BY m.created_at DESC)
  INTO v_messages
  FROM public.messages m
  WHERE m.job_id = (v_result->'dispute'->>'job_id')::uuid
  LIMIT 50;

  v_result := v_result || jsonb_build_object('events', COALESCE(v_events, '[]'::jsonb));
  v_result := v_result || jsonb_build_object('messages', COALESCE(v_messages, '[]'::jsonb));

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_dispute_detail(uuid) TO authenticated;

-- =====================================================
-- I) FUNCTION: Send message with chat lifecycle enforcement
-- =====================================================

CREATE OR REPLACE FUNCTION public.send_message_enforced(
  p_job_id uuid,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_job record;
  v_lifecycle record;
  v_recipient_id uuid;
  v_detection jsonb;
  v_message_id uuid;
  v_action message_action := 'allowed';
BEGIN
  -- Get job
  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Check user is part of job
  IF v_sender_id != v_job.customer_id AND v_sender_id != v_job.accepted_mechanic_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Determine recipient
  v_recipient_id := CASE WHEN v_sender_id = v_job.customer_id 
    THEN v_job.accepted_mechanic_id 
    ELSE v_job.customer_id 
  END;

  IF v_recipient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No recipient - job may not be assigned yet');
  END IF;

  -- Get chat lifecycle
  SELECT * INTO v_lifecycle
  FROM public.chat_lifecycle_config
  WHERE job_id = p_job_id;

  -- Check if chat is closed (readonly)
  IF v_lifecycle IS NOT NULL AND v_lifecycle.chat_readonly_at IS NOT NULL AND now() > v_lifecycle.chat_readonly_at THEN
    -- Log blocked attempt
    INSERT INTO public.message_audit_logs (
      message_id,
      conversation_id,
      sender_id,
      recipient_id,
      original_content,
      patterns_detected,
      action_taken,
      job_id,
      job_stage
    ) VALUES (
      gen_random_uuid(),
      p_job_id,
      v_sender_id,
      v_recipient_id,
      p_body,
      ARRAY['chat_closed'],
      'blocked',
      p_job_id,
      'closed'
    );

    RETURN jsonb_build_object('success', false, 'error', 'Chat is closed', 'reason', 'readonly');
  END IF;

  -- Detect contact info / off-platform communication
  v_detection := detect_contact_info(p_body);

  IF (v_detection->>'risk_score')::numeric >= 30 THEN
    v_action := 'blocked';

    -- Log blocked message
    INSERT INTO public.message_audit_logs (
      message_id,
      conversation_id,
      sender_id,
      recipient_id,
      original_content,
      patterns_detected,
      risk_score,
      action_taken,
      job_id,
      job_stage,
      flagged_for_review
    ) VALUES (
      gen_random_uuid(),
      p_job_id,
      v_sender_id,
      v_recipient_id,
      p_body,
      (v_detection->'patterns')::text[],
      (v_detection->>'risk_score')::numeric,
      'blocked',
      p_job_id,
      v_job.status::text,
      true
    );

    -- Create warning violation
    INSERT INTO public.user_violations (
      user_id,
      violation_type,
      tier,
      description,
      job_id
    ) VALUES (
      v_sender_id,
      'contact_info_sharing',
      'warning',
      'Attempted to share contact information',
      p_job_id
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Message blocked',
      'reason', 'Contact information detected. Please keep all communication on the platform.'
    );
  END IF;

  -- Insert message
  INSERT INTO public.messages (job_id, sender_id, recipient_id, body)
  VALUES (p_job_id, v_sender_id, v_recipient_id, p_body)
  RETURNING id INTO v_message_id;

  RETURN jsonb_build_object('success', true, 'message_id', v_message_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message_enforced(uuid, text) TO authenticated;

-- =====================================================
-- J) FUNCTION: Close chat after job completion
-- =====================================================

CREATE OR REPLACE FUNCTION public.close_chat_for_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy jsonb;
  v_post_completion_hours int;
  v_readonly_days int;
BEGIN
  v_policy := get_effective_mechanic_policy(NULL);
  v_post_completion_hours := COALESCE((v_policy->>'chat.post_completion_window_hours')::int, 48);
  v_readonly_days := COALESCE((v_policy->>'chat.readonly_period_days')::int, 30);

  INSERT INTO public.chat_lifecycle_config (
    conversation_id,
    job_id,
    job_completed_at,
    chat_readonly_at,
    chat_archived_at,
    post_completion_window_hours,
    readonly_period_days
  ) VALUES (
    p_job_id,
    p_job_id,
    now(),
    now() + (v_post_completion_hours || ' hours')::interval,
    now() + (v_readonly_days || ' days')::interval,
    v_post_completion_hours,
    v_readonly_days
  )
  ON CONFLICT (conversation_id) DO UPDATE SET
    job_completed_at = now(),
    chat_readonly_at = now() + (v_post_completion_hours || ' hours')::interval,
    chat_archived_at = now() + (v_readonly_days || ' days')::interval,
    updated_at = now();
END;
$$;

-- =====================================================
-- K) TRIGGER: Auto-close chat on job completion
-- =====================================================

CREATE OR REPLACE FUNCTION public.on_job_completed_close_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM close_chat_for_job(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_completed_close_chat ON public.jobs;
CREATE TRIGGER trg_job_completed_close_chat
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.on_job_completed_close_chat();

-- =====================================================
-- L) FUNCTION: Escalate dispute (for SLA breach)
-- =====================================================

CREATE OR REPLACE FUNCTION public.escalate_overdue_disputes()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_dispute record;
BEGIN
  -- Find disputes past response deadline without mechanic response
  FOR v_dispute IN
    SELECT d.*
    FROM public.disputes d
    WHERE d.status = 'open'
      AND d.mechanic_response IS NULL
      AND d.response_deadline < now()
      AND d.sla_breached = false
  LOOP
    -- Mark as breached and escalate
    UPDATE public.disputes
    SET 
      sla_breached = true,
      priority = 'high',
      escalated_at = now(),
      updated_at = now()
    WHERE id = v_dispute.id;

    -- Log event
    INSERT INTO public.job_events (
      job_id,
      contract_id,
      event_type,
      title,
      description,
      metadata,
      is_system_message
    ) VALUES (
      v_dispute.job_id,
      v_dispute.contract_id,
      'dispute_escalated',
      'Dispute escalated - SLA breached',
      'Mechanic did not respond within the required timeframe',
      jsonb_build_object('dispute_id', v_dispute.id),
      true
    );

    -- Add strike if Phase 2 mechanic_strikes exists
    BEGIN
      INSERT INTO public.mechanic_strikes (
        mechanic_id,
        job_id,
        reason,
        notes,
        severity,
        created_by
      ) VALUES (
        v_dispute.filed_against,
        v_dispute.job_id,
        'policy_violation',
        'SLA breach: Failed to respond to dispute within deadline',
        1,
        v_dispute.filed_against  -- Self-reference as system action
      );
    EXCEPTION WHEN undefined_table THEN
      -- mechanic_strikes doesn't exist, skip
      NULL;
    END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.escalate_overdue_disputes() TO service_role;

-- =====================================================
-- M) RLS POLICIES
-- =====================================================

-- Disputes RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select_own" ON public.disputes;
CREATE POLICY "disputes_select_own" ON public.disputes
  FOR SELECT TO authenticated
  USING (
    filed_by = auth.uid() OR 
    filed_against = auth.uid() OR 
    public.is_admin()
  );

DROP POLICY IF EXISTS "disputes_insert_customer" ON public.disputes;
CREATE POLICY "disputes_insert_customer" ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (filed_by = auth.uid());

DROP POLICY IF EXISTS "disputes_update_involved" ON public.disputes;
CREATE POLICY "disputes_update_involved" ON public.disputes
  FOR UPDATE TO authenticated
  USING (
    (filed_against = auth.uid() AND mechanic_response IS NULL) OR
    public.is_admin()
  );

-- message_audit_logs RLS
ALTER TABLE public.message_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_audit_admin_only" ON public.message_audit_logs;
CREATE POLICY "message_audit_admin_only" ON public.message_audit_logs
  FOR ALL TO authenticated
  USING (public.is_admin());

-- user_violations RLS
ALTER TABLE public.user_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "violations_own_or_admin" ON public.user_violations;
CREATE POLICY "violations_own_or_admin" ON public.user_violations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "violations_admin_insert" ON public.user_violations;
CREATE POLICY "violations_admin_insert" ON public.user_violations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- chat_lifecycle_config RLS
ALTER TABLE public.chat_lifecycle_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_lifecycle_involved" ON public.chat_lifecycle_config;
CREATE POLICY "chat_lifecycle_involved" ON public.chat_lifecycle_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = chat_lifecycle_config.job_id
        AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
    OR public.is_admin()
  );

-- =====================================================
-- N) GRANTS
-- =====================================================

GRANT SELECT ON public.disputes TO authenticated;
GRANT INSERT ON public.disputes TO authenticated;
GRANT UPDATE ON public.disputes TO authenticated;
GRANT SELECT ON public.message_audit_logs TO authenticated;
GRANT INSERT ON public.message_audit_logs TO authenticated;
GRANT SELECT ON public.user_violations TO authenticated;
GRANT INSERT ON public.user_violations TO authenticated;
GRANT SELECT ON public.chat_lifecycle_config TO authenticated;

-- =====================================================
-- O) INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_filed_by ON public.disputes(filed_by);
CREATE INDEX IF NOT EXISTS idx_disputes_filed_against ON public.disputes(filed_against);
CREATE INDEX IF NOT EXISTS idx_disputes_response_deadline ON public.disputes(response_deadline) WHERE mechanic_response IS NULL;
CREATE INDEX IF NOT EXISTS idx_disputes_priority ON public.disputes(priority, created_at DESC);

COMMIT;
