-- =====================================================
-- FIX GET_PUBLIC_PROFILE_CARD RPC - HANDLE MISSING REVIEWS TABLE
-- =====================================================
-- Purpose: Return default ratings since reviews table doesn't exist yet
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
BEGIN
  -- Return default ratings (reviews table doesn't exist yet)
  profile_ratings := jsonb_build_object(
    'overall_avg', 0,
    'performance_avg', 0,
    'timing_avg', 0,
    'cost_avg', 0,
    'review_count', 0
  );

  -- Get badges data
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ub.id,
      'badge_id', ub.badge_id,
      'awarded_at', ub.created_at,
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
  WHERE ub.user_id = user_id;

  -- Get skills data (for mechanics only)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ms.id,
      'level', ms.level,
      'years_experience', COALESCE(ms.years_experience, 0),
      'is_verified', COALESCE(ms.is_verified, false),
      'skill', jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'category', s.category,
        'description', COALESCE(s.description, '')
      )
    )
  ), '[]'::jsonb)
  INTO profile_skills
  FROM mechanic_skills ms
  INNER JOIN skills s ON s.id = ms.skill_id
  WHERE ms.mechanic_id = user_id
    AND ms.deleted_at IS NULL;

  -- Build final result
  SELECT jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'display_name', COALESCE(p.full_name, 'Unknown User'),
    'avatar_url', p.avatar_url,
    'created_at', p.created_at,
    'ratings', profile_ratings,
    'badges', profile_badges,
    'skills', profile_skills
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
