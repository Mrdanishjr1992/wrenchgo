-- =====================================================
-- MIGRATION 0013: TRUST SYSTEM FUNCTIONS
-- =====================================================

BEGIN;

-- =====================================================
-- CONSTANTS
-- =====================================================
-- Blind review reveal timeout: 14 days
-- Skill verification threshold: 3 jobs
-- Review prompt expiry: 14 days

-- =====================================================
-- FUNCTION: submit_review
-- =====================================================
-- Submit a review with blind enforcement
CREATE OR REPLACE FUNCTION public.submit_review(
  p_job_id uuid,
  p_reviewee_id uuid,
  p_overall_rating int,
  p_performance_rating int DEFAULT NULL,
  p_timing_rating int DEFAULT NULL,
  p_cost_rating int DEFAULT NULL,
  p_professionalism_rating int DEFAULT NULL,
  p_communication_rating int DEFAULT NULL,
  p_comment text DEFAULT NULL,
  p_would_recommend boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer_id uuid := auth.uid();
  v_reviewer_role public.user_role;
  v_reviewee_role public.user_role;
  v_job record;
  v_existing_review_id uuid;
  v_other_review_exists boolean;
  v_review_id uuid;
  v_blind_deadline timestamptz;
BEGIN
  -- Validate ratings
  IF p_overall_rating < 1 OR p_overall_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Overall rating must be between 1 and 5');
  END IF;

  -- Get job details
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  
  IF v_job IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Verify job is completed
  IF v_job.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only review completed jobs');
  END IF;

  -- Determine reviewer role and validate participation
  IF v_reviewer_id = v_job.customer_id THEN
    v_reviewer_role := 'customer';
    IF p_reviewee_id != v_job.accepted_mechanic_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid reviewee for this job');
    END IF;
  ELSIF v_reviewer_id = v_job.accepted_mechanic_id THEN
    v_reviewer_role := 'mechanic';
    IF p_reviewee_id != v_job.customer_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid reviewee for this job');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'You are not a participant in this job');
  END IF;

  -- Get reviewee role
  SELECT role INTO v_reviewee_role FROM public.profiles WHERE id = p_reviewee_id;

  -- Check for existing review
  SELECT id INTO v_existing_review_id 
  FROM public.reviews 
  WHERE job_id = p_job_id AND reviewer_id = v_reviewer_id;

  IF v_existing_review_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already reviewed this job');
  END IF;

  -- Set blind deadline (14 days from now)
  v_blind_deadline := now() + interval '14 days';

  -- Check if other party has already submitted a review
  SELECT EXISTS(
    SELECT 1 FROM public.reviews 
    WHERE job_id = p_job_id AND reviewer_id = p_reviewee_id
  ) INTO v_other_review_exists;

  -- Insert the review
  INSERT INTO public.reviews (
    job_id,
    reviewer_id,
    reviewee_id,
    reviewer_role,
    overall_rating,
    performance_rating,
    timing_rating,
    cost_rating,
    professionalism_rating,
    communication_rating,
    comment,
    would_recommend,
    visibility,
    blind_deadline,
    moderation_status
  ) VALUES (
    p_job_id,
    v_reviewer_id,
    p_reviewee_id,
    v_reviewer_role,
    p_overall_rating,
    p_performance_rating,
    p_timing_rating,
    p_cost_rating,
    p_professionalism_rating,
    p_communication_rating,
    p_comment,
    p_would_recommend,
    'hidden',
    v_blind_deadline,
    'approved'
  )
  RETURNING id INTO v_review_id;

  -- Mark review prompt as completed
  UPDATE public.review_prompts
  SET completed_at = now()
  WHERE job_id = p_job_id AND user_id = v_reviewer_id;

  -- If both reviews exist, reveal them both
  IF v_other_review_exists THEN
    PERFORM public.reveal_reviews_for_job(p_job_id);
  END IF;

  -- Trigger trust score recalculation for reviewee
  PERFORM public.recalculate_trust_score(p_reviewee_id);

  -- Update mechanic_profiles rating if reviewee is mechanic
  IF v_reviewee_role = 'mechanic' THEN
    PERFORM public.update_mechanic_rating_stats(p_reviewee_id);
  END IF;

  -- Check and award badges
  PERFORM public.check_and_award_badges(p_reviewee_id);

  RETURN jsonb_build_object(
    'success', true,
    'review_id', v_review_id,
    'is_visible', v_other_review_exists
  );
END;
$$;

-- =====================================================
-- FUNCTION: reveal_reviews_for_job
-- =====================================================
-- Make both reviews visible for a job
CREATE OR REPLACE FUNCTION public.reveal_reviews_for_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reviews
  SET 
    visibility = 'visible',
    made_visible_at = now(),
    visibility_reason = 'both_submitted'
  WHERE job_id = p_job_id 
    AND visibility = 'hidden';
END;
$$;

-- =====================================================
-- FUNCTION: reveal_expired_blind_reviews
-- =====================================================
-- Called by cron job to reveal reviews past deadline
CREATE OR REPLACE FUNCTION public.reveal_expired_blind_reviews()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH revealed AS (
    UPDATE public.reviews
    SET 
      visibility = 'visible',
      made_visible_at = now(),
      visibility_reason = 'deadline_passed'
    WHERE visibility = 'hidden'
      AND blind_deadline IS NOT NULL
      AND blind_deadline < now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM revealed;

  RETURN v_count;
END;
$$;

-- =====================================================
-- FUNCTION: update_mechanic_rating_stats
-- =====================================================
-- Update mechanic_profiles with latest rating stats
CREATE OR REPLACE FUNCTION public.update_mechanic_rating_stats(p_mechanic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg numeric;
  v_count int;
BEGIN
  SELECT 
    COALESCE(AVG(overall_rating), 0),
    COUNT(*)
  INTO v_avg, v_count
  FROM public.reviews
  WHERE reviewee_id = p_mechanic_id
    AND visibility = 'visible'
    AND is_hidden = false
    AND deleted_at IS NULL;

  UPDATE public.mechanic_profiles
  SET 
    rating_avg = ROUND(v_avg::numeric, 2),
    rating_count = v_count,
    updated_at = now()
  WHERE id = p_mechanic_id;
END;
$$;

-- =====================================================
-- FUNCTION: recalculate_trust_score
-- =====================================================
-- Recalculate trust score for a user
CREATE OR REPLACE FUNCTION public.recalculate_trust_score(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Calculate rating score (0-100)
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
  -- 40% rating, 25% completion, 20% reliability, 10% badges, 5% tenure
  v_overall_score := (
    (v_rating_score * 0.40) +
    (v_completion_score * 0.25) +
    (v_reliability_score * 0.20) +
    (v_badge_score * 0.50) +  -- Badge score is already 0-20, so multiply to normalize
    (v_tenure_score * 0.50)   -- Tenure score is already 0-10, so multiply to normalize
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

-- =====================================================
-- FUNCTION: check_and_award_badges
-- =====================================================
-- Check badge criteria and award eligible badges
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge record;
  v_value numeric;
  v_awarded_badges jsonb := '[]'::jsonb;
  v_user_role public.user_role;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role FROM public.profiles WHERE id = p_user_id;

  -- Loop through active badges
  FOR v_badge IN 
    SELECT * FROM public.badges WHERE is_active = true
  LOOP
    -- Skip if already has badge
    IF EXISTS (
      SELECT 1 FROM public.user_badges 
      WHERE user_id = p_user_id 
        AND badge_id = v_badge.id 
        AND revoked_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    -- Calculate value based on criteria type
    v_value := NULL;

    CASE v_badge.criteria_type
      WHEN 'jobs_completed' THEN
        IF v_user_role = 'mechanic' THEN
          SELECT COUNT(*) INTO v_value
          FROM public.jobs
          WHERE accepted_mechanic_id = p_user_id AND status = 'completed';
        ELSE
          SELECT COUNT(*) INTO v_value
          FROM public.jobs
          WHERE customer_id = p_user_id AND status = 'completed';
        END IF;

      WHEN 'avg_rating' THEN
        SELECT AVG(overall_rating) INTO v_value
        FROM public.reviews
        WHERE reviewee_id = p_user_id
          AND visibility = 'visible'
          AND is_hidden = false;
        -- Require minimum 5 reviews for rating badges
        IF (SELECT COUNT(*) FROM public.reviews WHERE reviewee_id = p_user_id AND visibility = 'visible') < 5 THEN
          v_value := NULL;
        END IF;

      WHEN 'recommend_rate' THEN
        SELECT (COUNT(*) FILTER (WHERE would_recommend = true)::numeric / NULLIF(COUNT(*), 0) * 100)
        INTO v_value
        FROM public.reviews
        WHERE reviewee_id = p_user_id
          AND visibility = 'visible'
          AND would_recommend IS NOT NULL;

      WHEN 'completion_rate' THEN
        IF v_user_role = 'mechanic' THEN
          SELECT (COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100)
          INTO v_value
          FROM public.jobs
          WHERE accepted_mechanic_id = p_user_id;
        ELSE
          SELECT (COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100)
          INTO v_value
          FROM public.jobs
          WHERE customer_id = p_user_id;
        END IF;

      WHEN 'verified_skills' THEN
        IF v_user_role = 'mechanic' THEN
          SELECT COUNT(*) INTO v_value
          FROM public.mechanic_skills
          WHERE mechanic_id = p_user_id AND is_verified = true;
        END IF;

      WHEN 'skill_jobs' THEN
        -- This is handled per-skill, not here
        CONTINUE;

      WHEN 'manual' THEN
        -- Manual badges are awarded by admin
        CONTINUE;

      ELSE
        CONTINUE;
    END CASE;

    -- Award badge if threshold met
    IF v_value IS NOT NULL AND v_value >= v_badge.criteria_threshold THEN
      INSERT INTO public.user_badges (user_id, badge_id, awarded_reason, source)
      VALUES (p_user_id, v_badge.id, 'Criteria met: ' || v_badge.criteria_type || ' = ' || v_value, 'system')
      ON CONFLICT (user_id, badge_id) DO NOTHING;

      -- Log to history
      INSERT INTO public.badge_history (user_id, badge_id, action, reason)
      VALUES (p_user_id, v_badge.id, 'awarded', 'Auto-awarded: ' || v_badge.criteria_type || ' >= ' || v_badge.criteria_threshold);

      v_awarded_badges := v_awarded_badges || jsonb_build_object(
        'badge_code', v_badge.code,
        'badge_title', v_badge.title
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('awarded', v_awarded_badges);
END;
$$;

-- =====================================================
-- FUNCTION: verify_skill_from_job
-- =====================================================
-- Verify mechanic skills based on completed job
CREATE OR REPLACE FUNCTION public.verify_skill_from_job(
  p_job_id uuid,
  p_mechanic_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_skill_key text;
  v_skill_keys text[];
  v_customer_rating int;
  v_verification_count int;
BEGIN
  -- Get job details
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  
  IF v_job IS NULL OR v_job.status != 'completed' THEN
    RETURN;
  END IF;

  -- Get customer rating for this job
  SELECT overall_rating INTO v_customer_rating
  FROM public.reviews
  WHERE job_id = p_job_id AND reviewer_id = v_job.customer_id;

  -- Get required skills from symptom mapping
  SELECT required_skill_keys INTO v_skill_keys
  FROM public.symptom_mappings
  WHERE symptom_key = v_job.symptom_key;

  IF v_skill_keys IS NULL OR array_length(v_skill_keys, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Process each skill
  FOREACH v_skill_key IN ARRAY v_skill_keys
  LOOP
    -- Record verification
    INSERT INTO public.skill_verifications (
      mechanic_id,
      skill_key,
      job_id,
      customer_rating,
      verification_weight
    ) VALUES (
      p_mechanic_id,
      v_skill_key,
      p_job_id,
      v_customer_rating,
      CASE 
        WHEN v_customer_rating >= 4 THEN 1.0
        WHEN v_customer_rating = 3 THEN 0.5
        ELSE 0.25
      END
    )
    ON CONFLICT (mechanic_id, skill_key, job_id) DO NOTHING;

    -- Count verifications for this skill
    SELECT COUNT(*) INTO v_verification_count
    FROM public.skill_verifications
    WHERE mechanic_id = p_mechanic_id AND skill_key = v_skill_key;

    -- Update mechanic_skills if threshold met (3 jobs)
    IF v_verification_count >= 3 THEN
      UPDATE public.mechanic_skills
      SET 
        is_verified = true,
        verified_job_count = v_verification_count,
        last_verified_at = now(),
        avg_job_rating = (
          SELECT AVG(customer_rating)
          FROM public.skill_verifications
          WHERE mechanic_id = p_mechanic_id AND skill_key = v_skill_key
        )
      WHERE mechanic_id = p_mechanic_id AND skill_key = v_skill_key;
    ELSE
      -- Just update count
      UPDATE public.mechanic_skills
      SET 
        verified_job_count = v_verification_count,
        last_verified_at = now()
      WHERE mechanic_id = p_mechanic_id AND skill_key = v_skill_key;
    END IF;
  END LOOP;
END;
$$;

-- =====================================================
-- FUNCTION: create_review_prompts
-- =====================================================
-- Create review prompts when job is completed
CREATE OR REPLACE FUNCTION public.create_review_prompts(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_expires_at timestamptz;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  
  IF v_job IS NULL OR v_job.status != 'completed' THEN
    RETURN;
  END IF;

  v_expires_at := now() + interval '14 days';

  -- Customer prompt to review mechanic
  INSERT INTO public.review_prompts (
    job_id, user_id, target_user_id, user_role, expires_at
  ) VALUES (
    p_job_id, v_job.customer_id, v_job.accepted_mechanic_id, 'customer', v_expires_at
  )
  ON CONFLICT (job_id, user_id) DO NOTHING;

  -- Mechanic prompt to review customer
  INSERT INTO public.review_prompts (
    job_id, user_id, target_user_id, user_role, expires_at
  ) VALUES (
    p_job_id, v_job.accepted_mechanic_id, v_job.customer_id, 'mechanic', v_expires_at
  )
  ON CONFLICT (job_id, user_id) DO NOTHING;
END;
$$;

-- =====================================================
-- FUNCTION: get_user_review_status
-- =====================================================
-- Get review status for a job from user's perspective
CREATE OR REPLACE FUNCTION public.get_user_review_status(
  p_job_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_my_review record;
  v_their_review record;
  v_other_party_id uuid;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  
  IF v_job IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Determine other party
  IF p_user_id = v_job.customer_id THEN
    v_other_party_id := v_job.accepted_mechanic_id;
  ELSE
    v_other_party_id := v_job.customer_id;
  END IF;

  -- Get my review
  SELECT * INTO v_my_review
  FROM public.reviews
  WHERE job_id = p_job_id AND reviewer_id = p_user_id;

  -- Get their review
  SELECT * INTO v_their_review
  FROM public.reviews
  WHERE job_id = p_job_id AND reviewer_id = v_other_party_id;

  RETURN jsonb_build_object(
    'job_status', v_job.status,
    'can_review', v_job.status = 'completed' AND v_my_review IS NULL,
    'has_reviewed', v_my_review IS NOT NULL,
    'my_review', CASE 
      WHEN v_my_review IS NOT NULL THEN jsonb_build_object(
        'id', v_my_review.id,
        'overall_rating', v_my_review.overall_rating,
        'comment', v_my_review.comment,
        'visibility', v_my_review.visibility,
        'created_at', v_my_review.created_at
      )
      ELSE NULL
    END,
    'other_has_reviewed', v_their_review IS NOT NULL,
    'other_review_visible', v_their_review IS NOT NULL AND v_their_review.visibility = 'visible',
    'other_review', CASE 
      WHEN v_their_review IS NOT NULL AND v_their_review.visibility = 'visible' THEN jsonb_build_object(
        'id', v_their_review.id,
        'overall_rating', v_their_review.overall_rating,
        'comment', v_their_review.comment,
        'created_at', v_their_review.created_at
      )
      ELSE NULL
    END
  );
END;
$$;

-- =====================================================
-- FUNCTION: report_review
-- =====================================================
-- Report a review for moderation
CREATE OR REPLACE FUNCTION public.report_review(
  p_review_id uuid,
  p_reason public.report_reason,
  p_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_review record;
BEGIN
  SELECT * INTO v_review FROM public.reviews WHERE id = p_review_id;
  
  IF v_review IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review not found');
  END IF;

  -- Can only report reviews about yourself
  IF v_review.reviewee_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only report reviews about yourself');
  END IF;

  INSERT INTO public.review_reports (
    review_id, reported_by, reason, details
  ) VALUES (
    p_review_id, v_user_id, p_reason, p_details
  )
  ON CONFLICT (review_id, reported_by) DO UPDATE SET
    reason = EXCLUDED.reason,
    details = EXCLUDED.details,
    status = 'pending',
    created_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =====================================================
-- FUNCTION: get_pending_review_prompts
-- =====================================================
-- Get pending review prompts for a user
CREATE OR REPLACE FUNCTION public.get_pending_review_prompts(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  job_id uuid,
  job_title text,
  target_user_id uuid,
  target_user_name text,
  target_user_avatar text,
  user_role public.user_role,
  prompted_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rp.job_id,
    j.title as job_title,
    rp.target_user_id,
    p.full_name as target_user_name,
    p.avatar_url as target_user_avatar,
    rp.user_role,
    rp.prompted_at,
    rp.expires_at
  FROM public.review_prompts rp
  JOIN public.jobs j ON j.id = rp.job_id
  JOIN public.profiles p ON p.id = rp.target_user_id
  WHERE rp.user_id = COALESCE(p_user_id, auth.uid())
    AND rp.completed_at IS NULL
    AND rp.expires_at > now()
  ORDER BY rp.prompted_at DESC;
END;
$$;

COMMIT;
