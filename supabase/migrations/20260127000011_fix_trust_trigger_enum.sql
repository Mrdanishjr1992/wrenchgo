-- Fix trust score triggers to handle job_status enum properly
-- The enum only has 'cancelled' (British spelling), not 'canceled'

BEGIN;

-- =====================================================
-- TRIGGER FUNCTION: On job status change (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_recalc_trust_on_job_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
  v_mechanic_id uuid;
  v_new_status text;
  v_old_status text;
BEGIN
  -- Cast to text to avoid enum comparison issues
  v_new_status := NEW.status::text;
  v_old_status := OLD.status::text;

  -- Get customer and mechanic IDs
  v_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
  v_mechanic_id := COALESCE(NEW.accepted_mechanic_id, OLD.accepted_mechanic_id);

  -- Job completed
  IF (v_new_status = 'completed' AND (v_old_status IS NULL OR v_old_status != 'completed'))
     OR (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL) THEN
    IF v_customer_id IS NOT NULL THEN
      PERFORM public.recalculate_trust_score(v_customer_id, 'job_completed', NEW.id);
    END IF;
    IF v_mechanic_id IS NOT NULL THEN
      PERFORM public.recalculate_trust_score(v_mechanic_id, 'job_completed', NEW.id);
    END IF;
  END IF;

  -- Job cancelled (check both spellings via text comparison)
  IF (v_new_status IN ('cancelled', 'canceled') AND v_old_status NOT IN ('cancelled', 'canceled'))
     OR (NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL) THEN
    IF v_customer_id IS NOT NULL THEN
      PERFORM public.recalculate_trust_score(v_customer_id, 'job_cancelled', NEW.id);
    END IF;
    IF v_mechanic_id IS NOT NULL THEN
      PERFORM public.recalculate_trust_score(v_mechanic_id, 'job_cancelled', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGER FUNCTION: On job_contracts status change (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_recalc_trust_on_contract_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
  v_new_status text;
  v_old_status text;
BEGIN
  -- Cast to text to avoid enum comparison issues
  v_new_status := NEW.status::text;
  v_old_status := OLD.status::text;

  -- Get customer ID from job
  SELECT customer_id INTO v_customer_id
  FROM public.jobs
  WHERE id = NEW.job_id;

  -- Contract completed
  IF v_new_status = 'completed' AND (v_old_status IS NULL OR v_old_status != 'completed') THEN
    IF v_customer_id IS NOT NULL THEN
      PERFORM public.recalculate_trust_score(v_customer_id, 'job_completed', NEW.job_id);
    END IF;
    IF NEW.mechanic_id IS NOT NULL THEN
      PERFORM public.recalculate_trust_score(NEW.mechanic_id, 'job_completed', NEW.job_id);
    END IF;
  END IF;

  -- Contract cancelled (check both spellings via text comparison)
  IF v_new_status IN ('cancelled', 'canceled') AND v_old_status NOT IN ('cancelled', 'canceled') THEN
    IF v_customer_id IS NOT NULL THEN
      PERFORM public.recalculate_trust_score(v_customer_id, 'job_cancelled', NEW.job_id);
    END IF;
    IF NEW.mechanic_id IS NOT NULL THEN
      PERFORM public.recalculate_trust_score(NEW.mechanic_id, 'job_cancelled', NEW.job_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- Also fix the main recalculate function to cast status to text
-- =====================================================
CREATE OR REPLACE FUNCTION public.recalculate_trust_score(
  p_user_id uuid,
  p_reason text DEFAULT 'manual_recalc',
  p_job_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_jobs int := 0;
  v_completed_jobs int := 0;
  v_cancelled_jobs int := 0;
  v_disputed_jobs int := 0;
  v_no_show_count int := 0;
  v_reviews_received int := 0;
  v_reviews_given int := 0;
  v_avg_rating_received numeric := 0;
  v_avg_rating_given numeric := 0;
  v_badge_count int := 0;
  v_tenure_days int := 0;
  v_user_role text;
  v_rating_score int := 50;
  v_completion_score int := 100;
  v_reliability_score int := 100;
  v_badge_score int := 0;
  v_tenure_score int := 0;
  v_overall_score int := 50;
  v_created_at timestamptz;
BEGIN
  -- Permission check: user can recalc own score, or admin can recalc any
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: cannot recalculate trust score for another user';
  END IF;

  -- Get user role and created_at
  SELECT role, created_at INTO v_user_role, v_created_at
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Calculate tenure days
  v_tenure_days := GREATEST(0, EXTRACT(DAY FROM (now() - v_created_at))::int);

  -- =====================================================
  -- COUNT JOBS (role-dependent) - cast status to text
  -- =====================================================
  IF v_user_role = 'mechanic' THEN
    -- For mechanics: count jobs where they are the accepted mechanic
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE j.status::text = 'completed' OR j.completed_at IS NOT NULL),
      COUNT(*) FILTER (WHERE j.status::text IN ('cancelled', 'canceled') OR j.cancelled_at IS NOT NULL)
    INTO v_total_jobs, v_completed_jobs, v_cancelled_jobs
    FROM public.jobs j
    WHERE j.accepted_mechanic_id = p_user_id;
    
    -- Also count from job_contracts
    SELECT 
      COALESCE(v_total_jobs, 0) + COUNT(*),
      COALESCE(v_completed_jobs, 0) + COUNT(*) FILTER (WHERE jc.status::text = 'completed'),
      COALESCE(v_cancelled_jobs, 0) + COUNT(*) FILTER (WHERE jc.status::text IN ('cancelled', 'canceled'))
    INTO v_total_jobs, v_completed_jobs, v_cancelled_jobs
    FROM public.job_contracts jc
    WHERE jc.mechanic_id = p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.jobs j2 
        WHERE j2.id = jc.job_id AND j2.accepted_mechanic_id = p_user_id
      );
  ELSE
    -- For customers: count jobs they created
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE j.status::text = 'completed' OR j.completed_at IS NOT NULL),
      COUNT(*) FILTER (WHERE j.status::text IN ('cancelled', 'canceled') OR j.cancelled_at IS NOT NULL)
    INTO v_total_jobs, v_completed_jobs, v_cancelled_jobs
    FROM public.jobs j
    WHERE j.customer_id = p_user_id;
  END IF;

  -- =====================================================
  -- COUNT DISPUTES
  -- =====================================================
  SELECT COUNT(*)
  INTO v_disputed_jobs
  FROM public.disputes d
  WHERE d.filed_against = p_user_id
    AND d.status::text IN ('open', 'resolved', 'closed');

  -- =====================================================
  -- COUNT NO-SHOWS (from existing trust_scores if available)
  -- =====================================================
  SELECT COALESCE(no_show_count, 0)
  INTO v_no_show_count
  FROM public.trust_scores
  WHERE user_id = p_user_id;

  -- =====================================================
  -- COUNT REVIEWS
  -- =====================================================
  SELECT 
    COUNT(*),
    COALESCE(AVG(overall_rating), 0)
  INTO v_reviews_received, v_avg_rating_received
  FROM public.reviews
  WHERE reviewee_id = p_user_id
    AND (visibility::text = 'visible' OR visibility IS NULL);

  SELECT 
    COUNT(*),
    COALESCE(AVG(overall_rating), 0)
  INTO v_reviews_given, v_avg_rating_given
  FROM public.reviews
  WHERE reviewer_id = p_user_id;

  -- =====================================================
  -- COUNT ACTIVE BADGES
  -- =====================================================
  SELECT COUNT(*)
  INTO v_badge_count
  FROM public.user_badges
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  -- =====================================================
  -- CALCULATE COMPONENT SCORES
  -- =====================================================
  
  -- Rating score: (avg_rating - 1) / 4 * 100, default 50 if no reviews
  IF v_reviews_received > 0 AND v_avg_rating_received > 0 THEN
    v_rating_score := LEAST(100, GREATEST(0, ROUND(((v_avg_rating_received - 1) / 4.0) * 100)::int));
  ELSE
    v_rating_score := 50;
  END IF;

  -- Completion score: completed_jobs / total_jobs * 100
  IF v_total_jobs > 0 THEN
    v_completion_score := LEAST(100, GREATEST(0, ROUND((v_completed_jobs::numeric / v_total_jobs) * 100)::int));
  ELSE
    v_completion_score := 100;
  END IF;

  -- Reliability score: start at 100, subtract penalties
  v_reliability_score := 100;
  v_reliability_score := v_reliability_score - (10 * COALESCE(v_cancelled_jobs, 0));
  v_reliability_score := v_reliability_score - (25 * COALESCE(v_no_show_count, 0));
  v_reliability_score := v_reliability_score - (15 * COALESCE(v_disputed_jobs, 0));
  v_reliability_score := LEAST(100, GREATEST(0, v_reliability_score));

  -- Badge score: badge_count * 10, capped at 100
  v_badge_score := LEAST(100, GREATEST(0, v_badge_count * 10));

  -- Tenure score: floor(days / 30) * 5, capped at 100
  v_tenure_score := LEAST(100, GREATEST(0, FLOOR(v_tenure_days / 30.0) * 5)::int);

  -- =====================================================
  -- CALCULATE OVERALL SCORE (weighted)
  -- =====================================================
  v_overall_score := ROUND(
    0.35 * v_rating_score +
    0.25 * v_completion_score +
    0.25 * v_reliability_score +
    0.10 * v_badge_score +
    0.05 * v_tenure_score
  )::int;
  v_overall_score := LEAST(100, GREATEST(0, v_overall_score));

  -- =====================================================
  -- UPSERT trust_scores
  -- =====================================================
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
    created_at,
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

  -- =====================================================
  -- INSERT HISTORY SNAPSHOT
  -- =====================================================
  INSERT INTO public.trust_score_history (
    user_id,
    overall_score,
    rating_score,
    completion_score,
    reliability_score,
    badge_score,
    tenure_score,
    snapshot_reason,
    job_id,
    created_at
  ) VALUES (
    p_user_id,
    v_overall_score,
    v_rating_score,
    v_completion_score,
    v_reliability_score,
    v_badge_score,
    v_tenure_score,
    p_reason,
    p_job_id,
    now()
  );

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'overall_score', v_overall_score,
    'rating_score', v_rating_score,
    'completion_score', v_completion_score,
    'reliability_score', v_reliability_score,
    'badge_score', v_badge_score,
    'tenure_score', v_tenure_score,
    'total_jobs', v_total_jobs,
    'completed_jobs', v_completed_jobs,
    'cancelled_jobs', v_cancelled_jobs,
    'disputed_jobs', v_disputed_jobs,
    'reviews_received', v_reviews_received,
    'avg_rating_received', v_avg_rating_received,
    'badge_count', v_badge_count,
    'tenure_days', v_tenure_days,
    'reason', p_reason
  );
END;
$$;

COMMIT;