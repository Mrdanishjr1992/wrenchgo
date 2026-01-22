-- ===================================================================
-- WrenchGo: baseline split (security, RLS, grants)
-- Generated: 2026-01-22
-- Source: reset-baseline
-- Run these files in order (0001 -> 0011).
-- ===================================================================

SET search_path TO public, extensions;


-- RLS is enabled by default for Supabase projects.
-- Policies below are minimal and align with the 7 core tables.

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- PROFILES
-- -------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- -------------------------
-- VEHICLES (owned by customer)
-- -------------------------
DROP POLICY IF EXISTS "vehicles_crud_own" ON public.vehicles;
CREATE POLICY "vehicles_crud_own"
ON public.vehicles
FOR ALL
TO authenticated
USING (customer_id = auth.uid())
WITH CHECK (customer_id = auth.uid());

-- -------------------------
-- MECHANIC_PROFILES (owned by mechanic)
-- -------------------------
DROP POLICY IF EXISTS "mechanic_profiles_read_authenticated" ON public.mechanic_profiles;
CREATE POLICY "mechanic_profiles_read_authenticated"
ON public.mechanic_profiles
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "mechanic_profiles_write_own" ON public.mechanic_profiles;

CREATE POLICY "mechanic_profiles_write_own"
ON public.mechanic_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());


-- -------------------------
-- JOBS
-- -------------------------
DROP POLICY IF EXISTS "jobs_select_participants" ON public.jobs;
CREATE POLICY "jobs_select_participants"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR accepted_mechanic_id = auth.uid()
);

DROP POLICY IF EXISTS "jobs_insert_customer" ON public.jobs;
CREATE POLICY "jobs_insert_customer"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "jobs_update_participants" ON public.jobs;
CREATE POLICY "jobs_update_participants"
ON public.jobs
FOR UPDATE
TO authenticated
USING (
  customer_id = auth.uid()
  OR accepted_mechanic_id = auth.uid()
)
WITH CHECK (
  customer_id = auth.uid()
  OR accepted_mechanic_id = auth.uid()
);

-- -------------------------
-- QUOTES
-- Customer can read quotes for their jobs; mechanic can read/write their own.
-- -------------------------
DROP POLICY IF EXISTS "quotes_select_participants" ON public.quotes;
CREATE POLICY "quotes_select_participants"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  mechanic_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = quotes.job_id AND j.customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "quotes_insert_mechanic" ON public.quotes;
CREATE POLICY "quotes_insert_mechanic"
ON public.quotes
FOR INSERT
TO authenticated
WITH CHECK (
  mechanic_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = quotes.job_id)
);

DROP POLICY IF EXISTS "quotes_update_mechanic" ON public.quotes;
CREATE POLICY "quotes_update_mechanic"
ON public.quotes
FOR UPDATE
TO authenticated
USING (mechanic_id = auth.uid())
WITH CHECK (mechanic_id = auth.uid());

-- -------------------------
-- JOB_CONTRACTS
-- Parties can read. Writes are typically via server-side code; keep locked down.
-- -------------------------
DROP POLICY IF EXISTS "job_contracts_select_parties" ON public.job_contracts;
CREATE POLICY "job_contracts_select_parties"
ON public.job_contracts
FOR SELECT
TO authenticated
USING (customer_id = auth.uid() OR mechanic_id = auth.uid());

-- No direct INSERT/UPDATE policies here (intentionally).

-- -------------------------
-- JOB_PROGRESS
-- Parties can read. Writes are typically via server-side code.
-- -------------------------
DROP POLICY IF EXISTS "job_progress_select_parties" ON public.job_progress;
CREATE POLICY "job_progress_select_parties"
ON public.job_progress
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = job_progress.job_id
      AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
  )
);

-- Grants (minimal; Supabase manages many defaults)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.mechanic_profiles TO authenticated;
