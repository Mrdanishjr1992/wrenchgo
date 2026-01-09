-- Fix job stage values in moderation functions to match actual job statuses

-- Fix calculate_message_risk
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
  
  -- Use actual job statuses: searching, quoted, accepted, work_in_progress, completed, canceled
  IF p_job_stage IN ('searching', 'quoted') THEN
    v_final_risk_score := v_final_risk_score + 20;
  ELSIF p_job_stage IN ('accepted', 'work_in_progress') THEN
    v_final_risk_score := v_final_risk_score - 20;
  ELSIF p_job_stage = 'completed' THEN
    v_final_risk_score := v_final_risk_score + 10;
  END IF;
  
  v_final_risk_score := LEAST(v_final_risk_score, 100);
  
  IF v_final_risk_score >= 70 THEN
    IF p_job_stage IN ('searching', 'quoted') THEN
      v_action := 'blocked';
      v_restriction_level := 'high';
    ELSE
      v_action := 'warned';
      v_restriction_level := 'medium';
    END IF;
  ELSIF v_final_risk_score >= 40 THEN
    IF p_job_stage IN ('searching', 'quoted') THEN
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
    'sender_context', jsonb_build_object(
      'account_age_days', v_sender_age_days,
      'completed_jobs', v_completed_jobs,
      'recent_violations', v_recent_violations
    ),
    'job_stage', p_job_stage
  );
END;
$$;

-- Fix scan_message_before_send
CREATE OR REPLACE FUNCTION public.scan_message_before_send(
  p_message_text text,
  p_recipient_id uuid,
  p_job_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid;
  v_job_stage text;
  v_risk_result jsonb;
  v_active_restriction record;
  v_masked_content text;
BEGIN
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT * INTO v_active_restriction
  FROM chat_restrictions
  WHERE user_id = v_sender_id
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_active_restriction.restriction_type = 'suspended' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'action', 'blocked',
      'reason', 'account_suspended',
      'message', 'Your account is under review. Please contact support.',
      'requires_human_review', true
    );
  END IF;
  
  IF v_active_restriction.restriction_type = 'templated_only' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'action', 'blocked',
      'reason', 'templated_only',
      'message', 'Your chat access is temporarily limited. Please use quick action buttons.',
      'restriction_expires_at', v_active_restriction.expires_at
    );
  END IF;
  
  IF p_job_id IS NOT NULL THEN
    SELECT status INTO v_job_stage
    FROM jobs
    WHERE id = p_job_id;
  END IF;
  
  v_risk_result := calculate_message_risk(
    p_message_text,
    v_sender_id,
    p_job_id,
    COALESCE(v_job_stage, 'unknown')
  );
  
  CASE (v_risk_result->>'action')::message_action
    WHEN 'blocked' THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'action', 'blocked',
        'reason', 'contact_info_detected',
        'risk_score', v_risk_result->'risk_score',
        'patterns_detected', v_risk_result->'patterns_detected',
        'message', CASE 
          WHEN v_job_stage IN ('searching', 'quoted') THEN
            'For your protection, please keep all communication in WrenchGo until the job is booked. This ensures payment protection, job history, and support if anything goes wrong.'
          ELSE
            'We detected contact information in your message. For warranty coverage and payment protection, keep future bookings through WrenchGo.'
        END,
        'show_rebook_button', v_job_stage = 'completed'
      );
      
    WHEN 'masked' THEN
      v_masked_content := p_message_text;
      v_masked_content := regexp_replace(v_masked_content, '(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', '[Contact Hidden]', 'g');
      v_masked_content := regexp_replace(v_masked_content, '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[Email Hidden]', 'g');
      
      RETURN jsonb_build_object(
        'allowed', true,
        'action', 'masked',
        'original_content', p_message_text,
        'masked_content', v_masked_content,
        'risk_score', v_risk_result->'risk_score',
        'patterns_detected', v_risk_result->'patterns_detected',
        'message', 'Contact info has been hidden. Use the Rebook button to work with this person again!',
        'show_rebook_button', true
      );
      
    WHEN 'warned' THEN
      RETURN jsonb_build_object(
        'allowed', true,
        'action', 'warned',
        'risk_score', v_risk_result->'risk_score',
        'patterns_detected', v_risk_result->'patterns_detected',
        'warning_message', 'Sharing contact info? For warranty coverage and payment protection, keep future bookings through WrenchGo.',
        'show_soft_warning', true
      );
      
    ELSE
      RETURN jsonb_build_object(
        'allowed', true,
        'action', 'allowed',
        'risk_score', v_risk_result->'risk_score'
      );
  END CASE;
END;
$$;