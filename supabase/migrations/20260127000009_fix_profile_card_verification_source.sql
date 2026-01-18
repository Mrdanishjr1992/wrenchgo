-- Fix get_public_profile_card to read verification_status from mechanic_profiles table
-- The admin interface updates mechanic_profiles.verification_status, not profiles.verification_status

CREATE OR REPLACE FUNCTION public.get_public_profile_card(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  profile_ratings jsonb;
  profile_badges jsonb;
  profile_skills jsonb;
  profile_trust_score jsonb;
  v_role text;
  v_profile_id uuid;
  v_total_jobs bigint := 0;
  v_completed_jobs bigint := 0;
  v_verification_status text := 'unverified';
  v_mechanic_tier text := 'bronze';
BEGIN
  -- Get user role and profile id
  SELECT p.role, p.id INTO v_role, v_profile_id
  FROM profiles p
  WHERE p.id = p_user_id
    AND p.deleted_at IS NULL;

  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get verification status from mechanic_profiles for mechanics
  IF v_role = 'mechanic' THEN
    SELECT
      CASE mp.verification_status
        WHEN 'active' THEN 'verified'
        WHEN 'pending_verification' THEN 'pending'
        WHEN 'paused' THEN 'suspended'
        WHEN 'removed' THEN 'suspended'
        ELSE 'unverified'
      END,
      COALESCE(mp.tier, 'bronze')
    INTO v_verification_status, v_mechanic_tier
    FROM mechanic_profiles mp
    WHERE mp.id = p_user_id;
    
    -- Fallback if no mechanic_profile record
    IF v_verification_status IS NULL THEN
      v_verification_status := 'unverified';
    END IF;
    IF v_mechanic_tier IS NULL THEN
      v_mechanic_tier := 'bronze';
    END IF;
  END IF;

  -- Count jobs based on role
  IF v_role = 'customer' THEN
    SELECT 
      COALESCE(COUNT(*), 0),
      COALESCE(COUNT(*) FILTER (WHERE j.status = 'completed'), 0)
    INTO v_total_jobs, v_completed_jobs
    FROM jobs j
    WHERE j.customer_id = v_profile_id;
  ELSE
    SELECT 
      COALESCE(COUNT(*), 0),
      COALESCE(COUNT(*) FILTER (WHERE j.status = 'completed'), 0)
    INTO v_total_jobs, v_completed_jobs
    FROM jobs j
    WHERE j.accepted_mechanic_id = v_profile_id;
  END IF;

  -- Get ratings data
  SELECT jsonb_build_object(
    'overall_avg', COALESCE(AVG(r.overall_rating), 0),
    'performance_avg', COALESCE(AVG(r.performance_rating), 0),
    'timing_avg', COALESCE(AVG(r.timing_rating), 0),
    'cost_avg', COALESCE(AVG(r.cost_rating), 0),
    'professionalism_avg', COALESCE(AVG(r.professionalism_rating), 0),
    'communication_avg', COALESCE(AVG(r.communication_rating), 0),
    'punctuality_avg', COALESCE(AVG(r.punctuality_rating), 0),
    'payment_avg', COALESCE(AVG(r.payment_rating), 0),
    'review_count', COALESCE(COUNT(r.id), 0)::integer,
    'would_recommend_count', COALESCE(COUNT(r.id) FILTER (WHERE r.would_recommend = true), 0)::integer,
    'would_recommend_total', COALESCE(COUNT(r.id) FILTER (WHERE r.would_recommend IS NOT NULL), 0)::integer
  )
  INTO profile_ratings
  FROM reviews r
  WHERE r.reviewee_id = p_user_id;

  -- Get badges data
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ub.id,
      'badge_id', ub.badge_id,
      'awarded_at', ub.created_at,
      'badge', jsonb_build_object(
        'code', b.code,
        'title', b.title,
        'description', COALESCE(b.description, ''),
        'icon', COALESCE(b.icon, ''),
        'category', COALESCE(b.badge_type, 'earned'),
        'tier', 1
      )
    )
  ), '[]'::jsonb)
  INTO profile_badges
  FROM user_badges ub
  INNER JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = p_user_id;

  -- Get skills data (for mechanics only)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ms.id,
      'is_verified', COALESCE(ms.is_verified, false),
      'verified_job_count', 0,
      'avg_job_rating', null,
      'skill', jsonb_build_object(
        'key', s.key,
        'label', s.label,
        'name', s.label,
        'category', COALESCE(s.category, 'general')
      )
    )
  ), '[]'::jsonb)
  INTO profile_skills
  FROM mechanic_skills ms
  INNER JOIN skills s ON s.key = ms.skill_key
  WHERE ms.mechanic_id = p_user_id;

  -- Build trust score with actual job counts
  profile_trust_score := jsonb_build_object(
    'overall_score', 50,
    'rating_score', CASE WHEN COALESCE((profile_ratings->>'review_count')::int, 0) > 0 
      THEN LEAST(100, COALESCE((profile_ratings->>'overall_avg')::numeric, 0) * 20) 
      ELSE 50 END,
    'completion_score', CASE WHEN v_total_jobs > 0 
      THEN LEAST(100, (v_completed_jobs::numeric / v_total_jobs::numeric) * 100)
      ELSE 50 END,
    'reliability_score', 50,
    'badge_score', LEAST(100, COALESCE(jsonb_array_length(profile_badges), 0) * 20),
    'tenure_score', 50,
    'completed_jobs', COALESCE(v_completed_jobs, 0),
    'total_jobs', COALESCE(v_total_jobs, 0)
  );

  -- Build final result with verification status from mechanic_profiles
  SELECT jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'display_name', COALESCE(p.full_name, 'Unknown User'),
    'avatar_url', p.avatar_url,
    'created_at', p.created_at,
    'verification_status', v_verification_status,
    'mechanic_tier', v_mechanic_tier,
    'ratings', COALESCE(profile_ratings, '{}'::jsonb),
    'badges', COALESCE(profile_badges, '[]'::jsonb),
    'skills', COALESCE(profile_skills, '[]'::jsonb),
    'trust_score', profile_trust_score
  )
  INTO result
  FROM profiles p
  WHERE p.id = p_user_id
    AND p.deleted_at IS NULL;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO anon;