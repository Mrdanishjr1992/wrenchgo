-- =====================================================
-- MIGRATION 7: RLS POLICIES AND GRANTS
-- =====================================================
-- Purpose: Enable RLS and create secure policies for all tables
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
ALTER TABLE public.mechanic_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_safety ENABLE ROW LEVEL SECURITY;
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

-- =====================================================
-- TABLE GRANTS
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

-- Symptom tables are read-only for authenticated users
GRANT SELECT ON public.symptoms TO authenticated;
GRANT SELECT ON public.symptom_mappings TO authenticated;

-- Media assets can be viewed by anon (for public assets like ads)
GRANT SELECT ON public.media_assets TO anon;

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

DROP POLICY IF EXISTS "jobs_insert_own" ON public.jobs;
CREATE POLICY "jobs_insert_own" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "jobs_update_own_or_mechanic" ON public.jobs;
CREATE POLICY "jobs_update_own_or_mechanic" ON public.jobs
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
-- =====================================================
DROP POLICY IF EXISTS "mechanic_skills_all_own" ON public.mechanic_skills;
CREATE POLICY "mechanic_skills_all_own" ON public.mechanic_skills
  FOR ALL TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "mechanic_tools_all_own" ON public.mechanic_tools;
CREATE POLICY "mechanic_tools_all_own" ON public.mechanic_tools
  FOR ALL TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "mechanic_safety_all_own" ON public.mechanic_safety;
CREATE POLICY "mechanic_safety_all_own" ON public.mechanic_safety
  FOR ALL TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

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
-- NOTIFICATIONS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "notifications_all_own" ON public.notifications;
CREATE POLICY "notifications_all_own" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- MEDIA_ASSETS POLICIES
-- =====================================================
-- Policy 1: Public assets (ads, logos) - anyone can read
DROP POLICY IF EXISTS "media_assets_select_public" ON public.media_assets;
CREATE POLICY "media_assets_select_public" ON public.media_assets
  FOR SELECT
  USING (uploaded_by IS NULL AND job_id IS NULL);

-- Policy 2: Own uploads - user can read their own
DROP POLICY IF EXISTS "media_assets_select_own" ON public.media_assets;
CREATE POLICY "media_assets_select_own" ON public.media_assets
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid());

-- Policy 3: Job media - participants can read (using EXISTS to avoid RLS recursion)
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

DROP POLICY IF EXISTS "media_assets_select_public_or_involved" ON public.media_assets;

DROP POLICY IF EXISTS "media_assets_insert_own" ON public.media_assets;
CREATE POLICY "media_assets_insert_own" ON public.media_assets
  FOR INSERT TO authenticated
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

COMMIT;
