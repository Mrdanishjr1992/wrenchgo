-- COMPLETE DEPLOYMENT SCRIPT FOR PROFILE CARDS
-- Run this in Supabase SQL Editor
-- This includes all dependencies: reviews, ratings, skills, badges, and the profile card RPC

-- ============================================================================
-- STEP 1: Check if tables already exist
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
    RAISE NOTICE 'Creating reviews and ratings system tables...';
  ELSE
    RAISE NOTICE 'Reviews system already exists, skipping table creation...';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create tables only if they don't exist
-- ============================================================================

-- Skills table
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mechanic skills table
CREATE TABLE IF NOT EXISTS public.mechanic_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT false,
  verification_method TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mechanic_id, skill_id)
);

-- Add missing columns to mechanic_skills if they don't exist
ALTER TABLE public.mechanic_skills
  ADD COLUMN IF NOT EXISTS level TEXT,
  ADD COLUMN IF NOT EXISTS years_experience INTEGER;

-- Add constraint for level column (drop first if exists to avoid conflicts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mechanic_skills_level_check'
  ) THEN
    ALTER TABLE public.mechanic_skills
      ADD CONSTRAINT mechanic_skills_level_check
      CHECK (level IS NULL OR level IN ('beginner','intermediate','advanced','expert'));
  END IF;
END $$;

-- Set default and backfill level column
ALTER TABLE public.mechanic_skills ALTER COLUMN level SET DEFAULT 'intermediate';
UPDATE public.mechanic_skills SET level = 'intermediate' WHERE level IS NULL;

-- Badges table
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  badge_type TEXT NOT NULL CHECK (badge_type IN ('verified_skill', 'earned', 'admin')),
  criteria_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User badges table
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('admin', 'manual', 'system')),
  awarded_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, badge_id)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('customer', 'mechanic')),
  reviewee_role TEXT NOT NULL CHECK (reviewee_role IN ('customer', 'mechanic')),
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  performance_rating INTEGER NOT NULL CHECK (performance_rating >= 1 AND performance_rating <= 5),
  timing_rating INTEGER NOT NULL CHECK (timing_rating >= 1 AND timing_rating <= 5),
  cost_rating INTEGER NOT NULL CHECK (cost_rating >= 1 AND cost_rating <= 5),
  comment TEXT,
  is_hidden BOOLEAN DEFAULT false,
  hidden_reason TEXT,
  hidden_at TIMESTAMPTZ,
  hidden_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, reviewer_id)
);

-- ============================================================================
-- STEP 3: Create user_ratings view
-- ============================================================================

CREATE OR REPLACE VIEW public.user_ratings AS
SELECT
  reviewee_id AS user_id,
  COUNT(*) AS review_count,
  ROUND(AVG(overall_rating)::numeric, 2) AS overall_avg,
  ROUND(AVG(performance_rating)::numeric, 2) AS performance_avg,
  ROUND(AVG(timing_rating)::numeric, 2) AS timing_avg,
  ROUND(AVG(cost_rating)::numeric, 2) AS cost_avg,
  MAX(created_at) AS last_review_at
FROM public.reviews
WHERE is_hidden = false
GROUP BY reviewee_id;

-- ============================================================================
-- STEP 4: Create indexes (after level column is added)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mechanic_skills_mechanic ON public.mechanic_skills(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
-- Fixed: Remove NOW() from partial index predicate (not IMMUTABLE)
-- Option A: Index only non-expiring badges
CREATE INDEX IF NOT EXISTS idx_user_badges_active ON public.user_badges(user_id, awarded_at)
  WHERE expires_at IS NULL;
-- Option B: Add separate index for expiry checks
CREATE INDEX IF NOT EXISTS idx_user_badges_expires_at ON public.user_badges(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_public_card ON public.profiles(id, role, deleted_at)
  WHERE deleted_at IS NULL;
-- Index for mechanic skills with level ranking (created after level column is added)
CREATE INDEX IF NOT EXISTS idx_mechanic_skills_card ON public.mechanic_skills(mechanic_id, verified, level);
CREATE INDEX IF NOT EXISTS idx_reviews_job ON public.reviews(job_id);

-- ============================================================================
-- STEP 5: Enable RLS (if not already enabled)
-- ============================================================================

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create RLS policies (drop existing first to avoid conflicts)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view skills" ON public.skills;
CREATE POLICY "Anyone can view skills"
  ON public.skills FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view mechanic skills" ON public.mechanic_skills;
CREATE POLICY "Anyone can view mechanic skills"
  ON public.mechanic_skills FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view badges" ON public.badges;
CREATE POLICY "Anyone can view badges"
  ON public.badges FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view user badges" ON public.user_badges;
CREATE POLICY "Anyone can view user badges"
  ON public.user_badges FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view visible reviews" ON public.reviews;
CREATE POLICY "Anyone can view visible reviews"
  ON public.reviews FOR SELECT
  USING (is_hidden = false);

-- ============================================================================
-- STEP 7: Create the get_public_profile_card RPC function
-- ============================================================================

DROP FUNCTION IF EXISTS get_public_profile_card(uuid);

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
  v_user_id uuid := user_id;
BEGIN
  -- Fetch basic profile (public fields only)
  SELECT jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'display_name', p.full_name,
    'photo_url', p.photo_url,
    'created_at', p.created_at
  )
  INTO profile_data
  FROM profiles p
  WHERE p.id = v_user_id
    AND (p.deleted_at IS NULL OR p.deleted_at > NOW());

  -- Return null if profile not found
  IF profile_data IS NULL THEN
    RETURN NULL;
  END IF;

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
  WHERE ur.user_id = v_user_id;

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
  WHERE ub.user_id = v_user_id
    AND (ub.expires_at IS NULL OR ub.expires_at > NOW());

  -- Default empty array if no badges
  IF badges_data IS NULL THEN
    badges_data := '[]'::jsonb;
  END IF;

  -- Fetch skills (mechanic only)
  IF (profile_data->>'role') = 'mechanic' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ms.id,
        'level', ms.level,
        'years_experience', ms.years_experience,
        'is_verified', ms.verified,
        'skill', jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'category', s.category,
          'description', s.description
        )
      )
      ORDER BY
        ms.verified DESC,
        CASE ms.level
          WHEN 'expert' THEN 4
          WHEN 'advanced' THEN 3
          WHEN 'intermediate' THEN 2
          WHEN 'beginner' THEN 1
          ELSE 0
        END DESC,
        s.name ASC
    )
    INTO skills_data
    FROM mechanic_skills ms
    INNER JOIN skills s ON s.id = ms.skill_id
    WHERE ms.mechanic_id = v_user_id;

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
GRANT EXECUTE ON FUNCTION get_public_profile_card(uuid) TO anon;

-- Add comment
COMMENT ON FUNCTION get_public_profile_card(uuid) IS 
'Returns public profile card data for display in quotes flow. Only safe, public fields are returned.';

-- ============================================================================
-- DONE!
-- ============================================================================

SELECT 'Profile card RPC function created successfully!' AS status;
