-- =====================================================
-- RLS POLICIES AND GRANTS (PRODUCTION-READY)
-- =====================================================
-- Purpose: Enable RLS, create policies, grant permissions
-- Security: Least privilege, users can only access their own data
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
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================
-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Authenticated users can read other profiles (for displaying names, avatars, etc.)
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- Users can insert their own profile (for Google sign-in fallback)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- VEHICLES POLICIES
-- =====================================================
CREATE POLICY "vehicles_select_own"
  ON public.vehicles FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "vehicles_insert_own"
  ON public.vehicles FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "vehicles_update_own"
  ON public.vehicles FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "vehicles_delete_own"
  ON public.vehicles FOR DELETE
  USING (auth.uid() = customer_id);

-- =====================================================
-- JOBS POLICIES
-- =====================================================
-- Customers can manage their own jobs
CREATE POLICY "jobs_select_own_customer"
  ON public.jobs FOR SELECT
  USING (auth.uid() = customer_id);

-- Mechanics can view jobs they're assigned to
CREATE POLICY "jobs_select_assigned_mechanic"
  ON public.jobs FOR SELECT
  USING (auth.uid() = accepted_mechanic_id);

-- Mechanics can view jobs in "searching" status (to quote)
CREATE POLICY "jobs_select_searching"
  ON public.jobs FOR SELECT
  USING (
    status = 'searching' 
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'mechanic'
    )
  );

-- Customers can insert their own jobs
CREATE POLICY "jobs_insert_own"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Customers can update their own jobs
CREATE POLICY "jobs_update_own_customer"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Mechanics can update jobs they're assigned to (status, etc.)
CREATE POLICY "jobs_update_assigned_mechanic"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = accepted_mechanic_id);

-- Customers can delete their own jobs
CREATE POLICY "jobs_delete_own"
  ON public.jobs FOR DELETE
  USING (auth.uid() = customer_id);

-- =====================================================
-- QUOTE_REQUESTS POLICIES
-- =====================================================
-- Mechanics and customers can view quotes they're involved in
CREATE POLICY "quote_requests_select_involved"
  ON public.quote_requests FOR SELECT
  USING (auth.uid() = mechanic_id OR auth.uid() = customer_id);

-- Mechanics can insert quotes for jobs
CREATE POLICY "quote_requests_insert_mechanic"
  ON public.quote_requests FOR INSERT
  WITH CHECK (auth.uid() = mechanic_id);

-- Mechanics can update their own quotes
CREATE POLICY "quote_requests_update_mechanic"
  ON public.quote_requests FOR UPDATE
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- Customers can update quotes (accept/reject)
CREATE POLICY "quote_requests_update_customer"
  ON public.quote_requests FOR UPDATE
  USING (auth.uid() = customer_id);

-- =====================================================
-- REVIEWS POLICIES
-- =====================================================
-- Anyone authenticated can read reviews (public)
CREATE POLICY "reviews_select_public"
  ON public.reviews FOR SELECT
  USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- Users can insert reviews where they are the reviewer
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- Users can update their own reviews
CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- =====================================================
-- MECHANIC_PROFILES POLICIES
-- =====================================================
-- Mechanics can read their own profile
CREATE POLICY "mechanic_profiles_select_own"
  ON public.mechanic_profiles FOR SELECT
  USING (auth.uid() = id);

-- Authenticated users can read mechanic profiles (public)
CREATE POLICY "mechanic_profiles_select_public"
  ON public.mechanic_profiles FOR SELECT
  USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- Mechanics can insert their own profile
CREATE POLICY "mechanic_profiles_insert_own"
  ON public.mechanic_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Mechanics can update their own profile
CREATE POLICY "mechanic_profiles_update_own"
  ON public.mechanic_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- MECHANIC_SKILLS POLICIES
-- =====================================================
CREATE POLICY "mechanic_skills_manage_own"
  ON public.mechanic_skills FOR ALL
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- =====================================================
-- MECHANIC_TOOLS POLICIES
-- =====================================================
CREATE POLICY "mechanic_tools_manage_own"
  ON public.mechanic_tools FOR ALL
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- =====================================================
-- MECHANIC_SAFETY POLICIES
-- =====================================================
CREATE POLICY "mechanic_safety_manage_own"
  ON public.mechanic_safety FOR ALL
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- =====================================================
-- MESSAGES POLICIES
-- =====================================================
-- Users can read messages where they are sender or recipient
CREATE POLICY "messages_select_involved"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can insert messages where they are the sender
CREATE POLICY "messages_insert_own"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they received (mark as read)
CREATE POLICY "messages_update_recipient"
  ON public.messages FOR UPDATE
  USING (auth.uid() = recipient_id);

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================
-- Users can read their own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- MEDIA_ASSETS POLICIES
-- =====================================================
-- Public assets (no job_id, no uploaded_by) are readable by ANYONE (including anon)
-- Job-related assets are readable by job participants (authenticated)
-- Uploader can always read their own assets (authenticated)
CREATE POLICY "media_assets_select_public_or_involved"
  ON public.media_assets FOR SELECT
  USING (
    (job_id IS NULL AND uploaded_by IS NULL) -- Public assets like ads (anon + authenticated)
    OR auth.uid() = uploaded_by -- Uploader (authenticated)
    OR EXISTS ( -- Job participants (authenticated)
      SELECT 1 FROM public.jobs
      WHERE jobs.id = media_assets.job_id
      AND (jobs.customer_id = auth.uid() OR jobs.accepted_mechanic_id = auth.uid())
    )
  );

-- Users can insert assets they upload
CREATE POLICY "media_assets_insert_own"
  ON public.media_assets FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by OR (job_id IS NULL AND uploaded_by IS NULL));

-- Users can delete their own assets
CREATE POLICY "media_assets_delete_own"
  ON public.media_assets FOR DELETE
  USING (auth.uid() = uploaded_by);

-- =====================================================
-- MECHANIC_STRIPE_ACCOUNTS POLICIES
-- =====================================================
CREATE POLICY "mechanic_stripe_accounts_manage_own"
  ON public.mechanic_stripe_accounts FOR ALL
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- =====================================================
-- CUSTOMER_PAYMENT_METHODS POLICIES
-- =====================================================
CREATE POLICY "customer_payment_methods_manage_own"
  ON public.customer_payment_methods FOR ALL
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- =====================================================
-- PAYMENTS POLICIES
-- =====================================================
-- Customers can view their payments
CREATE POLICY "payments_select_customer"
  ON public.payments FOR SELECT
  USING (auth.uid() = customer_id);

-- Mechanics can view their payments
CREATE POLICY "payments_select_mechanic"
  ON public.payments FOR SELECT
  USING (auth.uid() = mechanic_id);

-- Only backend/service role can insert/update payments
-- (No INSERT/UPDATE policies for authenticated users)

-- =====================================================
-- WEBHOOK_EVENTS POLICIES
-- =====================================================
-- Only service role can manage webhook events
-- (No policies for authenticated users)

-- =====================================================
-- GRANTS
-- =====================================================
-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant table permissions to authenticated role
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
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.webhook_events TO authenticated;

-- Grant SELECT on media_assets to anon role (for public assets like ads, logos)
GRANT SELECT ON public.media_assets TO anon;

-- Grant sequence usage (for default gen_random_uuid())
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;

COMMIT;
