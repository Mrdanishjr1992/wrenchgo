-- =====================================================
-- MIGRATION 0025: FIX RATING COLUMN REFERENCES
-- =====================================================
-- Purpose: Fix functions that reference 'rating' instead of 'overall_rating'
-- =====================================================

BEGIN;

-- =====================================================
-- FIX: submit_review function
-- =====================================================
CREATE OR REPLACE FUNCTION public.submit_review(
  p_job_id uuid,
  p_reviewer_id uuid,
  p_reviewee_id uuid,
  p_rating int,
  p_comment text DEFAULT NULL,
  p_professionalism_rating int DEFAULT NULL,
  p_communication_rating int DEFAULT NULL,
  p_would_recommend boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_review_id uuid;
  v_blind_deadline timestamptz;
  v_other_review_exists boolean;
  v_should_publish boolean := false;
  v_job_finalized_at timestamptz;
BEGIN
  -- Get job finalized timestamp
  SELECT jp.finalized_at INTO v_job_finalized_at
  FROM public.job_progress jp
  WHERE jp.job_id = p_job_id;
  
  IF v_job_finalized_at IS NULL THEN
    RAISE EXCEPTION 'Job not finalized yet';
  END IF;
  
  -- Set blind deadline to 7 days after job finalization
  v_blind_deadline := v_job_finalized_at + interval '7 days';
  
  -- Check if other party has already reviewed
  SELECT EXISTS(
    SELECT 1 FROM public.reviews
    WHERE job_id = p_job_id
      AND reviewer_id = p_reviewee_id
      AND reviewee_id = p_reviewer_id
  ) INTO v_other_review_exists;
  
  -- If both reviews exist, publish both immediately
  v_should_publish := v_other_review_exists;
  
  -- Insert or update review (using overall_rating column)
  INSERT INTO public.reviews (
    job_id,
    reviewer_id,
    reviewee_id,
    overall_rating,
    comment,
    professionalism_rating,
    communication_rating,
    would_recommend,
    visibility,
    blind_deadline,
    created_at,
    updated_at
  ) VALUES (
    p_job_id,
    p_reviewer_id,
    p_reviewee_id,
    p_rating,
    p_comment,
    p_professionalism_rating,
    p_communication_rating,
    p_would_recommend,
    CASE WHEN v_should_publish THEN 'visible'::review_visibility ELSE 'hidden'::review_visibility END,
    v_blind_deadline,
    now(),
    now()
  )
  ON CONFLICT (job_id, reviewer_id) 
  DO UPDATE SET
    overall_rating = EXCLUDED.overall_rating,
    comment = EXCLUDED.comment,
    professionalism_rating = EXCLUDED.professionalism_rating,
    communication_rating = EXCLUDED.communication_rating,
    would_recommend = EXCLUDED.would_recommend,
    updated_at = now()
  RETURNING id INTO v_review_id;
  
  -- If both reviews exist, publish both
  IF v_should_publish THEN
    UPDATE public.reviews
    SET 
      visibility = 'visible',
      made_visible_at = now(),
      visibility_reason = 'both_submitted'
    WHERE job_id = p_job_id
      AND visibility = 'hidden';
  END IF;
  
  -- Mark prompt as completed
  UPDATE public.review_prompts
  SET completed_at = now()
  WHERE job_id = p_job_id
    AND user_id = p_reviewer_id;
  
  RETURN jsonb_build_object(
    'review_id', v_review_id,
    'published', v_should_publish,
    'blind_deadline', v_blind_deadline
  );
END;
$$;

-- =====================================================
-- FIX: calculate_trust_score function
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_trust_score(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_rating_score int := 50;
  v_completion_score int := 100;
  v_reliability_score int := 50;
  v_badge_score int := 0;
  v_tenure_score int := 0;
  v_overall_score int;
  
  v_total_jobs int := 0;
  v_completed_jobs int := 0;
  v_cancelled_jobs int := 0;
  v_disputed_jobs int := 0;
  v_no_show_count int := 0;
  
  v_reviews_given int := 0;
  v_reviews_received int := 0;
  v_avg_rating_given numeric;
  v_avg_rating_received numeric;

  v_account_age_days int;
  v_completion_rate numeric;
  v_on_time_rate numeric;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- Calculate job stats
  IF v_user_role = 'mechanic' THEN
    SELECT
      COUNT(*) FILTER (WHERE jc.status IN ('active', 'completed')) as total,
      COUNT(*) FILTER (WHERE jc.status = 'completed') as completed,
      COUNT(*) FILTER (WHERE jc.status = 'cancelled') as cancelled,
      COUNT(*) FILTER (WHERE jc.status = 'disputed') as disputed
    INTO v_total_jobs, v_completed_jobs, v_cancelled_jobs, v_disputed_jobs
    FROM public.job_contracts jc
    WHERE jc.mechanic_id = p_user_id;
  ELSE
    SELECT
      COUNT(*) FILTER (WHERE j.status IN ('in_progress', 'work_in_progress', 'completed')) as total,
      COUNT(*) FILTER (WHERE j.status = 'completed') as completed,
      COUNT(*) FILTER (WHERE j.status = 'cancelled') as cancelled
    INTO v_total_jobs, v_completed_jobs, v_cancelled_jobs
    FROM public.jobs j
    WHERE j.customer_id = p_user_id;
  END IF;
  
  -- Calculate review stats (using overall_rating column)
  SELECT
    COUNT(*) FILTER (WHERE reviewer_id = p_user_id) as given,
    COUNT(*) FILTER (WHERE reviewee_id = p_user_id) as received,
    AVG(overall_rating) FILTER (WHERE reviewer_id = p_user_id) as avg_given,
    AVG(overall_rating) FILTER (WHERE reviewee_id = p_user_id) as avg_received
  INTO v_reviews_given, v_reviews_received, v_avg_rating_given, v_avg_rating_received
  FROM public.reviews
  WHERE (reviewer_id = p_user_id OR reviewee_id = p_user_id)
    AND visibility = 'visible';
  
  -- Calculate rating score (0-100)
  IF v_reviews_received > 0 THEN
    v_rating_score := LEAST(100, GREATEST(0, 
      ((v_avg_rating_received - 1) / 4.0 * 100)::int
    ));
  END IF;
  
  -- Calculate completion score (0-100)
  IF v_total_jobs > 0 THEN
    v_completion_rate := v_completed_jobs::numeric / v_total_jobs;
    v_completion_score := LEAST(100, (v_completion_rate * 100)::int);
  END IF;
  
  -- Calculate reliability score (0-100)
  IF v_user_role = 'mechanic' THEN
    SELECT
      COUNT(*) FILTER (WHERE jp.customer_confirmed_arrival_at IS NOT NULL) as confirmed,
      COUNT(*) as total
    INTO v_on_time_rate, v_total_jobs
    FROM public.job_progress jp
    JOIN public.job_contracts jc ON jc.job_id = jp.job_id
    WHERE jc.mechanic_id = p_user_id;
    
    IF v_total_jobs > 0 THEN
      v_on_time_rate := v_on_time_rate::numeric / v_total_jobs;
      v_reliability_score := LEAST(100, (v_on_time_rate * 100)::int);
    END IF;
  ELSE
    v_reliability_score := 50;
  END IF;
  
  -- Calculate badge score (0-100)
  SELECT COALESCE(SUM(
    CASE b.tier
      WHEN 1 THEN 5
      WHEN 2 THEN 10
      WHEN 3 THEN 20
      ELSE 0
    END
  ), 0)::int
  INTO v_badge_score
  FROM public.user_badges ub
  JOIN public.badges b ON b.id = ub.badge_id
  WHERE ub.user_id = p_user_id
    AND ub.revoked_at IS NULL
    AND b.is_active = true;
  
  v_badge_score := LEAST(100, v_badge_score);
  
  -- Calculate tenure score (0-100)
  SELECT EXTRACT(DAY FROM now() - created_at)::int
  INTO v_account_age_days
  FROM public.profiles
  WHERE id = p_user_id;
  
  v_tenure_score := LEAST(100, (v_account_age_days / 365.0 * 100)::int);
  
  -- Calculate overall score (weighted average)
  v_overall_score := (
    v_rating_score * 0.35 +
    v_completion_score * 0.25 +
    v_reliability_score * 0.20 +
    v_badge_score * 0.10 +
    v_tenure_score * 0.10
  )::int;
  
  -- Upsert trust score
  INSERT INTO public.trust_scores (
    user_id,
    overall_score,
    rating_score,
    completion_score,
    reliability_score,
    badge_score,
    tenure_score,
    total_jobs,
    completed_jobs,
    cancelled_jobs,
    disputed_jobs,
    no_show_count,
    reviews_given,
    reviews_received,
    avg_rating_given,
    avg_rating_received,
    last_calculated_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_overall_score,
    v_rating_score,
    v_completion_score,
    v_reliability_score,
    v_badge_score,
    v_tenure_score,
    v_total_jobs,
    v_completed_jobs,
    v_cancelled_jobs,
    v_disputed_jobs,
    v_no_show_count,
    v_reviews_given,
    v_reviews_received,
    v_avg_rating_given,
    v_avg_rating_received,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    rating_score = EXCLUDED.rating_score,
    completion_score = EXCLUDED.completion_score,
    reliability_score = EXCLUDED.reliability_score,
    badge_score = EXCLUDED.badge_score,
    tenure_score = EXCLUDED.tenure_score,
    total_jobs = EXCLUDED.total_jobs,
    completed_jobs = EXCLUDED.completed_jobs,
    cancelled_jobs = EXCLUDED.cancelled_jobs,
    disputed_jobs = EXCLUDED.disputed_jobs,
    no_show_count = EXCLUDED.no_show_count,
    reviews_given = EXCLUDED.reviews_given,
    reviews_received = EXCLUDED.reviews_received,
    avg_rating_given = EXCLUDED.avg_rating_given,
    avg_rating_received = EXCLUDED.avg_rating_received,
    last_calculated_at = now(),
    updated_at = now();
  
  -- Add to history
  INSERT INTO public.trust_score_history (
    user_id,
    overall_score,
    rating_score,
    completion_score,
    reliability_score,
    badge_score,
    tenure_score,
    snapshot_reason
  ) VALUES (
    p_user_id,
    v_overall_score,
    v_rating_score,
    v_completion_score,
    v_reliability_score,
    v_badge_score,
    v_tenure_score,
    'manual_calculation'
  );
  
  RETURN jsonb_build_object(
    'overall_score', v_overall_score,
    'rating_score', v_rating_score,
    'completion_score', v_completion_score,
    'reliability_score', v_reliability_score,
    'badge_score', v_badge_score,
    'tenure_score', v_tenure_score
  );
END;
$$;

-- =====================================================
-- FIX: evaluate_and_award_badges function
-- =====================================================
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
  v_review_count int;
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
      
      -- Average rating (using overall_rating column)
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
-- FIX: recalculate_trust_score function
-- =====================================================
CREATE OR REPLACE FUNCTION public.recalculate_trust_score(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role public.user_role;
  v_rating_score int := 50;
  v_completion_score int := 100;
  v_reliability_score int := 50;
  v_badge_score int := 0;
  v_tenure_score int := 0;
  v_overall_score int;
  
  v_total_jobs int := 0;
  v_completed_jobs int := 0;
  v_cancelled_jobs int := 0;
  v_disputed_jobs int := 0;
  v_reviews_received int := 0;
  v_avg_rating numeric;
  v_badge_count int := 0;
  v_account_age_days int;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role FROM public.profiles WHERE id = p_user_id;

  -- Calculate job stats based on role
  IF v_user_role = 'mechanic' THEN
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'completed'),
      COUNT(*) FILTER (WHERE status = 'cancelled'),
      COUNT(*) FILTER (WHERE status = 'disputed')
    INTO v_total_jobs, v_completed_jobs, v_cancelled_jobs, v_disputed_jobs
    FROM public.jobs
    WHERE accepted_mechanic_id = p_user_id;
  ELSE
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'completed'),
      COUNT(*) FILTER (WHERE status = 'cancelled'),
      COUNT(*) FILTER (WHERE status = 'disputed')
    INTO v_total_jobs, v_completed_jobs, v_cancelled_jobs, v_disputed_jobs
    FROM public.jobs
    WHERE customer_id = p_user_id;
  END IF;

  -- Calculate rating score (0-100) using overall_rating column
  SELECT COUNT(*), AVG(overall_rating)
  INTO v_reviews_received, v_avg_rating
  FROM public.reviews
  WHERE reviewee_id = p_user_id
    AND visibility = 'visible'
    AND is_hidden = false;

  IF v_reviews_received > 0 AND v_avg_rating IS NOT NULL THEN
    -- Convert 1-5 rating to 0-100 score
    v_rating_score := LEAST(100, GREATEST(0, ((v_avg_rating - 1) / 4.0 * 100)::int));
  END IF;

  -- Calculate completion score
  IF v_total_jobs > 0 THEN
    v_completion_score := LEAST(100, GREATEST(0, (v_completed_jobs::numeric / v_total_jobs * 100)::int));
  END IF;

  -- Calculate reliability score (penalize cancellations and disputes)
  IF v_total_jobs > 0 THEN
    v_reliability_score := LEAST(100, GREATEST(0, 
      100 - (v_cancelled_jobs * 10) - (v_disputed_jobs * 20)
    ));
  END IF;

  -- Calculate badge score (up to 20 points)
  SELECT COUNT(*) INTO v_badge_count
  FROM public.user_badges
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());
  
  v_badge_score := LEAST(20, v_badge_count * 4);

  -- Calculate tenure score (up to 10 points, 1 point per month, max 10 months)
  SELECT EXTRACT(DAY FROM (now() - created_at))::int
  INTO v_account_age_days
  FROM public.profiles
  WHERE id = p_user_id;

  v_tenure_score := LEAST(10, (v_account_age_days / 30));

  -- Calculate overall score (weighted average)
  v_overall_score := (
    (v_rating_score * 0.40) +
    (v_completion_score * 0.25) +
    (v_reliability_score * 0.20) +
    (v_badge_score * 0.50) +
    (v_tenure_score * 0.50)
  )::int;

  -- Ensure within bounds
  v_overall_score := LEAST(100, GREATEST(0, v_overall_score));

  -- Upsert trust score
  INSERT INTO public.trust_scores (
    user_id,
    overall_score,
    rating_score,
    completion_score,
    reliability_score,
    badge_score,
    tenure_score,
    total_jobs,
    completed_jobs,
    cancelled_jobs,
    disputed_jobs,
    reviews_received,
    avg_rating_received,
    last_calculated_at
  ) VALUES (
    p_user_id,
    v_overall_score,
    v_rating_score,
    v_completion_score,
    v_reliability_score,
    v_badge_score,
    v_tenure_score,
    v_total_jobs,
    v_completed_jobs,
    v_cancelled_jobs,
    v_disputed_jobs,
    v_reviews_received,
    v_avg_rating,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    rating_score = EXCLUDED.rating_score,
    completion_score = EXCLUDED.completion_score,
    reliability_score = EXCLUDED.reliability_score,
    badge_score = EXCLUDED.badge_score,
    tenure_score = EXCLUDED.tenure_score,
    total_jobs = EXCLUDED.total_jobs,
    completed_jobs = EXCLUDED.completed_jobs,
    cancelled_jobs = EXCLUDED.cancelled_jobs,
    disputed_jobs = EXCLUDED.disputed_jobs,
    reviews_received = EXCLUDED.reviews_received,
    avg_rating_received = EXCLUDED.avg_rating_received,
    last_calculated_at = now(),
    updated_at = now();

  -- Add to history
  INSERT INTO public.trust_score_history (
    user_id,
    overall_score,
    rating_score,
    completion_score,
    reliability_score,
    badge_score,
    tenure_score,
    snapshot_reason
  ) VALUES (
    p_user_id,
    v_overall_score,
    v_rating_score,
    v_completion_score,
    v_reliability_score,
    v_badge_score,
    v_tenure_score,
    'recalculation'
  );

  RETURN v_overall_score;
END;
$$;

COMMIT;
