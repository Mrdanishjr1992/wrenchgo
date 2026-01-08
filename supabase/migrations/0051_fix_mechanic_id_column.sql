-- Fix: jobs table uses accepted_mechanic_id, not mechanic_id

BEGIN;

CREATE OR REPLACE FUNCTION public.calculate_message_risk(
  p_message_text text,
  p_sender_id uuid,
  p_job_id uuid,
  p_job_stage text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detection_result jsonb;
  v_is_legitimate boolean;
  v_sender_age_days int;
  v_completed_jobs int;
  v_recent_violations int;
  v_final_risk_score numeric;
  v_action public.message_action;
  v_restriction_level text;
BEGIN
  v_detection_result := detect_contact_info(p_message_text);
  v_is_legitimate := check_legitimate_patterns(p_message_text);
  
  IF v_is_legitimate THEN
    RETURN jsonb_build_object(
      'risk_level', 'low',
      'risk_score', 0,
      'action', 'allowed',
      'patterns_detected', '{}',
      'reason', 'legitimate_pattern'
    );
  END IF;
  
  IF NOT (v_detection_result->>'has_contact_info')::boolean THEN
    RETURN jsonb_build_object(
      'risk_level', 'low',
      'risk_score', 0,
      'action', 'allowed',
      'patterns_detected', '{}',
      'reason', 'no_contact_info'
    );
  END IF;
  
  -- Get sender context - use accepted_mechanic_id instead of mechanic_id
  SELECT 
    EXTRACT(DAY FROM (now() - p.created_at))::int,
    COALESCE(COUNT(DISTINCT j.id), 0)
  INTO v_sender_age_days, v_completed_jobs
  FROM profiles p
  LEFT JOIN jobs j ON (j.customer_id = p.id OR j.accepted_mechanic_id = p.id) 
    AND j.status = 'completed'
  WHERE p.id = p_sender_id
  GROUP BY p.created_at;
  
  SELECT COUNT(*)::int
  INTO v_recent_violations
  FROM user_violations
  WHERE user_id = p_sender_id
    AND created_at > now() - interval '30 days';
  
  v_final_risk_score := (v_detection_result->>'risk_score')::numeric;
  
  IF v_sender_age_days < 7 THEN
    v_final_risk_score := v_final_risk_score + 15;
  END IF;
  
  IF v_completed_jobs = 0 THEN
    v_final_risk_score := v_final_risk_score + 10;
  ELSIF v_completed_jobs >= 10 THEN
    v_final_risk_score := v_final_risk_score - 15;
  END IF;
  
  IF v_recent_violations > 0 THEN
    v_final_risk_score := v_final_risk_score + (v_recent_violations * 10);
  END IF;
  
  IF p_job_stage IN ('lead', 'quote_submitted') THEN
    v_final_risk_score := v_final_risk_score + 20;
  ELSIF p_job_stage IN ('booked', 'in_progress') THEN
    v_final_risk_score := v_final_risk_score - 20;
  ELSIF p_job_stage = 'completed' THEN
    v_final_risk_score := v_final_risk_score + 10;
  END IF;
  
  v_final_risk_score := LEAST(v_final_risk_score, 100);
  
  IF v_final_risk_score >= 70 THEN
    IF p_job_stage IN ('lead', 'quote_submitted') THEN
      v_action := 'blocked';
      v_restriction_level := 'high';
    ELSE
      v_action := 'warned';
      v_restriction_level := 'medium';
    END IF;
  ELSIF v_final_risk_score >= 40 THEN
    IF p_job_stage IN ('lead', 'quote_submitted') THEN
      v_action := 'blocked';
      v_restriction_level := 'medium';
    ELSIF p_job_stage = 'completed' THEN
      v_action := 'masked';
      v_restriction_level := 'medium';
    ELSE
      v_action := 'warned';
      v_restriction_level := 'low';
    END IF;
  ELSE
    v_action := 'allowed';
    v_restriction_level := 'low';
  END IF;
  
  RETURN jsonb_build_object(
    'risk_level', v_restriction_level,
    'risk_score', v_final_risk_score,
    'action', v_action,
    'patterns_detected', v_detection_result->'patterns_detected',
    'sender_age_days', v_sender_age_days,
    'completed_jobs', v_completed_jobs,
    'recent_violations', v_recent_violations,
    'job_stage', p_job_stage
  );
END;
$$;

COMMIT;