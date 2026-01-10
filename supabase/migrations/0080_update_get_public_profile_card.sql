-- =====================================================
-- MIGRATION 0080: UPDATE GET_PUBLIC_PROFILE_CARD
-- =====================================================
-- Purpose: Add customer rating fields and trust score to profile card
-- =====================================================

DROP FUNCTION IF EXISTS public.get_public_profile_card CASCADE;

CREATE OR REPLACE FUNCTION public.get_public_profile_card(user_id uuid)
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
BEGIN
  -- Get user role first
  SELECT p.role INTO v_role
  FROM profiles p
  WHERE p.auth_id = user_id
    AND p.deleted_at IS NULL;

  -- Get ratings data with all fields
  SELECT jsonb_build_object(
    'overall_avg', COALESCE(AVG(r.overall_rating), 0),
    -- Mechanic ratings (from customer reviews)
    'performance_avg', COALESCE(AVG(r.performance_rating), 0),
    'timing_avg', COALESCE(AVG(r.timing_rating), 0),
    'cost_avg', COALESCE(AVG(r.cost_rating), 0),
    'professionalism_avg', COALESCE(AVG(r.professionalism_rating), 0),
    -- Customer ratings (from mechanic reviews)
    'communication_avg', COALESCE(AVG(r.communication_rating), 0),
    'punctuality_avg', COALESCE(AVG(r.punctuality_rating), 0),
    'payment_avg', COALESCE(AVG(r.payment_rating), 0),
    'review_count', COUNT(r.id)::integer,
    'would_recommend_count', COUNT(r.id) FILTER (WHERE r.would_recommend = true)::integer,
    'would_recommend_total', COUNT(r.id) FILTER (WHERE r.would_recommend IS NOT NULL)::integer
  )
  INTO profile_ratings
  FROM reviews r
  WHERE r.reviewee_id = user_id
    AND r.deleted_at IS NULL;

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
        'icon', COALESCE(b.icon, '🏆'),
        'category', COALESCE(b.badge_type, 'earned'),
        'tier', 1
      )
    )
  ), '[]'::jsonb)
  INTO profile_badges
  FROM user_badges ub
  INNER JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = user_id;

  -- Get skills data (for mechanics only)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ms.id,
      'is_verified', COALESCE(ms.is_verified, false),
      'verified_job_count', 0,
      'avg_job_rating', null,
      'skill', jsonb_build_object(
        'key', s.id,
        'label', s.name,
        'name', s.name,
        'category', COALESCE(s.category, 'general')
      )
    )
  ), '[]'::jsonb)
  INTO profile_skills
  FROM mechanic_skills ms
  INNER JOIN skills s ON s.id = ms.skill_id
  WHERE ms.mechanic_id = user_id
    AND ms.deleted_at IS NULL;

  -- Build trust score
  SELECT jsonb_build_object(
    'overall_score', 50,
    'rating_score', CASE WHEN (profile_ratings->>'review_count')::int > 0 
      THEN LEAST(100, (profile_ratings->>'overall_avg')::numeric * 20) 
      ELSE 50 END,
    'completion_score', 50,
    'reliability_score', 50,
    'badge_score', LEAST(100, jsonb_array_length(profile_badges) * 20),
    'tenure_score', 50,
    'completed_jobs', 0,
    'total_jobs', 0
  ) INTO profile_trust_score;

  -- Build final result
  SELECT jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'display_name', COALESCE(p.full_name, 'Unknown User'),
    'avatar_url', p.avatar_url,
    'created_at', p.created_at,
    'ratings', profile_ratings,
    'badges', profile_badges,
    'skills', profile_skills,
    'trust_score', profile_trust_score
  )
  INTO result
  FROM profiles p
  WHERE p.auth_id = user_id
    AND p.deleted_at IS NULL;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO anon;