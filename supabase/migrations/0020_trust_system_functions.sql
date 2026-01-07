-- =====================================================
-- MIGRATION 0012: TRUST SYSTEM BUSINESS LOGIC
-- =====================================================
-- Purpose: RPCs and triggers for blind reviews, badges, 
--          skill verification, and trust scoring
-- =====================================================

BEGIN;

-- =====================================================
-- FUNCTION: create_review_prompts
-- =====================================================
-- Called when job is finalized to prompt both parties for reviews
CREATE OR REPLACE FUNCTION public.create_review_prompts(
  p_job_id uuid,
  p_customer_id uuid,
  p_mechanic_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expires_at timestamptz;
BEGIN
  v_expires_at := now() + interval '7 days';
  
  -- Create prompt for customer to review mechanic
  INSERT INTO public.review_prompts (
    job_id, user_id, target_user_id, user_role, expires_at
  ) VALUES (
    p_job_id, p_customer_id, p_mechanic_id, 'customer', v_expires_at
  )
  ON CONFLICT (job_id, user_id) DO NOTHING;
  
  -- Create prompt for mechanic to review customer
  INSERT INTO public.review_prompts (
    job_id, user_id, target_user_id, user_role, expires_at
  ) VALUES (
    p_job_id, p_mechanic_id, p_customer_id, 'mechanic', v_expires_at
  )
  ON CONFLICT (job_id, user_id) DO NOTHING;
END;
$$;

-- =====================================================
-- FUNCTION: submit_review
-- =====================================================
-- Submit a review with blind period logic
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
  
  -- Insert or update review
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
-- FUNCTION: publish_expired_reviews
-- =====================================================
-- Publish reviews that have passed blind deadline
CREATE OR REPLACE FUNCTION public.publish_expired_reviews()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.reviews
  SET 
    visibility = 'visible',
    made_visible_at = now(),
    visibility_reason = 'blind_deadline_expired'
  WHERE visibility = 'hidden'
    AND blind_deadline IS NOT NULL
    AND blind_deadline < now();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =====================================================
-- FUNCTION: tag_job_skills
-- =====================================================
-- Tag a job with skills (called at quote acceptance or job start)
CREATE OR REPLACE FUNCTION public.tag_job_skills(
  p_job_id uuid,
  p_contract_id uuid,
  p_skill_keys text[],
  p_lock_immediately boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_skill_key text;
  v_is_first boolean := true;
BEGIN
  FOREACH v_skill_key IN ARRAY p_skill_keys
  LOOP
    INSERT INTO public.job_skill_tags (
      job_id,
      contract_id,
      skill_key,
      tag_role,
      locked_at
    ) VALUES (
      p_job_id,
      p_contract_id,
      v_skill_key,
      CASE WHEN v_is_first THEN 'primary' ELSE 'secondary' END,
      CASE WHEN p_lock_immediately THEN now() ELSE NULL END
    )
    ON CONFLICT (job_id, skill_key) DO NOTHING;
    
    v_is_first := false;
  END LOOP;
END;
$$;

-- =====================================================
-- FUNCTION: lock_job_skills
-- =====================================================
-- Lock job skills (called when work starts)
CREATE OR REPLACE FUNCTION public.lock_job_skills(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.job_skill_tags
  SET locked_at = now()
  WHERE job_id = p_job_id
    AND locked_at IS NULL;
END;
$$;

-- =====================================================
-- FUNCTION: process_skill_verifications
-- =====================================================
-- Process skill verifications after review is published
CREATE OR REPLACE FUNCTION public.process_skill_verifications(
  p_job_id uuid,
  p_mechanic_id uuid,
  p_customer_rating int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_skill_record RECORD;
  v_weight numeric;
  v_rating_modifier numeric;
  v_complexity_modifier numeric := 1.0;
BEGIN
  -- Calculate rating modifier
  v_rating_modifier := CASE
    WHEN p_customer_rating = 5 THEN 1.2
    WHEN p_customer_rating = 4 THEN 1.0
    ELSE 0.5
  END;
  
  -- Process each skill tag for this job
  FOR v_skill_record IN
    SELECT skill_key
    FROM public.job_skill_tags
    WHERE job_id = p_job_id
      AND locked_at IS NOT NULL
  LOOP
    -- Calculate weight
    v_weight := 1.0 * v_rating_modifier * v_complexity_modifier;
    
    -- Insert skill verification record
    INSERT INTO public.skill_verifications (
      mechanic_id,
      skill_key,
      job_id,
      customer_rating,
      verification_weight,
      verified_at
    ) VALUES (
      p_mechanic_id,
      v_skill_record.skill_key,
      p_job_id,
      p_customer_rating,
      v_weight,
      now()
    )
    ON CONFLICT (mechanic_id, skill_key, job_id) DO NOTHING;
    
    -- Update mechanic_skills aggregates
    WITH skill_stats AS (
      SELECT
        COUNT(*) as job_count,
        AVG(customer_rating) as avg_rating,
        MAX(verified_at) as last_verified
      FROM public.skill_verifications
      WHERE mechanic_id = p_mechanic_id
        AND skill_key = v_skill_record.skill_key
    )
    UPDATE public.mechanic_skills ms
    SET
      verified_job_count = COALESCE(ss.job_count, 0),
      avg_job_rating = ss.avg_rating,
      last_verified_at = ss.last_verified,
      is_verified = COALESCE(ss.job_count, 0) >= 3
    FROM skill_stats ss
    WHERE ms.mechanic_id = p_mechanic_id
      AND ms.skill_key = v_skill_record.skill_key;
  END LOOP;
END;
$$;

-- =====================================================
-- FUNCTION: calculate_trust_score
-- =====================================================
-- Calculate comprehensive trust score for a user
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
  
  -- Calculate review stats
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
  -- Based on on-time arrivals, cancellation rate
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
  
  -- Create history snapshot
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

COMMIT;
