-- Add notification to customer when mechanic responds to dispute

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
  v_mechanic_name text;
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

  -- Get mechanic name for notification
  SELECT COALESCE(full_name, 'The mechanic') INTO v_mechanic_name
  FROM public.profiles WHERE id = v_mechanic_id;

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

  -- Notify the customer about the mechanic's response
  PERFORM notify_user(
    v_dispute.filed_by,
    'Mechanic Responded to Your Issue',
    v_mechanic_name || ' has responded to your reported issue. Our team will review and follow up.',
    'dispute',
    'dispute',
    p_dispute_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'sla_breached', now() > v_dispute.response_deadline
  );
END;
$$;
