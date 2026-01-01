-- ============================================================================
-- COMPREHENSIVE SCHEMA FIX MIGRATION (SAFE VERSION)
-- - Avoids altering enum columns used by policies
-- - Fixes policy references to correct columns
-- - Avoids adding indexes/columns that don't exist in your schema
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Drop policies that may conflict (optional but safe)
-- ============================================================================

-- Jobs policies (these names appear in your logs)
DROP POLICY IF EXISTS "Mechanics can view searching jobs" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_owner_or_assigned_or_searching" ON public.jobs;

-- If you have any reviews policy referencing jobs.status, drop it BEFORE any status work.
-- (You had: "Users can create reviews for completed jobs")
DROP POLICY IF EXISTS "Users can create reviews for completed jobs" ON public.reviews;

-- ============================================================================
-- STEP 2: Add missing columns (ONLY if they truly belong in your design)
-- ============================================================================

-- profiles.role (your schema didn't show role; your migrations expect it)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'customer';

-- vehicles.user_id (your schema currently uses vehicles.customer_id)
-- Add only if you actually intend to support both. Otherwise skip this.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- jobs.quote_id (optional)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS quote_id uuid;

-- messages.job_id (your schema already has job_id; safe to keep IF NOT EXISTS)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS job_id uuid;

-- ============================================================================
-- STEP 3: Foreign keys (ONLY where they won't conflict with existing FKs)
-- ============================================================================

-- vehicles.user_id -> profiles.id (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public'
      AND table_name='vehicles'
      AND constraint_name='vehicles_user_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- jobs.quote_id -> quote_requests.id (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public'
      AND table_name='jobs'
      AND constraint_name='jobs_quote_id_fkey'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES public.quote_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- NOTE:
-- Your schema already has:
-- jobs.customer_id -> auth.users(id)
-- jobs.accepted_mechanic_id -> auth.users(id)
-- quote_requests.* -> auth.users(id)
-- messages.sender_id -> auth.users(id)
-- So DO NOT add conflicting FKs to profiles unless you're redesigning those tables.

-- ============================================================================
-- STEP 4: Indexes (only on columns that actually exist)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON public.jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_accepted_mechanic_id ON public.jobs(accepted_mechanic_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_job_id ON public.quote_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_messages_job_id ON public.messages(job_id);

-- ============================================================================
-- STEP 5: Triggers for updated_at (optional)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 6: Recreate policies correctly (using correct mechanic_profiles column + enum)
-- ============================================================================

-- mechanic_profiles uses id (NOT user_id)
-- jobs.status is enum job_status in your schema, so cast literals:
-- 'searching'::job_status

CREATE POLICY "Mechanics can view searching jobs"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    status = 'searching'::job_status
    AND EXISTS (
      SELECT 1
      FROM public.mechanic_profiles mp
      WHERE mp.id = auth.uid()
    )
  );

CREATE POLICY "jobs_select_owner_or_assigned_or_searching"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR accepted_mechanic_id = auth.uid()
    OR (
      status = 'searching'::job_status
      AND EXISTS (
        SELECT 1
        FROM public.mechanic_profiles mp
        WHERE mp.id = auth.uid()
      )
    )
  );

-- Recreate the reviews policy WITHOUT breaking enums:
-- (This is the one that blocked your ALTER previously.)
CREATE POLICY "Users can create reviews for completed jobs"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.jobs
      WHERE jobs.id = reviews.job_id
        AND jobs.status = 'completed'::job_status
        AND (
          (jobs.customer_id = auth.uid() AND reviews.reviewer_role = 'customer')
          OR (jobs.accepted_mechanic_id = auth.uid() AND reviews.reviewer_role = 'mechanic')
        )
    )
  );

COMMIT;
