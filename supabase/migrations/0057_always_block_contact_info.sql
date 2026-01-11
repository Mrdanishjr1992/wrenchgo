-- Block contact info at all job stages

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
  
  v_final_risk_score := (v_detection_result->>'risk_score')::numeric;
  
  -- Contact info detected = always block
  IF v_final_risk_score >= 30 THEN
    v_action := 'blocked';
    v_restriction_level := 'high';
  ELSE
    v_action := 'allowed';
    v_restriction_level := 'low';
  END IF;
  
  RETURN jsonb_build_object(
    'risk_level', v_restriction_level,
    'risk_score', v_final_risk_score,
    'action', v_action,
    'patterns_detected', v_detection_result->'patterns_detected',
    'job_stage', p_job_stage
  );
END;
$$;