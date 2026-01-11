-- ============================================================================
-- Migration: 20250111000002_baseline_rls_policies.sql
-- ============================================================================
-- Purpose: Enable RLS on all tables and create security policies
-- Dependencies: 20250111000001_baseline_consolidated.sql (all tables)
-- Risk Level: Low (idempotent with DROP POLICY IF EXISTS)
-- Rollback: N/A - baseline migration, requires full DB reset
--
-- POLICIES CREATED:
--   - profiles: own profile CRUD, public profile read
--   - vehicles: owner CRUD
--   - jobs: customer/mechanic access based on role
--   - quote_requests: customer/mechanic access
--   - reviews: public read, participant write
--   - mechanic_*: mechanic profile management
--   - lookup tables: public read
--   - messages/notifications: participant access
--   - payments: participant access
--   - badges/trust: public read, system write
--
-- WARNING: Do not modify - this migration is applied in production.
--          Create new migrations for any policy changes.
-- ============================================================================

-- =====================================================
-- CONSOLIDATED BASELINE - PART 2: RLS, POLICIES, GRANTS
-- =====================================================
-- Apply after 0000_baseline_consolidated.sql
-- =====================================================

BEGIN;

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_safety ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferred_mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_lifecycle_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rating_prompt_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SCHEMA GRANTS
-- =====================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- =====================================================
-- TABLE GRANTS (authenticated users)
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mechanic_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mechanic_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mechanic_tools TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mechanic_safety TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mechanic_stripe_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payment_methods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;

-- Read-only lookup tables
GRANT SELECT ON public.skills TO authenticated;
GRANT SELECT ON public.tools TO authenticated;
GRANT SELECT ON public.safety_measures TO authenticated;
GRANT SELECT ON public.symptoms TO authenticated;
GRANT SELECT ON public.symptom_mappings TO authenticated;
GRANT SELECT ON public.education_cards TO authenticated;
GRANT SELECT ON public.symptom_education TO authenticated;
GRANT SELECT ON public.symptom_questions TO authenticated;
GRANT SELECT ON public.badges TO authenticated;

-- Trust/moderation tables (limited access)
GRANT SELECT ON public.badge_history TO authenticated;
GRANT SELECT ON public.review_media TO authenticated;
GRANT SELECT, INSERT ON public.review_reports TO authenticated;
GRANT SELECT ON public.skill_verifications TO authenticated;
GRANT SELECT ON public.trust_scores TO authenticated;
GRANT SELECT ON public.user_violations TO authenticated;
GRANT SELECT ON public.chat_restrictions TO authenticated;
GRANT SELECT ON public.preferred_mechanics TO authenticated;
GRANT SELECT ON public.chat_lifecycle_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_rating_prompt_state TO authenticated;
GRANT SELECT ON public.chat_attachments TO authenticated;

-- Anon access for public content
GRANT SELECT ON public.media_assets TO anon;
GRANT SELECT ON public.symptoms TO anon;
GRANT SELECT ON public.symptom_mappings TO anon;
GRANT SELECT ON public.badges TO anon;

-- Service role gets full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT TO authenticated
  USING (role IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================
-- VEHICLES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "vehicles_all_own" ON public.vehicles;
CREATE POLICY "vehicles_all_own" ON public.vehicles
  FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- =====================================================
-- JOBS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "jobs_select_involved" ON public.jobs;
CREATE POLICY "jobs_select_involved" ON public.jobs
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid() 
    OR accepted_mechanic_id = auth.uid()
    OR status IN ('searching', 'quoted')
  );

DROP POLICY IF EXISTS "jobs_insert_customer" ON public.jobs;
CREATE POLICY "jobs_insert_customer" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "jobs_update_involved" ON public.jobs;
CREATE POLICY "jobs_update_involved" ON public.jobs
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() OR accepted_mechanic_id = auth.uid())
  WITH CHECK (customer_id = auth.uid() OR accepted_mechanic_id = auth.uid());

DROP POLICY IF EXISTS "jobs_delete_own" ON public.jobs;
CREATE POLICY "jobs_delete_own" ON public.jobs
  FOR DELETE TO authenticated
  USING (customer_id = auth.uid());

-- =====================================================
-- QUOTES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "quotes_select_involved" ON public.quotes;
CREATE POLICY "quotes_select_involved" ON public.quotes
  FOR SELECT TO authenticated
  USING (
    mechanic_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.customer_id = auth.uid())
  );

DROP POLICY IF EXISTS "quotes_insert_mechanic" ON public.quotes;
CREATE POLICY "quotes_insert_mechanic" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "quotes_update_involved" ON public.quotes;
CREATE POLICY "quotes_update_involved" ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    mechanic_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.customer_id = auth.uid())
  );

-- =====================================================
-- REVIEWS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
CREATE POLICY "reviews_select_public" ON public.reviews
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- =====================================================
-- MECHANIC_PROFILES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "mechanic_profiles_select_public" ON public.mechanic_profiles;
CREATE POLICY "mechanic_profiles_select_public" ON public.mechanic_profiles
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "mechanic_profiles_update_own" ON public.mechanic_profiles;
CREATE POLICY "mechanic_profiles_update_own" ON public.mechanic_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================
-- MESSAGES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "messages_select_involved" ON public.messages;
CREATE POLICY "messages_select_involved" ON public.messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
CREATE POLICY "messages_insert_sender" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "notifications_all_own" ON public.notifications;
CREATE POLICY "notifications_all_own" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- PAYMENTS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "payments_select_involved" ON public.payments;
CREATE POLICY "payments_select_involved" ON public.payments
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR mechanic_id = auth.uid());

-- =====================================================
-- SUPPORT REQUESTS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "support_requests_insert_own" ON public.support_requests;
CREATE POLICY "support_requests_insert_own" ON public.support_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_requests_select_own" ON public.support_requests;
CREATE POLICY "support_requests_select_own" ON public.support_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_requests_service_role" ON public.support_requests;
CREATE POLICY "support_requests_service_role" ON public.support_requests
  FOR ALL TO service_role
  USING (true);

-- =====================================================
-- USER_RATING_PROMPT_STATE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "rating_state_own" ON public.user_rating_prompt_state;
CREATE POLICY "rating_state_own" ON public.user_rating_prompt_state
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- LOOKUP TABLE POLICIES (read-only for authenticated)
-- =====================================================
DROP POLICY IF EXISTS "skills_select_all" ON public.skills;
CREATE POLICY "skills_select_all" ON public.skills FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tools_select_all" ON public.tools;
CREATE POLICY "tools_select_all" ON public.tools FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "safety_measures_select_all" ON public.safety_measures;
CREATE POLICY "safety_measures_select_all" ON public.safety_measures FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "symptoms_select_all" ON public.symptoms;
CREATE POLICY "symptoms_select_all" ON public.symptoms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "badges_select_all" ON public.badges;
CREATE POLICY "badges_select_all" ON public.badges FOR SELECT TO authenticated USING (true);

-- =====================================================
-- SERVICE ROLE POLICIES (full access)
-- =====================================================
DROP POLICY IF EXISTS "service_role_all_profiles" ON public.profiles;
CREATE POLICY "service_role_all_profiles" ON public.profiles FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all_jobs" ON public.jobs;
CREATE POLICY "service_role_all_jobs" ON public.jobs FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all_quotes" ON public.quotes;
CREATE POLICY "service_role_all_quotes" ON public.quotes FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all_messages" ON public.messages;
CREATE POLICY "service_role_all_messages" ON public.messages FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all_payments" ON public.payments;
CREATE POLICY "service_role_all_payments" ON public.payments FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "service_role_all_message_audit" ON public.message_audit_logs;
CREATE POLICY "service_role_all_message_audit" ON public.message_audit_logs FOR ALL TO service_role USING (true);

COMMIT;
