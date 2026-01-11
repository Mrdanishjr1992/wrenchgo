-- =====================================================
-- MIGRATION 0014: UPDATE PROFILE CARD FOR TRUST SYSTEM
-- =====================================================

BEGIN;

-- =====================================================
-- UPDATE FUNCTION: get_public_profile_card
-- Now includes trust score and verified skill counts
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_public_profile_card(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  profile_record record;
  profile_ratings jsonb;
  profile_badges jsonb;
  profile_skills jsonb;
  profile_trust_score jsonb;
BEGIN
  -- Get the profile record
  SELECT p.id, p.role, p.full_name, p.avatar_url, p.created_at
  INTO profile_record
  FROM profiles p
  WHERE p.id = user_id
    AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get ratings from visible reviews only
  SELECT jsonb_build_object(
    'overall_avg', COALESCE(AVG(r.overall_rating), 0),
    'performance_avg', COALESCE(AVG(r.performance_rating), 0),
    'timing_avg', COALESCE(AVG(r.timing_rating), 0),
    'cost_avg', COALESCE(AVG(r.cost_rating), 0),
    'professionalism_avg', COALESCE(AVG(r.professionalism_rating), 0),
    'communication_avg', COALESCE(AVG(r.communication_rating), 0),
    'review_count', COUNT(r.id)::integer,
    'would_recommend_count', COUNT(r.id) FILTER (WHERE r.would_recommend = true)::integer,
    'would_recommend_total', COUNT(r.id) FILTER (WHERE r.would_recommend IS NOT NULL)::integer
  )
  INTO profile_ratings
  FROM reviews r
  WHERE r.reviewee_id = profile_record.id
    AND r.visibility = 'visible'
    AND r.is_hidden = false
    AND r.deleted_at IS NULL;

  -- Get badges with tier info
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ub.id,
      'badge_id', ub.badge_id,
      'awarded_at', ub.awarded_at,
      'badge', jsonb_build_object(
        'code', b.code,
        'title', b.title,
        'description', b.description,
        'icon', b.icon,
        'category', b.category,
        'tier', b.tier
      )
    ) ORDER BY b.display_priority ASC
  ), '[]'::jsonb)
  INTO profile_badges
  FROM user_badges ub
  INNER JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = profile_record.id
    AND ub.revoked_at IS NULL
    AND (ub.expires_at IS NULL OR ub.expires_at > NOW());

  -- Get skills with verification status (for mechanics only)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ms.id,
      'skill', jsonb_build_object(
        'key', s.key,
        'label', s.label,
        'category', s.category
      ),
      'is_verified', COALESCE(ms.is_verified, false),
      'verified_job_count', COALESCE(ms.verified_job_count, 0),
      'avg_job_rating', ms.avg_job_rating
    ) ORDER BY ms.is_verified DESC, ms.verified_job_count DESC
  ), '[]'::jsonb)
  INTO profile_skills
  FROM mechanic_skills ms
  INNER JOIN skills s ON s.key = ms.skill_key
  WHERE ms.mechanic_id = profile_record.id;

  -- Get trust score
  SELECT jsonb_build_object(
    'overall_score', ts.overall_score,
    'rating_score', ts.rating_score,
    'completion_score', ts.completion_score,
    'reliability_score', ts.reliability_score,
    'badge_score', ts.badge_score,
    'tenure_score', ts.tenure_score,
    'completed_jobs', ts.completed_jobs,
    'total_jobs', ts.total_jobs
  )
  INTO profile_trust_score
  FROM trust_scores ts
  WHERE ts.user_id = profile_record.id;

  -- Build result (NO email, NO phone - privacy protected)
  result := jsonb_build_object(
    'id', profile_record.id,
    'role', profile_record.role,
    'display_name', COALESCE(profile_record.full_name, 'User'),
    'avatar_url', profile_record.avatar_url,
    'created_at', profile_record.created_at,
    'ratings', profile_ratings,
    'badges', profile_badges,
    'skills', profile_skills,
    'trust_score', COALESCE(profile_trust_score, jsonb_build_object(
      'overall_score', 50,
      'rating_score', 50,
      'completion_score', 100,
      'reliability_score', 50,
      'badge_score', 0,
      'tenure_score', 0,
      'completed_jobs', 0,
      'total_jobs', 0
    ))
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO anon;

COMMIT;
