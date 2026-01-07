-- =====================================================
-- MIGRATION 0013: BADGE AWARDING SYSTEM
-- =====================================================
-- Purpose: Automatic badge awarding and revocation logic
-- =====================================================

BEGIN;

-- =====================================================
-- FUNCTION: evaluate_and_award_badges
-- =====================================================
-- Evaluate all badge criteria for a user and award/revoke as needed
CREATE OR REPLACE FUNCTION public.evaluate_and_award_badges(
  p_user_id uuid,
  p_trigger_reason text DEFAULT 'manual',
  p_job_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badge_record RECORD;
  v_user_role text;
  v_meets_criteria boolean;
  v_current_value numeric;
  v_badges_awarded int := 0;
  v_badges_revoked int := 0;
  v_has_badge boolean;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Loop through all active badges
  FOR v_badge_record IN
    SELECT * FROM public.badges
    WHERE is_active = true
    ORDER BY display_priority ASC
  LOOP
    v_meets_criteria := false;
    v_current_value := 0;
    
    -- Evaluate criteria based on type
    CASE v_badge_record.criteria_type
      
      -- Jobs completed milestone
      WHEN 'jobs_completed' THEN
        IF v_user_role = 'mechanic' THEN
          SELECT COUNT(*)
          INTO v_current_value
          FROM public.job_contracts
          WHERE mechanic_id = p_user_id
            AND status = 'completed';
          
          v_meets_criteria := v_current_value >= v_badge_record.criteria_threshold;
        END IF;
      
      -- Average rating
      WHEN 'avg_rating' THEN
        SELECT COUNT(*)
        INTO v_review_count
        FROM public.reviews
        WHERE reviewee_id = p_user_id
          AND visibility = 'visible';

        -- Require minimum 5 reviews for rating badges
        IF v_review_count >= 5 THEN
          SELECT AVG(overall_rating)
          INTO v_current_value
          FROM public.reviews
          WHERE reviewee_id = p_user_id
            AND visibility = 'visible';

          v_meets_criteria := v_current_value >= v_badge_record.criteria_threshold;
        END IF;
      
      -- Recommend rate
      WHEN 'recommend_rate' THEN
        WITH recommend_stats AS (
          SELECT
            COUNT(*) FILTER (WHERE would_recommend = true) as recommend_count,
            COUNT(*) as total_count
          FROM public.reviews
          WHERE reviewee_id = p_user_id
            AND visibility = 'visible'
            AND would_recommend IS NOT NULL
        )
        SELECT
          CASE WHEN total_count > 0 
            THEN (recommend_count::numeric / total_count * 100)
            ELSE 0
          END
        INTO v_current_value
        FROM recommend_stats;
        
        v_meets_criteria := v_current_value >= v_badge_record.criteria_threshold;
      
      -- On-time arrival rate
      WHEN 'on_time_rate' THEN
        IF v_user_role = 'mechanic' THEN
          WITH on_time_stats AS (
            SELECT
              COUNT(*) FILTER (WHERE jp.customer_confirmed_arrival_at IS NOT NULL) as on_time_count,
              COUNT(*) as total_count
            FROM public.job_progress jp
            JOIN public.job_contracts jc ON jc.job_id = jp.job_id
            WHERE jc.mechanic_id = p_user_id
              AND jc.status IN ('active', 'completed')
          )
          SELECT
            CASE WHEN total_count > 0
              THEN (on_time_count::numeric / total_count * 100)
              ELSE 0
            END
          INTO v_current_value
          FROM on_time_stats;

          v_meets_criteria := v_current_value >= v_badge_record.criteria_threshold;
        END IF;

      -- Completion rate
      WHEN 'completion_rate' THEN
        IF v_user_role = 'mechanic' THEN
          WITH completion_stats AS (
            SELECT
              COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
              COUNT(*) FILTER (WHERE status IN ('active', 'completed', 'cancelled')) as total_count
            FROM public.job_contracts
            WHERE mechanic_id = p_user_id
          )
          SELECT
            CASE WHEN total_count > 0
              THEN (completed_count::numeric / total_count * 100)
              ELSE 0
            END
          INTO v_current_value
          FROM completion_stats;

          v_meets_criteria := v_current_value >= v_badge_record.criteria_threshold;
        END IF;

      -- Response time (average minutes to quote)
      WHEN 'response_time' THEN
        IF v_user_role = 'mechanic' THEN
          SELECT AVG(EXTRACT(EPOCH FROM (q.created_at - j.created_at)) / 60)
          INTO v_current_value
          FROM public.quotes q
          JOIN public.jobs j ON j.id = q.job_id
          WHERE q.mechanic_id = p_user_id
            AND q.created_at >= now() - interval '30 days';
          
          v_meets_criteria := v_current_value <= v_badge_record.criteria_threshold;
        END IF;
      
      -- Skill jobs (verified jobs for a skill)
      WHEN 'skill_jobs' THEN
        IF v_user_role = 'mechanic' THEN
          SELECT MAX(verified_job_count)
          INTO v_current_value
          FROM public.mechanic_skills
          WHERE mechanic_id = p_user_id;
          
          v_meets_criteria := v_current_value >= v_badge_record.criteria_threshold;
        END IF;
      
      -- Verified skills count
      WHEN 'verified_skills' THEN
        IF v_user_role = 'mechanic' THEN
          SELECT COUNT(*)
          INTO v_current_value
          FROM public.mechanic_skills
          WHERE mechanic_id = p_user_id
            AND is_verified = true;
          
          v_meets_criteria := v_current_value >= v_badge_record.criteria_threshold;
        END IF;
      
      -- Top percentile (requires additional context)
      WHEN 'top_percentile' THEN
        -- TODO: Implement regional ranking logic
        v_meets_criteria := false;
      
      -- Manual badges (admin-only)
      WHEN 'manual' THEN
        v_meets_criteria := false;
      
      ELSE
        v_meets_criteria := false;
    END CASE;
    
    -- Check if user already has this badge
    SELECT EXISTS(
      SELECT 1 FROM public.user_badges
      WHERE user_id = p_user_id
        AND badge_id = v_badge_record.id
        AND revoked_at IS NULL
    ) INTO v_has_badge;
    
    -- Award or revoke badge
    IF v_meets_criteria AND NOT v_has_badge THEN
      -- Award badge
      INSERT INTO public.user_badges (
        user_id,
        badge_id,
        awarded_at,
        awarded_reason,
        job_id
      ) VALUES (
        p_user_id,
        v_badge_record.id,
        now(),
        p_trigger_reason,
        p_job_id
      )
      ON CONFLICT (user_id, badge_id) 
      DO UPDATE SET
        revoked_at = NULL,
        revoked_reason = NULL,
        awarded_at = now(),
        awarded_reason = p_trigger_reason;
      
      -- Log to history
      INSERT INTO public.badge_history (
        user_id,
        badge_id,
        action,
        reason,
        job_id,
        metadata
      ) VALUES (
        p_user_id,
        v_badge_record.id,
        'awarded',
        p_trigger_reason,
        p_job_id,
        jsonb_build_object('current_value', v_current_value, 'threshold', v_badge_record.criteria_threshold)
      );
      
      v_badges_awarded := v_badges_awarded + 1;
      
    ELSIF NOT v_meets_criteria AND v_has_badge THEN
      -- Revoke badge
      UPDATE public.user_badges
      SET
        revoked_at = now(),
        revoked_reason = 'criteria_no_longer_met'
      WHERE user_id = p_user_id
        AND badge_id = v_badge_record.id
        AND revoked_at IS NULL;
      
      -- Log to history
      INSERT INTO public.badge_history (
        user_id,
        badge_id,
        action,
        reason,
        metadata
      ) VALUES (
        p_user_id,
        v_badge_record.id,
        'revoked',
        'criteria_no_longer_met',
        jsonb_build_object('current_value', v_current_value, 'threshold', v_badge_record.criteria_threshold)
      );
      
      v_badges_revoked := v_badges_revoked + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'badges_awarded', v_badges_awarded,
    'badges_revoked', v_badges_revoked
  );
END;
$$;

-- =====================================================
-- FUNCTION: manually_award_badge
-- =====================================================
-- Admin function to manually award a badge
CREATE OR REPLACE FUNCTION public.manually_award_badge(
  p_user_id uuid,
  p_badge_code text,
  p_reason text,
  p_admin_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badge_id uuid;
  v_user_badge_id uuid;
BEGIN
  -- Get badge ID
  SELECT id INTO v_badge_id
  FROM public.badges
  WHERE code = p_badge_code;
  
  IF v_badge_id IS NULL THEN
    RAISE EXCEPTION 'Badge not found: %', p_badge_code;
  END IF;
  
  -- Award badge
  INSERT INTO public.user_badges (
    user_id,
    badge_id,
    awarded_at,
    awarded_reason
  ) VALUES (
    p_user_id,
    v_badge_id,
    now(),
    p_reason
  )
  ON CONFLICT (user_id, badge_id) 
  DO UPDATE SET
    revoked_at = NULL,
    revoked_reason = NULL,
    awarded_at = now(),
    awarded_reason = p_reason
  RETURNING id INTO v_user_badge_id;
  
  -- Log to history
  INSERT INTO public.badge_history (
    user_id,
    badge_id,
    action,
    reason,
    triggered_by
  ) VALUES (
    p_user_id,
    v_badge_id,
    'awarded',
    p_reason,
    p_admin_id
  );
  
  RETURN v_user_badge_id;
END;
$$;

-- =====================================================
-- FUNCTION: manually_revoke_badge
-- =====================================================
-- Admin function to manually revoke a badge
CREATE OR REPLACE FUNCTION public.manually_revoke_badge(
  p_user_id uuid,
  p_badge_code text,
  p_reason text,
  p_admin_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badge_id uuid;
BEGIN
  -- Get badge ID
  SELECT id INTO v_badge_id
  FROM public.badges
  WHERE code = p_badge_code;
  
  IF v_badge_id IS NULL THEN
    RAISE EXCEPTION 'Badge not found: %', p_badge_code;
  END IF;
  
  -- Revoke badge
  UPDATE public.user_badges
  SET
    revoked_at = now(),
    revoked_reason = p_reason
  WHERE user_id = p_user_id
    AND badge_id = v_badge_id
    AND revoked_at IS NULL;
  
  -- Log to history
  INSERT INTO public.badge_history (
    user_id,
    badge_id,
    action,
    reason,
    triggered_by
  ) VALUES (
    p_user_id,
    v_badge_id,
    'revoked',
    p_reason,
    p_admin_id
  );
  
  RETURN true;
END;
$$;

COMMIT;
