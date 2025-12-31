-- Migration: Create public profile card RPC
-- Description: Secure function to fetch public profile data for profile cards in quotes flow
-- Security: Only returns safe, public fields; no email, phone, or private data

-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_public_profile_card(uuid);

-- Create RPC function for public profile card
CREATE OR REPLACE FUNCTION get_public_profile_card(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
  profile_data jsonb;
  ratings_data jsonb;
  badges_data jsonb;
  skills_data jsonb;
  user_role text;
BEGIN
  -- Fetch basic profile (public fields only)
  SELECT jsonb_build_object(
    'id', p.id,
    'display_name', COALESCE(p.display_name, p.full_name),
    'photo_url', p.photo_url,
    'city', p.city,
    'service_area', p.service_area,
    'bio', p.bio,
    'is_available', p.is_available,
    'created_at', p.created_at
  ), COALESCE(p.role, 'customer')
  INTO profile_data, user_role
  FROM profiles p
  WHERE p.id = user_id
    AND p.deleted_at IS NULL;

  -- Return null if profile not found
  IF profile_data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Add role to profile data
  profile_data := profile_data || jsonb_build_object('role', user_role);

  -- Fetch ratings (if exists)
  SELECT jsonb_build_object(
    'overall_avg', COALESCE(ur.overall_avg, 0),
    'performance_avg', COALESCE(ur.performance_avg, 0),
    'timing_avg', COALESCE(ur.timing_avg, 0),
    'cost_avg', COALESCE(ur.cost_avg, 0),
    'review_count', COALESCE(ur.review_count, 0)
  )
  INTO ratings_data
  FROM user_ratings ur
  WHERE ur.user_id = user_id;

  -- Default ratings if none exist
  IF ratings_data IS NULL THEN
    ratings_data := jsonb_build_object(
      'overall_avg', 0,
      'performance_avg', 0,
      'timing_avg', 0,
      'cost_avg', 0,
      'review_count', 0
    );
  END IF;

  -- Fetch active badges
  SELECT jsonb_agg(
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
    ORDER BY ub.awarded_at DESC
  )
  INTO badges_data
  FROM user_badges ub
  INNER JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = user_id
    AND (ub.expires_at IS NULL OR ub.expires_at > NOW());

  -- Default empty array if no badges
  IF badges_data IS NULL THEN
    badges_data := '[]'::jsonb;
  END IF;

  -- Fetch skills (mechanic only)
  IF user_role = 'mechanic' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ms.id,
        'level', ms.level,
        'years_experience', ms.years_experience,
        'is_verified', ms.is_verified,
        'skill', jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'category', s.category,
          'description', s.description
        )
      )
      ORDER BY ms.is_verified DESC, ms.level DESC
    )
    INTO skills_data
    FROM mechanic_skills ms
    INNER JOIN skills s ON s.id = ms.skill_id
    WHERE ms.mechanic_id = user_id;

    IF skills_data IS NULL THEN
      skills_data := '[]'::jsonb;
    END IF;
  ELSE
    skills_data := '[]'::jsonb;
  END IF;

  -- Combine all data
  result := profile_data || jsonb_build_object(
    'ratings', ratings_data,
    'badges', badges_data,
    'skills', skills_data
  );

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_public_profile_card(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_public_profile_card(uuid) IS 
'Returns public profile card data for display in quotes flow. Only safe, public fields are returned.';

-- Create index on profiles for faster lookups (without role column if it doesn't exist yet)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_public_card
    ON profiles(id, role, deleted_at)
    WHERE deleted_at IS NULL;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_profiles_public_card
    ON profiles(id, deleted_at)
    WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Create index on user_badges for faster lookups (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_badges'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_user_badges_active
    ON user_badges(user_id, awarded_at)
    WHERE expires_at IS NULL OR expires_at > NOW();
  END IF;
END $$;

-- Create index on mechanic_skills for faster lookups (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mechanic_skills'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_mechanic_skills_card
    ON mechanic_skills(mechanic_id, is_verified, level);
  END IF;
END $$;
