-- =====================================================
-- FIX GET_PUBLIC_PROFILE_CARD RPC - REMOVE DELETED_AT FROM MECHANIC_SKILLS
-- =====================================================
-- Purpose: Remove deleted_at check from mechanic_skills (column doesn't exist)
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
  profile_record record;
BEGIN
  -- Get the profile record first
  SELECT p.id, p.role, p.full_name, p.avatar_url, p.created_at
  INTO profile_record
  FROM profiles p
  WHERE p.auth_id = user_id
    AND p.deleted_at IS NULL;

  -- If profile not found, return null
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get ratings data using profile.id (not auth_id)
  SELECT jsonb_build_object(
    'overall_avg', COALESCE(AVG(r.overall_rating), 0),
    'performance_avg', COALESCE(AVG(r.performance_rating), 0),
    'timing_avg', COALESCE(AVG(r.timing_rating), 0),
    'cost_avg', COALESCE(AVG(r.cost_rating), 0),
    'review_count', COUNT(r.id)::integer
  )
  INTO profile_ratings
  FROM reviews r
  WHERE r.reviewee_id = profile_record.id
    AND r.is_hidden = false;

  -- Get badges data using profile.id
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
        'badge_type', b.badge_type
      )
    )
  ), '[]'::jsonb)
  INTO profile_badges
  FROM user_badges ub
  INNER JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = profile_record.id;

  -- Get skills data (for mechanics only) using profile.id
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ms.id,
      'level', ms.level,
      'years_experience', COALESCE(ms.years_experience, 0),
      'is_verified', COALESCE(ms.is_verified, false),
      'skill', jsonb_build_object(
        'id', s.id,
        'name', s.key,
        'category', s.category,
        'description', ''
      )
    )
  ), '[]'::jsonb)
  INTO profile_skills
  FROM mechanic_skills ms
  INNER JOIN skills s ON s.id = ms.skill_id
  WHERE ms.mechanic_id = profile_record.id;

  -- Build final result
  result := jsonb_build_object(
    'id', profile_record.id,
    'role', profile_record.role,
    'display_name', COALESCE(profile_record.full_name, 'Unknown User'),
    'avatar_url', profile_record.avatar_url,
    'created_at', profile_record.created_at,
    'ratings', profile_ratings,
    'badges', profile_badges,
    'skills', profile_skills
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO anon;
