-- =====================================================
-- MIGRATION 0012: TRUST SYSTEM RLS POLICIES
-- =====================================================

BEGIN;

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_prompts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON public.badges TO authenticated;
GRANT SELECT ON public.badges TO anon;

GRANT SELECT, INSERT ON public.user_badges TO authenticated;
GRANT SELECT ON public.user_badges TO anon;

GRANT SELECT ON public.badge_history TO authenticated;

GRANT SELECT, INSERT ON public.review_media TO authenticated;

GRANT SELECT, INSERT ON public.review_reports TO authenticated;

GRANT SELECT ON public.skill_verifications TO authenticated;

GRANT SELECT ON public.trust_scores TO authenticated;
GRANT SELECT ON public.trust_scores TO anon;

GRANT SELECT ON public.trust_score_history TO authenticated;

GRANT SELECT, UPDATE ON public.review_prompts TO authenticated;

-- Service role gets full access
GRANT ALL ON public.badges TO service_role;
GRANT ALL ON public.user_badges TO service_role;
GRANT ALL ON public.badge_history TO service_role;
GRANT ALL ON public.review_media TO service_role;
GRANT ALL ON public.review_reports TO service_role;
GRANT ALL ON public.skill_verifications TO service_role;
GRANT ALL ON public.trust_scores TO service_role;
GRANT ALL ON public.trust_score_history TO service_role;
GRANT ALL ON public.review_prompts TO service_role;

-- =====================================================
-- BADGES POLICIES
-- =====================================================

DROP POLICY IF EXISTS "badges_select_public" ON public.badges;
CREATE POLICY "badges_select_public" ON public.badges
  FOR SELECT USING (is_active = true);

-- =====================================================
-- USER_BADGES POLICIES
-- =====================================================

DROP POLICY IF EXISTS "user_badges_select_public" ON public.user_badges;
CREATE POLICY "user_badges_select_public" ON public.user_badges
  FOR SELECT USING (
    revoked_at IS NULL 
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "user_badges_insert_system" ON public.user_badges;
CREATE POLICY "user_badges_insert_system" ON public.user_badges
  FOR INSERT WITH CHECK (
    source = 'system' OR auth.uid() = user_id
  );

-- =====================================================
-- BADGE_HISTORY POLICIES
-- =====================================================

DROP POLICY IF EXISTS "badge_history_select_own" ON public.badge_history;
CREATE POLICY "badge_history_select_own" ON public.badge_history
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- REVIEW_MEDIA POLICIES
-- =====================================================

DROP POLICY IF EXISTS "review_media_select_visible" ON public.review_media;
CREATE POLICY "review_media_select_visible" ON public.review_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reviews r 
      WHERE r.id = review_id 
      AND (r.visibility = 'visible' OR r.reviewer_id = auth.uid() OR r.reviewee_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "review_media_insert_own" ON public.review_media;
CREATE POLICY "review_media_insert_own" ON public.review_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r 
      WHERE r.id = review_id 
      AND r.reviewer_id = auth.uid()
    )
  );

-- =====================================================
-- REVIEW_REPORTS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "review_reports_select_own" ON public.review_reports;
CREATE POLICY "review_reports_select_own" ON public.review_reports
  FOR SELECT USING (auth.uid() = reported_by);

DROP POLICY IF EXISTS "review_reports_insert_auth" ON public.review_reports;
CREATE POLICY "review_reports_insert_auth" ON public.review_reports
  FOR INSERT WITH CHECK (
    auth.uid() = reported_by
    AND EXISTS (
      SELECT 1 FROM public.reviews r 
      WHERE r.id = review_id 
      AND r.reviewee_id = auth.uid()  -- Can only report reviews about yourself
    )
  );

-- =====================================================
-- SKILL_VERIFICATIONS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "skill_verifications_select_public" ON public.skill_verifications;
CREATE POLICY "skill_verifications_select_public" ON public.skill_verifications
  FOR SELECT USING (true);

-- =====================================================
-- TRUST_SCORES POLICIES
-- =====================================================

DROP POLICY IF EXISTS "trust_scores_select_public" ON public.trust_scores;
CREATE POLICY "trust_scores_select_public" ON public.trust_scores
  FOR SELECT USING (true);

-- =====================================================
-- TRUST_SCORE_HISTORY POLICIES
-- =====================================================

DROP POLICY IF EXISTS "trust_score_history_select_own" ON public.trust_score_history;
CREATE POLICY "trust_score_history_select_own" ON public.trust_score_history
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- REVIEW_PROMPTS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "review_prompts_select_own" ON public.review_prompts;
CREATE POLICY "review_prompts_select_own" ON public.review_prompts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "review_prompts_update_own" ON public.review_prompts;
CREATE POLICY "review_prompts_update_own" ON public.review_prompts
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- REVIEWS POLICIES (updated for blind reviews)
-- =====================================================

DROP POLICY IF EXISTS "reviews_select_visible" ON public.reviews;
CREATE POLICY "reviews_select_visible" ON public.reviews
  FOR SELECT USING (
    -- Always see your own reviews (given or received)
    reviewer_id = auth.uid() 
    OR reviewee_id = auth.uid()
    -- Or visible reviews
    OR (visibility = 'visible' AND is_hidden = false AND deleted_at IS NULL)
  );

COMMIT;
