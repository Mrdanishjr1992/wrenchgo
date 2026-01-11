-- =====================================================
-- MIGRATION 0081: RLS HARDENING FOR NEW TABLES
-- =====================================================
-- Purpose: Enable RLS and add policies for tables created after 0002
-- This ensures all tables have proper row-level security
-- =====================================================

BEGIN;

-- =====================================================
-- ENABLE RLS ON TABLES MISSING IT
-- =====================================================

-- Trust system tables (from 0010)
ALTER TABLE IF EXISTS public.badge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.review_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.skill_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trust_scores ENABLE ROW LEVEL SECURITY;

-- Chat moderation tables (from 0047)
ALTER TABLE IF EXISTS public.message_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.preferred_mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_lifecycle_config ENABLE ROW LEVEL SECURITY;

-- Invitation/promo tables (from 0027, 0032)
ALTER TABLE IF EXISTS public.invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invitation_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Chat attachments (from 0073)
ALTER TABLE IF EXISTS public.chat_attachments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- BADGE_HISTORY POLICIES
-- =====================================================
DROP POLICY IF EXISTS "badge_history_select_own" ON public.badge_history;
CREATE POLICY "badge_history_select_own" ON public.badge_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "badge_history_service_role" ON public.badge_history;
CREATE POLICY "badge_history_service_role" ON public.badge_history
  FOR ALL TO service_role
  USING (true);

-- =====================================================
-- REVIEW_MEDIA POLICIES
-- =====================================================
DROP POLICY IF EXISTS "review_media_select_public" ON public.review_media;
CREATE POLICY "review_media_select_public" ON public.review_media
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r 
      WHERE r.id = review_id 
      AND r.deleted_at IS NULL 
      AND r.is_hidden = false
    )
  );

DROP POLICY IF EXISTS "review_media_insert_own" ON public.review_media;
CREATE POLICY "review_media_insert_own" ON public.review_media
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r 
      WHERE r.id = review_id 
      AND r.reviewer_id = auth.uid()
    )
  );

-- =====================================================
-- REVIEW_REPORTS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "review_reports_insert_own" ON public.review_reports;
CREATE POLICY "review_reports_insert_own" ON public.review_reports
  FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());

DROP POLICY IF EXISTS "review_reports_select_own" ON public.review_reports;
CREATE POLICY "review_reports_select_own" ON public.review_reports
  FOR SELECT TO authenticated
  USING (reported_by = auth.uid());

-- =====================================================
-- SKILL_VERIFICATIONS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "skill_verifications_select_own" ON public.skill_verifications;
CREATE POLICY "skill_verifications_select_own" ON public.skill_verifications
  FOR SELECT TO authenticated
  USING (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "skill_verifications_service_role" ON public.skill_verifications;
CREATE POLICY "skill_verifications_service_role" ON public.skill_verifications
  FOR ALL TO service_role
  USING (true);

-- =====================================================
-- TRUST_SCORES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "trust_scores_select_own" ON public.trust_scores;
CREATE POLICY "trust_scores_select_own" ON public.trust_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trust_scores_service_role" ON public.trust_scores;
CREATE POLICY "trust_scores_service_role" ON public.trust_scores
  FOR ALL TO service_role
  USING (true);

-- =====================================================
-- MESSAGE_AUDIT_LOGS POLICIES (admin only)
-- =====================================================
DROP POLICY IF EXISTS "message_audit_logs_service_role" ON public.message_audit_logs;
CREATE POLICY "message_audit_logs_service_role" ON public.message_audit_logs
  FOR ALL TO service_role
  USING (true);

-- =====================================================
-- USER_VIOLATIONS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "user_violations_select_own" ON public.user_violations;
CREATE POLICY "user_violations_select_own" ON public.user_violations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_violations_service_role" ON public.user_violations;
CREATE POLICY "user_violations_service_role" ON public.user_violations
  FOR ALL TO service_role
  USING (true);

-- =====================================================
-- CHAT_RESTRICTIONS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "chat_restrictions_select_own" ON public.chat_restrictions;
CREATE POLICY "chat_restrictions_select_own" ON public.chat_restrictions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_restrictions_service_role" ON public.chat_restrictions;
CREATE POLICY "chat_restrictions_service_role" ON public.chat_restrictions
  FOR ALL TO service_role
  USING (true);

-- =====================================================
-- PREFERRED_MECHANICS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "preferred_mechanics_select_involved" ON public.preferred_mechanics;
CREATE POLICY "preferred_mechanics_select_involved" ON public.preferred_mechanics
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR mechanic_id = auth.uid());

DROP POLICY IF EXISTS "preferred_mechanics_service_role" ON public.preferred_mechanics;
CREATE POLICY "preferred_mechanics_service_role" ON public.preferred_mechanics
  FOR ALL TO service_role
  USING (true);

-- =====================================================
-- CHAT_LIFECYCLE_CONFIG POLICIES
-- =====================================================
DROP POLICY IF EXISTS "chat_lifecycle_config_select_involved" ON public.chat_lifecycle_config;
CREATE POLICY "chat_lifecycle_config_select_involved" ON public.chat_lifecycle_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j 
      WHERE j.id = job_id 
      AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "chat_lifecycle_config_service_role" ON public.chat_lifecycle_config;
CREATE POLICY "chat_lifecycle_config_service_role" ON public.chat_lifecycle_config
  FOR ALL TO service_role
  USING (true);

-- =====================================================
-- GRANTS FOR NEW TABLES
-- =====================================================
GRANT SELECT ON public.badge_history TO authenticated;
GRANT SELECT ON public.review_media TO authenticated;
GRANT SELECT, INSERT ON public.review_reports TO authenticated;
GRANT SELECT ON public.skill_verifications TO authenticated;
GRANT SELECT ON public.trust_scores TO authenticated;
GRANT SELECT ON public.user_violations TO authenticated;
GRANT SELECT ON public.chat_restrictions TO authenticated;
GRANT SELECT ON public.preferred_mechanics TO authenticated;
GRANT SELECT ON public.chat_lifecycle_config TO authenticated;

-- Service role gets full access
GRANT ALL ON public.badge_history TO service_role;
GRANT ALL ON public.review_media TO service_role;
GRANT ALL ON public.review_reports TO service_role;
GRANT ALL ON public.skill_verifications TO service_role;
GRANT ALL ON public.trust_scores TO service_role;
GRANT ALL ON public.message_audit_logs TO service_role;
GRANT ALL ON public.user_violations TO service_role;
GRANT ALL ON public.chat_restrictions TO service_role;
GRANT ALL ON public.preferred_mechanics TO service_role;
GRANT ALL ON public.chat_lifecycle_config TO service_role;

COMMIT;
