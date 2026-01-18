-- Add notification to mechanic when customer files a dispute
-- Updates customer_file_comeback to notify the mechanic

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
  v_customer_name text;
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

  -- Get customer name for notification
  SELECT COALESCE(full_name, 'Customer') INTO v_customer_name
  FROM public.profiles WHERE id = v_customer_id;

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

  -- Notify the mechanic about the dispute
  PERFORM notify_user(
    v_job.accepted_mechanic_id,
    'Customer Reported an Issue',
    v_customer_name || ' has reported an issue with a completed job. Please respond within ' || v_response_sla_hours || ' hours.',
    'dispute',
    'dispute',
    v_dispute_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', v_dispute_id,
    'response_deadline', now() + (v_response_sla_hours || ' hours')::interval
  );
END;
$$;
