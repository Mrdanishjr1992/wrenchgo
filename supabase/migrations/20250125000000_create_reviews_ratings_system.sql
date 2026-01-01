-- ============================================================================
-- Migration: Reviews, Ratings, Skills & Badges System (FIXED for Supabase)
-- Fixes:
-- 1) Never compare profiles.role enum to 'admin' or 'service_role'
-- 2) Use auth.role() = 'service_role' for admin/service access
-- 3) Fix partial index predicate (no NOW() in predicate)
-- 4) Fix a broken CREATE INDEX syntax
-- ============================================================================

-- ============================================================================
-- PART 1: PROFILE ENHANCEMENTS
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS service_area TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS radius_miles INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS required_fields_missing JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_service_area ON public.profiles(service_area) WHERE service_area IS NOT NULL;

-- Only create this index if role column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='role'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_available
      ON public.profiles(is_available)
      WHERE role = 'mechanic';
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.display_name IS 'Public display name (defaults to full_name)';
COMMENT ON COLUMN public.profiles.city IS 'City location for profile display';
COMMENT ON COLUMN public.profiles.service_area IS 'Service area description for mechanics';
COMMENT ON COLUMN public.profiles.bio IS 'User bio/description';
COMMENT ON COLUMN public.profiles.radius_miles IS 'Service radius for mechanics (miles)';
COMMENT ON COLUMN public.profiles.is_available IS 'Mechanic availability status';
COMMENT ON COLUMN public.profiles.profile_complete IS 'Whether profile has all required fields';
COMMENT ON COLUMN public.profiles.required_fields_missing IS 'Array of missing required field names';

-- ============================================================================
-- PART 2: SKILLS SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills(category);

COMMENT ON TABLE public.skills IS 'Master list of mechanic skills';

CREATE TABLE IF NOT EXISTS public.mechanic_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years_experience INTEGER,
  is_verified BOOLEAN DEFAULT false,
  verification_method TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mechanic_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_mechanic_skills_mechanic ON public.mechanic_skills(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_skills_skill ON public.mechanic_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_skills_verified
  ON public.mechanic_skills(is_verified)
  WHERE is_verified = true;

-- ============================================================================
-- PART 3: BADGES SYSTEM
-- ============================================================================

-- NOTE: badge_type is NOT related to Supabase auth roles. Keep it app-defined.
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

CREATE INDEX IF NOT EXISTS idx_badges_type ON public.badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_badges_code ON public.badges(code);

-- NOTE: source is NOT related to Supabase auth roles. Keep it app-defined.
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('admin', 'manual', 'system')),
  awarded_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON public.user_badges(badge_id);

-- Fixed partial index: remove NOW() usage (must be IMMUTABLE)
DROP INDEX IF EXISTS public.idx_user_badges_active;
CREATE INDEX IF NOT EXISTS idx_user_badges_active
  ON public.user_badges (user_id, awarded_at)
  WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_badges_expires_at
  ON public.user_badges (user_id, expires_at);

-- ============================================================================
-- PART 4: REVIEWS SYSTEM
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_reviews_job ON public.reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_visible
  ON public.reviews(reviewee_id, created_at DESC)
  WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_reviews_created ON public.reviews(created_at DESC);

CREATE TABLE IF NOT EXISTS public.review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'fake', 'harassment', 'other')),
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review ON public.review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status
  ON public.review_reports(status)
  WHERE status = 'pending';

-- ============================================================================
-- PART 5: AGGREGATED RATINGS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.user_ratings AS
SELECT
  reviewee_id AS user_id,
  COUNT(*) AS review_count,
  ROUND(AVG(overall_rating)::numeric, 2) AS avg_overall_rating,
  ROUND(AVG(performance_rating)::numeric, 2) AS avg_performance_rating,
  ROUND(AVG(timing_rating)::numeric, 2) AS avg_timing_rating,
  ROUND(AVG(cost_rating)::numeric, 2) AS avg_cost_rating,
  MAX(created_at) AS last_review_at,
  COUNT(*) FILTER (WHERE overall_rating = 5) AS five_star_count,
  COUNT(*) FILTER (WHERE overall_rating = 4) AS four_star_count,
  COUNT(*) FILTER (WHERE overall_rating = 3) AS three_star_count,
  COUNT(*) FILTER (WHERE overall_rating = 2) AS two_star_count,
  COUNT(*) FILTER (WHERE overall_rating = 1) AS one_star_count
FROM public.reviews
WHERE is_hidden = false
GROUP BY reviewee_id;

-- ============================================================================
-- PART 6: TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_review_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reviews_timestamp ON public.reviews;
CREATE TRIGGER update_reviews_timestamp
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_review_timestamp();

DROP TRIGGER IF EXISTS update_mechanic_skills_timestamp ON public.mechanic_skills;
CREATE TRIGGER update_mechanic_skills_timestamp
  BEFORE UPDATE ON public.mechanic_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_review_timestamp();

-- ============================================================================
-- PART 7: ENABLE RLS
-- ============================================================================

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 8: RLS POLICIES - SKILLS
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view skills" ON public.skills;
CREATE POLICY "Anyone can view skills"
  ON public.skills FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can manage skills" ON public.skills;
CREATE POLICY "Service role can manage skills"
  ON public.skills FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PART 9: RLS POLICIES - MECHANIC SKILLS
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view mechanic skills" ON public.mechanic_skills;
CREATE POLICY "Anyone can view mechanic skills"
  ON public.mechanic_skills FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Mechanics can manage own skills" ON public.mechanic_skills;
CREATE POLICY "Mechanics can manage own skills"
  ON public.mechanic_skills FOR INSERT
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can update own skills" ON public.mechanic_skills;
CREATE POLICY "Mechanics can update own skills"
  ON public.mechanic_skills FOR UPDATE
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can delete own skills" ON public.mechanic_skills;
CREATE POLICY "Mechanics can delete own skills"
  ON public.mechanic_skills FOR DELETE
  USING (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "Service role can verify skills" ON public.mechanic_skills;
CREATE POLICY "Service role can verify skills"
  ON public.mechanic_skills FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PART 10: RLS POLICIES - BADGES
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view badges" ON public.badges;
CREATE POLICY "Anyone can view badges"
  ON public.badges FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can manage badges" ON public.badges;
CREATE POLICY "Service role can manage badges"
  ON public.badges FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PART 11: RLS POLICIES - USER BADGES
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view user badges" ON public.user_badges;
CREATE POLICY "Anyone can view user badges"
  ON public.user_badges FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can award badges" ON public.user_badges;
CREATE POLICY "Service role can award badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can remove badges" ON public.user_badges;
CREATE POLICY "Service role can remove badges"
  ON public.user_badges FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 12: RLS POLICIES - REVIEWS
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view visible reviews" ON public.reviews;
CREATE POLICY "Anyone can view visible reviews"
  ON public.reviews FOR SELECT
  USING (is_hidden = false OR reviewer_id = auth.uid() OR reviewee_id = auth.uid());

DROP POLICY IF EXISTS "Users can create reviews for completed jobs" ON public.reviews;
CREATE POLICY "Users can create reviews for completed jobs"
  ON public.reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_id
        AND jobs.status = 'completed'
        AND (
          (jobs.customer_id = auth.uid() AND reviewer_role = 'customer')
          OR (jobs.accepted_mechanic_id = auth.uid() AND reviewer_role = 'mechanic')
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own reviews within 24h" ON public.reviews;
CREATE POLICY "Users can update own reviews within 24h"
  ON public.reviews FOR UPDATE
  USING (reviewer_id = auth.uid() AND created_at > now() - interval '24 hours')
  WITH CHECK (reviewer_id = auth.uid() AND created_at > now() - interval '24 hours');

DROP POLICY IF EXISTS "Service role can hide reviews" ON public.reviews;
CREATE POLICY "Service role can hide reviews"
  ON public.reviews FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PART 13: RLS POLICIES - REVIEW REPORTS
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can report reviews" ON public.review_reports;
CREATE POLICY "Authenticated users can report reviews"
  ON public.review_reports FOR INSERT
  WITH CHECK (reported_by = auth.uid());

DROP POLICY IF EXISTS "Users can view own reports" ON public.review_reports;
CREATE POLICY "Users can view own reports"
  ON public.review_reports FOR SELECT
  USING (reported_by = auth.uid());

DROP POLICY IF EXISTS "Service role can view all reports" ON public.review_reports;
CREATE POLICY "Service role can view all reports"
  ON public.review_reports FOR SELECT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update reports" ON public.review_reports;
CREATE POLICY "Service role can update reports"
  ON public.review_reports FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PART 14: EXTRA PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reviews_overall_rating
  ON public.reviews(overall_rating)
  WHERE is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_mechanic_skills_level
  ON public.mechanic_skills(level, is_verified);

CREATE INDEX IF NOT EXISTS idx_user_badges_expires
  ON public.user_badges(expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================================
-- PART 15: GRANTS
-- ============================================================================

GRANT SELECT ON public.skills TO anon, authenticated;
GRANT SELECT ON public.mechanic_skills TO anon, authenticated;
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT SELECT ON public.user_ratings TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.mechanic_skills TO authenticated;
GRANT INSERT, UPDATE ON public.reviews TO authenticated;
GRANT INSERT ON public.review_reports TO authenticated;

-- ============================================================================
-- ANALYZE
-- ============================================================================
ANALYZE public.skills;
ANALYZE public.mechanic_skills;
ANALYZE public.badges;
ANALYZE public.user_badges;
ANALYZE public.reviews;
ANALYZE public.review_reports;
