-- =====================================================
-- MIGRATION 0079: UPDATE SUBMIT_REVIEW WITH NEW RATING FIELDS
-- =====================================================
-- Purpose: Add performance, timing, cost ratings for mechanic reviews
--          Add communication, punctuality, payment ratings for customer reviews
-- =====================================================

BEGIN;

-- First add new columns to reviews table if they don't exist
ALTER TABLE public.reviews 
  ADD COLUMN IF NOT EXISTS performance_rating int CHECK (performance_rating >= 1 AND performance_rating <= 5),
  ADD COLUMN IF NOT EXISTS timing_rating int CHECK (timing_rating >= 1 AND timing_rating <= 5),
  ADD COLUMN IF NOT EXISTS cost_rating int CHECK (cost_rating >= 1 AND cost_rating <= 5),
  ADD COLUMN IF NOT EXISTS punctuality_rating int CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
  ADD COLUMN IF NOT EXISTS payment_rating int CHECK (payment_rating >= 1 AND payment_rating <= 5);

-- Update submit_review function with new parameters
CREATE OR REPLACE FUNCTION public.submit_review(
  p_job_id uuid,
  p_reviewer_id uuid,
  p_reviewee_id uuid,
  p_rating int,
  p_comment text DEFAULT NULL,
  p_professionalism_rating int DEFAULT NULL,
  p_communication_rating int DEFAULT NULL,
  p_would_recommend boolean DEFAULT NULL,
  p_performance_rating int DEFAULT NULL,
  p_timing_rating int DEFAULT NULL,
  p_cost_rating int DEFAULT NULL,
  p_punctuality_rating int DEFAULT NULL,
  p_payment_rating int DEFAULT NULL
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
    performance_rating,
    timing_rating,
    cost_rating,
    punctuality_rating,
    payment_rating,
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
    p_performance_rating,
    p_timing_rating,
    p_cost_rating,
    p_punctuality_rating,
    p_payment_rating,
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
    performance_rating = EXCLUDED.performance_rating,
    timing_rating = EXCLUDED.timing_rating,
    cost_rating = EXCLUDED.cost_rating,
    punctuality_rating = EXCLUDED.punctuality_rating,
    payment_rating = EXCLUDED.payment_rating,
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
  
  RETURN jsonb_build_object(
    'review_id', v_review_id,
    'published', v_should_publish,
    'blind_deadline', v_blind_deadline
  );
END;
$$;

COMMIT;
