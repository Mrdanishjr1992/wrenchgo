-- =====================================================
-- MIGRATION 0048: CHAT MODERATION RPC FUNCTIONS
-- =====================================================
-- Purpose: RPC functions for message scanning, enforcement, and preferred mechanics
-- =====================================================

BEGIN;

-- =====================================================
-- FUNCTION: scan_message_before_send
-- =====================================================
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
  -- Get authenticated user
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check for active chat restrictions
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
  
  -- Get job stage if job_id provided
  IF p_job_id IS NOT NULL THEN
    SELECT status INTO v_job_stage
    FROM jobs
    WHERE id = p_job_id;
  END IF;
  
  -- Calculate risk
  v_risk_result := calculate_message_risk(
    p_message_text,
    v_sender_id,
    p_job_id,
    COALESCE(v_job_stage, 'unknown')
  );
  
  -- Determine response based on action
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
      -- Mask contact info in message
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
      
    ELSE -- 'allowed'
      RETURN jsonb_build_object(
        'allowed', true,
        'action', 'allowed',
        'risk_score', v_risk_result->'risk_score'
      );
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.scan_message_before_send TO authenticated;

COMMENT ON FUNCTION public.scan_message_before_send IS 'Scan message for contact info before sending, return action to take';

-- =====================================================
-- FUNCTION: log_message_audit
-- =====================================================
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

  -- Parse patterns from JSONB array to text[]
  SELECT COALESCE(array_agg(elem::text), '{}')
  INTO v_patterns
  FROM jsonb_array_elements_text(COALESCE(p_risk_result->'patterns_detected', '[]'::jsonb)) AS elem;

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

GRANT EXECUTE ON FUNCTION public.log_message_audit TO authenticated;

COMMENT ON FUNCTION public.log_message_audit IS 'Log message audit trail for moderation';

-- =====================================================
-- FUNCTION: record_violation
-- =====================================================
CREATE OR REPLACE FUNCTION public.record_violation(
  p_user_id uuid,
  p_violation_type text,
  p_description text DEFAULT NULL,
  p_message_audit_log_id uuid DEFAULT NULL,
  p_job_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_violation_id uuid;
  v_violation_counts jsonb;
  v_tier public.violation_tier;
  v_expires_at timestamptz;
BEGIN
  -- Get current violation counts
  v_violation_counts := get_user_violation_count(p_user_id);
  
  -- Determine tier and expiration
  CASE (v_violation_counts->>'current_tier')::violation_tier
    WHEN 'education' THEN
      v_tier := 'education';
      v_expires_at := NULL; -- No expiration for education
    WHEN 'warning' THEN
      v_tier := 'warning';
      v_expires_at := now() + interval '7 days';
    WHEN 'restriction' THEN
      v_tier := 'restriction';
      v_expires_at := now() + interval '24 hours';
    WHEN 'review' THEN
      v_tier := 'review';
      v_expires_at := NULL; -- Requires human review
  END CASE;
  
  -- Insert violation
  INSERT INTO user_violations (
    user_id,
    violation_type,
    tier,
    description,
    message_audit_log_id,
    job_id,
    expires_at
  ) VALUES (
    p_user_id,
    p_violation_type,
    v_tier,
    p_description,
    p_message_audit_log_id,
    p_job_id,
    v_expires_at
  )
  RETURNING id INTO v_violation_id;
  
  -- Apply chat restriction if needed
  IF v_tier = 'restriction' THEN
    INSERT INTO chat_restrictions (
      user_id,
      restriction_type,
      reason,
      expires_at
    ) VALUES (
      p_user_id,
      'templated_only',
      'Repeated policy violations',
      now() + interval '24 hours'
    );
  ELSIF v_tier = 'review' THEN
    INSERT INTO chat_restrictions (
      user_id,
      restriction_type,
      reason,
      requires_human_review
    ) VALUES (
      p_user_id,
      'suspended',
      'Multiple violations - account under review',
      true
    );
  END IF;
  
  RETURN v_violation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_violation TO authenticated;

COMMENT ON FUNCTION public.record_violation IS 'Record user violation and apply progressive enforcement';

-- =====================================================
-- FUNCTION: update_preferred_mechanic
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_preferred_mechanic(
  p_customer_id uuid,
  p_mechanic_id uuid,
  p_job_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_total_cents bigint;
  v_job_rating numeric;
  v_new_jobs_completed int;
  v_new_total_spent bigint;
  v_new_commission_tier int;
  v_old_commission_tier int;
BEGIN
  -- Get job details
  SELECT 
    total_cost_cents,
    (SELECT overall_rating FROM reviews WHERE job_id = p_job_id AND reviewee_id = p_mechanic_id LIMIT 1)
  INTO v_job_total_cents, v_job_rating
  FROM jobs
  WHERE id = p_job_id;
  
  -- Insert or update preferred mechanic relationship
  INSERT INTO preferred_mechanics (
    customer_id,
    mechanic_id,
    jobs_completed,
    total_spent_cents,
    avg_rating,
    last_job_at,
    commission_tier
  ) VALUES (
    p_customer_id,
    p_mechanic_id,
    1,
    v_job_total_cents,
    v_job_rating,
    now(),
    1
  )
  ON CONFLICT (customer_id, mechanic_id)
  DO UPDATE SET
    jobs_completed = preferred_mechanics.jobs_completed + 1,
    total_spent_cents = preferred_mechanics.total_spent_cents + v_job_total_cents,
    avg_rating = CASE 
      WHEN v_job_rating IS NOT NULL THEN
        (COALESCE(preferred_mechanics.avg_rating, 0) * preferred_mechanics.jobs_completed + v_job_rating) / (preferred_mechanics.jobs_completed + 1)
      ELSE
        preferred_mechanics.avg_rating
    END,
    last_job_at = now(),
    updated_at = now()
  RETURNING jobs_completed, total_spent_cents, commission_tier INTO v_new_jobs_completed, v_new_total_spent, v_old_commission_tier;
  
  -- Calculate new commission tier based on jobs completed
  v_new_commission_tier := CASE
    WHEN v_new_jobs_completed >= 10 THEN 5  -- 8% commission
    WHEN v_new_jobs_completed >= 4 THEN 4   -- 10% commission
    WHEN v_new_jobs_completed >= 2 THEN 3   -- 15% commission
    ELSE 1                                   -- 20% commission
  END;
  
  -- Update commission tier if changed
  IF v_new_commission_tier != v_old_commission_tier THEN
    UPDATE preferred_mechanics
    SET 
      commission_tier = v_new_commission_tier,
      priority_scheduling = v_new_jobs_completed >= 3
    WHERE customer_id = p_customer_id
      AND mechanic_id = p_mechanic_id;
  END IF;
  
  RETURN jsonb_build_object(
    'jobs_completed', v_new_jobs_completed,
    'total_spent_cents', v_new_total_spent,
    'commission_tier', v_new_commission_tier,
    'commission_rate', CASE v_new_commission_tier
      WHEN 5 THEN 0.08
      WHEN 4 THEN 0.10
      WHEN 3 THEN 0.15
      ELSE 0.20
    END,
    'tier_upgraded', v_new_commission_tier > v_old_commission_tier,
    'has_priority_scheduling', v_new_jobs_completed >= 3
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_preferred_mechanic TO authenticated;

COMMENT ON FUNCTION public.update_preferred_mechanic IS 'Update preferred mechanic relationship and commission tier after job completion';

-- =====================================================
-- FUNCTION: get_preferred_mechanics
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_preferred_mechanics(p_customer_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_result jsonb;
BEGIN
  v_customer_id := COALESCE(p_customer_id, auth.uid());
  
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'mechanic_id', pm.mechanic_id,
      'mechanic', jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'avatar_url', p.avatar_url
      ),
      'jobs_completed', pm.jobs_completed,
      'total_spent_cents', pm.total_spent_cents,
      'avg_rating', pm.avg_rating,
      'last_job_at', pm.last_job_at,
      'commission_tier', pm.commission_tier,
      'commission_rate', CASE pm.commission_tier
        WHEN 5 THEN 0.08
        WHEN 4 THEN 0.10
        WHEN 3 THEN 0.15
        ELSE 0.20
      END,
      'has_priority_scheduling', pm.priority_scheduling
    ) ORDER BY pm.jobs_completed DESC, pm.last_job_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM preferred_mechanics pm
  INNER JOIN profiles p ON p.id = pm.mechanic_id
  WHERE pm.customer_id = v_customer_id
    AND pm.is_active = true;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_preferred_mechanics TO authenticated;

COMMENT ON FUNCTION public.get_preferred_mechanics IS 'Get list of preferred mechanics for customer with commission tiers';

-- =====================================================
-- FUNCTION: get_chat_status
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_chat_status(
  p_conversation_id uuid,
  p_job_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_job_status text;
  v_job_completed_at timestamptz;
  v_lifecycle record;
  v_restriction record;
  v_chat_state text;
  v_can_send boolean;
  v_restriction_message text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get job status
  SELECT status, completed_at
  INTO v_job_status, v_job_completed_at
  FROM jobs
  WHERE id = p_job_id;
  
  -- Get lifecycle config
  SELECT * INTO v_lifecycle
  FROM chat_lifecycle_config
  WHERE conversation_id = p_conversation_id;
  
  -- Get active restriction
  SELECT * INTO v_restriction
  FROM chat_restrictions
  WHERE user_id = v_user_id
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Determine chat state
  IF v_restriction.restriction_type = 'suspended' THEN
    v_chat_state := 'suspended';
    v_can_send := false;
    v_restriction_message := 'Your account is under review. Please contact support.';
  ELSIF v_restriction.restriction_type = 'templated_only' THEN
    v_chat_state := 'templated_only';
    v_can_send := false;
    v_restriction_message := 'Your chat access is temporarily limited. Please use quick action buttons.';
  ELSIF v_lifecycle.has_safety_issue OR v_lifecycle.has_dispute THEN
    v_chat_state := 'support_only';
    v_can_send := false;
    v_restriction_message := 'This conversation is being handled by support.';
  ELSIF v_job_status = 'completed' THEN
    IF v_job_completed_at + interval '48 hours' > now() THEN
      v_chat_state := 'post_completion_active';
      v_can_send := true;
      v_restriction_message := NULL;
    ELSIF v_job_completed_at + interval '30 days' > now() THEN
      v_chat_state := 'read_only';
      v_can_send := false;
      v_restriction_message := 'This conversation is now read-only. Use the Rebook button to work together again!';
    ELSE
      v_chat_state := 'archived';
      v_can_send := false;
      v_restriction_message := 'This conversation is archived. You can still view messages and file warranty claims.';
    END IF;
  ELSIF v_job_status IN ('booked', 'in_progress') THEN
    v_chat_state := 'active';
    v_can_send := true;
    v_restriction_message := NULL;
  ELSIF v_job_status IN ('lead', 'quote_submitted') THEN
    v_chat_state := 'pre_booking';
    v_can_send := true;
    v_restriction_message := NULL;
  ELSE
    v_chat_state := 'unknown';
    v_can_send := false;
    v_restriction_message := 'Unable to determine chat status.';
  END IF;
  
  RETURN jsonb_build_object(
    'chat_state', v_chat_state,
    'can_send_messages', v_can_send,
    'restriction_message', v_restriction_message,
    'job_status', v_job_status,
    'has_active_restriction', v_restriction.id IS NOT NULL,
    'restriction_expires_at', v_restriction.expires_at,
    'show_rebook_button', v_chat_state IN ('read_only', 'archived', 'post_completion_active'),
    'show_support_button', v_chat_state IN ('read_only', 'archived'),
    'show_warranty_button', v_chat_state IN ('read_only', 'archived')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_status TO authenticated;

COMMENT ON FUNCTION public.get_chat_status IS 'Get current chat status and restrictions for conversation';

COMMIT;
