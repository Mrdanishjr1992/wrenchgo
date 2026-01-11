-- Fix log_message_audit function: j.mechanic_id -> j.accepted_mechanic_id

CREATE OR REPLACE FUNCTION public.log_message_audit(
  p_message_id uuid,
  p_conversation_id uuid,
  p_recipient_id uuid,
  p_original_content text,
  p_displayed_content text,
  p_action text,
  p_risk_result jsonb,
  p_job_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid;
  v_audit_id uuid;
  v_sender_age_days int;
  v_completed_jobs int;
  v_recent_violations int;
  v_job_stage text;
  v_patterns text[];
BEGIN
  v_sender_id := auth.uid();

  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Parse patterns from JSONB array to text[]
  SELECT COALESCE(array_agg(elem::text), '{}')
  INTO v_patterns
  FROM jsonb_array_elements_text(COALESCE(p_risk_result->'patterns_detected', '[]'::jsonb)) AS elem;

  -- Get sender context
  SELECT
    EXTRACT(DAY FROM (now() - p.created_at))::int,
    COALESCE(COUNT(DISTINCT j.id), 0)
  INTO v_sender_age_days, v_completed_jobs
  FROM profiles p
  LEFT JOIN jobs j ON (j.customer_id = p.id OR j.accepted_mechanic_id = p.id)
    AND j.status = 'completed'
  WHERE p.id = v_sender_id
  GROUP BY p.created_at;

  -- Get recent violations
  SELECT COUNT(*)::int INTO v_recent_violations
  FROM user_violations
  WHERE user_id = v_sender_id
    AND created_at > now() - interval '30 days';

  -- Get job stage
  IF p_job_id IS NOT NULL THEN
    SELECT status INTO v_job_stage FROM jobs WHERE id = p_job_id;
  END IF;

  -- Insert audit log
  INSERT INTO message_audit_logs (
    message_id,
    conversation_id,
    sender_id,
    recipient_id,
    original_content,
    displayed_content,
    patterns_detected,
    risk_score,
    action_taken,
    job_id,
    job_stage,
    sender_account_age_days,
    sender_completed_jobs,
    sender_previous_violations,
    flagged_for_review
  ) VALUES (
    p_message_id,
    p_conversation_id,
    v_sender_id,
    p_recipient_id,
    p_original_content,
    p_displayed_content,
    v_patterns,
    COALESCE((p_risk_result->>'risk_score')::numeric, 0),
    p_action::message_action,
    p_job_id,
    v_job_stage,
    COALESCE(v_sender_age_days, 0),
    COALESCE(v_completed_jobs, 0),
    COALESCE(v_recent_violations, 0),
    COALESCE((p_risk_result->>'risk_score')::numeric, 0) >= 70
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;