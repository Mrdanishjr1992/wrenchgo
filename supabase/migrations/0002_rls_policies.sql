-- =====================================================
-- MIGRATION 0002: RLS POLICIES
-- =====================================================
-- Purpose: Enable RLS and create all security policies
-- Depends on: 0001_baseline_schema.sql
-- =====================================================

BEGIN;

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
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

-- Anon access for public content
GRANT SELECT ON public.media_assets TO anon;
GRANT SELECT ON public.symptoms TO anon;
GRANT SELECT ON public.symptom_mappings TO anon;

-- =====================================================
-- PROFILES POLICIES
-- User can read their own profile always
-- User can read other profiles with a role set (public directory)
-- User can only update their own profile
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
-- VEHICLES POLICIES (owner only)
-- =====================================================
DROP POLICY IF EXISTS "vehicles_all_own" ON public.vehicles;
CREATE POLICY "vehicles_all_own" ON public.vehicles
  FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- =====================================================
-- JOBS POLICIES
-- Customer can see their own jobs
-- Mechanic can see jobs they're assigned to
-- Mechanics can see jobs in searching/quoted status (leads)
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
-- QUOTE_REQUESTS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "quote_requests_select_involved" ON public.quote_requests;
CREATE POLICY "quote_requests_select_involved" ON public.quote_requests
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR mechanic_id = auth.uid());

DROP POLICY IF EXISTS "quote_requests_insert_mechanic" ON public.quote_requests;
CREATE POLICY "quote_requests_insert_mechanic" ON public.quote_requests
  FOR INSERT TO authenticated
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "quote_requests_update_involved" ON public.quote_requests;
CREATE POLICY "quote_requests_update_involved" ON public.quote_requests
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() OR mechanic_id = auth.uid())
  WITH CHECK (customer_id = auth.uid() OR mechanic_id = auth.uid());

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
-- Owner can do everything
-- Public can read (for browsing mechanics)
-- =====================================================
DROP POLICY IF EXISTS "mechanic_profiles_select_own" ON public.mechanic_profiles;
CREATE POLICY "mechanic_profiles_select_own" ON public.mechanic_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "mechanic_profiles_select_public" ON public.mechanic_profiles;
CREATE POLICY "mechanic_profiles_select_public" ON public.mechanic_profiles
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "mechanic_profiles_insert_own" ON public.mechanic_profiles;
CREATE POLICY "mechanic_profiles_insert_own" ON public.mechanic_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "mechanic_profiles_update_own" ON public.mechanic_profiles;
CREATE POLICY "mechanic_profiles_update_own" ON public.mechanic_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================
-- MECHANIC SKILLS/TOOLS/SAFETY POLICIES
-- Owner can manage their own
-- Public can read (for viewing mechanic capabilities)
-- =====================================================
DROP POLICY IF EXISTS "mechanic_skills_select_public" ON public.mechanic_skills;
CREATE POLICY "mechanic_skills_select_public" ON public.mechanic_skills
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mechanic_skills_manage_own" ON public.mechanic_skills;
CREATE POLICY "mechanic_skills_manage_own" ON public.mechanic_skills
  FOR ALL TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "mechanic_tools_select_public" ON public.mechanic_tools;
CREATE POLICY "mechanic_tools_select_public" ON public.mechanic_tools
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mechanic_tools_manage_own" ON public.mechanic_tools;
CREATE POLICY "mechanic_tools_manage_own" ON public.mechanic_tools
  FOR ALL TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "mechanic_safety_select_public" ON public.mechanic_safety;
CREATE POLICY "mechanic_safety_select_public" ON public.mechanic_safety
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mechanic_safety_manage_own" ON public.mechanic_safety;
CREATE POLICY "mechanic_safety_manage_own" ON public.mechanic_safety
  FOR ALL TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

-- =====================================================
-- LOOKUP TABLES POLICIES (public read)
-- =====================================================
DROP POLICY IF EXISTS "skills_select_all" ON public.skills;
CREATE POLICY "skills_select_all" ON public.skills
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tools_select_all" ON public.tools;
CREATE POLICY "tools_select_all" ON public.tools
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "safety_measures_select_all" ON public.safety_measures;
CREATE POLICY "safety_measures_select_all" ON public.safety_measures
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "symptoms_select_all" ON public.symptoms;
CREATE POLICY "symptoms_select_all" ON public.symptoms
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "symptom_mappings_select_all" ON public.symptom_mappings;
CREATE POLICY "symptom_mappings_select_all" ON public.symptom_mappings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "education_cards_select_all" ON public.education_cards;
CREATE POLICY "education_cards_select_all" ON public.education_cards
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "symptom_education_select_all" ON public.symptom_education;
CREATE POLICY "symptom_education_select_all" ON public.symptom_education
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "symptom_questions_select_all" ON public.symptom_questions;
CREATE POLICY "symptom_questions_select_all" ON public.symptom_questions
  FOR SELECT USING (true);

-- =====================================================
-- MESSAGES POLICIES
-- =====================================================
DROP POLICY IF EXISTS "messages_select_involved" ON public.messages;
CREATE POLICY "messages_select_involved" ON public.messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_update_recipient" ON public.messages;
CREATE POLICY "messages_update_recipient" ON public.messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- =====================================================
-- NOTIFICATIONS POLICIES (owner only)
-- =====================================================
DROP POLICY IF EXISTS "notifications_all_own" ON public.notifications;
CREATE POLICY "notifications_all_own" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- MEDIA_ASSETS POLICIES
-- Public assets (no owner) - anyone can read
-- Owner can manage their own
-- Job participants can read job media
-- =====================================================
DROP POLICY IF EXISTS "media_assets_select_public" ON public.media_assets;
CREATE POLICY "media_assets_select_public" ON public.media_assets
  FOR SELECT
  USING (uploaded_by IS NULL AND job_id IS NULL);

DROP POLICY IF EXISTS "media_assets_select_own" ON public.media_assets;
CREATE POLICY "media_assets_select_own" ON public.media_assets
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "media_assets_select_job" ON public.media_assets;
CREATE POLICY "media_assets_select_job" ON public.media_assets
  FOR SELECT TO authenticated
  USING (
    job_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = media_assets.job_id
      AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "media_assets_insert_own" ON public.media_assets;
CREATE POLICY "media_assets_insert_own" ON public.media_assets
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() OR uploaded_by IS NULL);

DROP POLICY IF EXISTS "media_assets_update_own" ON public.media_assets;
CREATE POLICY "media_assets_update_own" ON public.media_assets
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "media_assets_delete_own" ON public.media_assets;
CREATE POLICY "media_assets_delete_own" ON public.media_assets
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

-- =====================================================
-- STRIPE/PAYMENT POLICIES
-- =====================================================
DROP POLICY IF EXISTS "mechanic_stripe_accounts_all_own" ON public.mechanic_stripe_accounts;
CREATE POLICY "mechanic_stripe_accounts_all_own" ON public.mechanic_stripe_accounts
  FOR ALL TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "customer_payment_methods_all_own" ON public.customer_payment_methods;
CREATE POLICY "customer_payment_methods_all_own" ON public.customer_payment_methods
  FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "payments_select_involved" ON public.payments;
CREATE POLICY "payments_select_involved" ON public.payments
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR mechanic_id = auth.uid());

DROP POLICY IF EXISTS "payments_insert_customer" ON public.payments;
CREATE POLICY "payments_insert_customer" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "payments_update_involved" ON public.payments;
CREATE POLICY "payments_update_involved" ON public.payments
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() OR mechanic_id = auth.uid());

COMMIT;
