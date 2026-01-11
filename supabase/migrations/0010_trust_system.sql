-- =====================================================
-- MIGRATION 0010: TRUST & REPUTATION SYSTEM
-- =====================================================
-- Purpose: Post-completion trust system with blind reviews,
--          badges, skill verification, and trust scores
-- =====================================================

BEGIN;

-- =====================================================
-- ENUMS
-- =====================================================

DO $$ BEGIN
  CREATE TYPE public.badge_category AS ENUM (
    'milestone',        -- Jobs completed milestones
    'quality',          -- Rating-based badges
    'reliability',      -- On-time, completion rate
    'skill',            -- Skill verification badges
    'special'           -- Platform-awarded special badges
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.review_visibility AS ENUM (
    'hidden',           -- Not yet visible (blind period)
    'visible',          -- Visible to all
    'moderated'         -- Hidden by moderation
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'flagged'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.report_reason AS ENUM (
    'fake_review',
    'harassment',
    'spam',
    'inappropriate',
    'conflict_of_interest',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- ALTER TABLE: badges (add new columns to existing table)
-- Using text type for category to avoid enum issues
-- =====================================================
ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tier int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS criteria_type text,
  ADD COLUMN IF NOT EXISTS criteria_threshold numeric,
  ADD COLUMN IF NOT EXISTS criteria_window_days int,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_priority int DEFAULT 100;

-- Update existing badges to have defaults
UPDATE public.badges SET category = 'special' WHERE category IS NULL;
UPDATE public.badges SET criteria_type = 'manual' WHERE criteria_type IS NULL;
UPDATE public.badges SET criteria_threshold = 0 WHERE criteria_threshold IS NULL;

-- =====================================================
-- ALTER TABLE: user_badges (add new columns)
-- =====================================================
ALTER TABLE public.user_badges
  ADD COLUMN IF NOT EXISTS awarded_reason text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text,
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id);

-- =====================================================
-- TABLE: badge_history (audit trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.badge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  action text NOT NULL,                   -- 'awarded', 'revoked', 'expired'
  reason text,
  triggered_by uuid REFERENCES public.profiles(id),
  job_id uuid REFERENCES public.jobs(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.badge_history IS 'Audit trail for badge awards and revocations';

-- =====================================================
-- ALTER TABLE: reviews (add blind review columns)
-- =====================================================
ALTER TABLE public.reviews 
  ADD COLUMN IF NOT EXISTS visibility public.review_visibility DEFAULT 'hidden',
  ADD COLUMN IF NOT EXISTS made_visible_at timestamptz,
  ADD COLUMN IF NOT EXISTS visibility_reason text,
  ADD COLUMN IF NOT EXISTS blind_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_status public.moderation_status DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS moderation_note text,
  ADD COLUMN IF NOT EXISTS professionalism_rating int,
  ADD COLUMN IF NOT EXISTS communication_rating int,
  ADD COLUMN IF NOT EXISTS would_recommend boolean;

-- Add constraint for new rating columns
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_professionalism_rating_range;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_professionalism_rating_range 
  CHECK (professionalism_rating IS NULL OR (professionalism_rating >= 1 AND professionalism_rating <= 5));

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_communication_rating_range;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_communication_rating_range 
  CHECK (communication_rating IS NULL OR (communication_rating >= 1 AND communication_rating <= 5));

-- =====================================================
-- TABLE: review_media (photos attached to reviews)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.review_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  url text NOT NULL,
  thumbnail_url text,
  media_type text DEFAULT 'image',        -- 'image', 'video'
  caption text,
  sort_order int DEFAULT 0,
  is_before boolean DEFAULT false,        -- Before/after indicator
  moderation_status public.moderation_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.review_media IS 'Photos and media attached to reviews';

-- =====================================================
-- TABLE: review_reports (flagged reviews for moderation)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason public.report_reason NOT NULL,
  details text,
  status public.moderation_status DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  resolution_note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(review_id, reported_by)          -- One report per user per review
);

COMMENT ON TABLE public.review_reports IS 'User reports against reviews';

-- =====================================================
-- TABLE: skill_verifications (track skill verification via jobs)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.skill_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_key text NOT NULL REFERENCES public.skills(key) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_rating int,                    -- Rating from customer on this job
  verification_weight numeric DEFAULT 1,  -- Weight based on job complexity
  verified_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(mechanic_id, skill_key, job_id)
);

COMMENT ON TABLE public.skill_verifications IS 'Track skill verifications through completed jobs';

-- =====================================================
-- ALTER TABLE: mechanic_skills (add verification counts)
-- =====================================================
ALTER TABLE public.mechanic_skills
  ADD COLUMN IF NOT EXISTS verified_job_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_job_rating numeric(3,2),
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- =====================================================
-- TABLE: trust_scores (user trust/reputation scores)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Composite score (0-100)
  overall_score int DEFAULT 50 NOT NULL,
  
  -- Component scores (0-100 each)
  rating_score int DEFAULT 50,            -- Based on review ratings
  completion_score int DEFAULT 100,       -- Job completion rate
  reliability_score int DEFAULT 50,       -- On-time, cancellation rate
  badge_score int DEFAULT 0,              -- Badge weight
  tenure_score int DEFAULT 0,             -- Time on platform
  
  -- Stats
  total_jobs int DEFAULT 0,
  completed_jobs int DEFAULT 0,
  cancelled_jobs int DEFAULT 0,
  disputed_jobs int DEFAULT 0,
  no_show_count int DEFAULT 0,
  
  -- Review stats
  reviews_given int DEFAULT 0,
  reviews_received int DEFAULT 0,
  avg_rating_given numeric(3,2),
  avg_rating_received numeric(3,2),
  
  -- Timestamps
  last_calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(user_id)
);

COMMENT ON TABLE public.trust_scores IS 'Calculated trust/reputation scores for users';

-- =====================================================
-- TABLE: trust_score_history (snapshots for trending)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.trust_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall_score int NOT NULL,
  rating_score int,
  completion_score int,
  reliability_score int,
  badge_score int,
  tenure_score int,
  snapshot_reason text,                   -- 'job_completed', 'review_received', 'weekly', etc.
  job_id uuid REFERENCES public.jobs(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.trust_score_history IS 'Historical snapshots of trust scores';

-- =====================================================
-- TABLE: review_prompts (track pending review requests)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.review_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_role public.user_role NOT NULL,    -- Role of user being prompted
  prompted_at timestamptz DEFAULT now() NOT NULL,
  reminder_count int DEFAULT 0,
  last_reminder_at timestamptz,
  completed_at timestamptz,               -- When review was submitted
  expires_at timestamptz NOT NULL,        -- When prompt expires
  
  UNIQUE(job_id, user_id)
);

COMMENT ON TABLE public.review_prompts IS 'Track review prompts and reminders';

-- =====================================================
-- INDEXES
-- =====================================================

-- Badges
CREATE INDEX IF NOT EXISTS idx_badges_category ON public.badges(category);
CREATE INDEX IF NOT EXISTS idx_badges_active ON public.badges(is_active) WHERE is_active = true;

-- User badges
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON public.user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_active ON public.user_badges(user_id)
  WHERE revoked_at IS NULL;

-- Badge history
CREATE INDEX IF NOT EXISTS idx_badge_history_user ON public.badge_history(user_id);
CREATE INDEX IF NOT EXISTS idx_badge_history_badge ON public.badge_history(badge_id);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_visibility ON public.reviews(visibility);
CREATE INDEX IF NOT EXISTS idx_reviews_blind_deadline ON public.reviews(blind_deadline)
  WHERE visibility = 'hidden' AND blind_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_moderation ON public.reviews(moderation_status)
  WHERE moderation_status = 'pending';

-- Review media
CREATE INDEX IF NOT EXISTS idx_review_media_review ON public.review_media(review_id);

-- Review reports
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON public.review_reports(status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_review_reports_review ON public.review_reports(review_id);

-- Skill verifications
CREATE INDEX IF NOT EXISTS idx_skill_verifications_mechanic ON public.skill_verifications(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_skill_verifications_skill ON public.skill_verifications(skill_key);
CREATE INDEX IF NOT EXISTS idx_skill_verifications_job ON public.skill_verifications(job_id);

-- Trust scores
CREATE INDEX IF NOT EXISTS idx_trust_scores_user ON public.trust_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_overall ON public.trust_scores(overall_score DESC);

-- Trust score history
CREATE INDEX IF NOT EXISTS idx_trust_score_history_user ON public.trust_score_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_score_history_time ON public.trust_score_history(created_at DESC);

-- Review prompts
CREATE INDEX IF NOT EXISTS idx_review_prompts_user ON public.review_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_review_prompts_pending ON public.review_prompts(user_id)
  WHERE completed_at IS NULL;

-- =====================================================
-- SEED DATA: Default badges
-- =====================================================

INSERT INTO public.badges (code, title, description, icon, category, tier, criteria_type, criteria_threshold, display_priority)
VALUES
  -- Milestone badges
  ('first_job', 'First Job', 'Completed your first job', '🎉', 'milestone', 1, 'jobs_completed', 1, 10),
  ('jobs_5', 'Rising Star', 'Completed 5 jobs', '⭐', 'milestone', 1, 'jobs_completed', 5, 20),
  ('jobs_10', 'Experienced', 'Completed 10 jobs', '🔧', 'milestone', 2, 'jobs_completed', 10, 30),
  ('jobs_25', 'Seasoned Pro', 'Completed 25 jobs', '🏆', 'milestone', 2, 'jobs_completed', 25, 40),
  ('jobs_50', 'Expert', 'Completed 50 jobs', '💎', 'milestone', 3, 'jobs_completed', 50, 50),
  ('jobs_100', 'Master Mechanic', 'Completed 100 jobs', '👑', 'milestone', 3, 'jobs_completed', 100, 60),
  
  -- Quality badges
  ('high_rated', 'Highly Rated', 'Maintained 4.5+ rating over 10+ reviews', '🌟', 'quality', 2, 'avg_rating', 4.5, 15),
  ('perfect_score', 'Perfect Score', '5.0 average rating with 5+ reviews', '💯', 'quality', 3, 'avg_rating', 5.0, 5),
  ('recommended', 'Highly Recommended', '90%+ would recommend rate', '👍', 'quality', 2, 'recommend_rate', 90, 25),
  
  -- Reliability badges
  ('on_time', 'Punctual Pro', '95%+ on-time arrival rate', '⏰', 'reliability', 2, 'on_time_rate', 95, 35),
  ('reliable', 'Reliable', '98%+ job completion rate', '✅', 'reliability', 2, 'completion_rate', 98, 45),
  ('quick_responder', 'Quick Responder', 'Average quote response under 30 minutes', '⚡', 'reliability', 1, 'response_time', 30, 55),
  
  -- Skill badges
  ('verified_skill', 'Verified Specialist', 'Skill verified through 3+ successful jobs', '✓', 'skill', 1, 'skill_jobs', 3, 70),
  ('multi_skilled', 'Multi-Skilled', '5+ verified skills', '🛠️', 'skill', 2, 'verified_skills', 5, 65),
  
  -- Special badges
  ('early_adopter', 'Early Adopter', 'Joined during platform launch', '🚀', 'special', 1, 'manual', 1, 80),
  ('top_performer', 'Top Performer', 'Top 10% in your area this month', '🏅', 'special', 3, 'top_percentile', 10, 1)
ON CONFLICT (code) DO NOTHING;

COMMIT;
