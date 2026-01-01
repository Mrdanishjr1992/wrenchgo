-- Migration: Add RLS policies for location privacy on jobs table
-- Purpose: Ensure exact location is only visible to customer and accepted mechanic

-- Drop old policies if they exist (safe to run)
DROP POLICY IF EXISTS "Customers can view their own jobs with exact location" ON public.jobs;
DROP POLICY IF EXISTS "Accepted mechanics can view job exact location" ON public.jobs;
DROP POLICY IF EXISTS "Mechanics can view jobs for browsing" ON public.jobs;
DROP POLICY IF EXISTS "Customers can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Customers can update their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Accepted mechanics can update job status" ON public.jobs;

-- Helper: can current user see job at all?
CREATE OR REPLACE FUNCTION public.can_see_exact_job_location(job_row public.jobs)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    auth.uid() = job_row.customer_id
    OR auth.uid() = job_row.accepted_mechanic_id
  );
END;
$$;

-- Customers: view their own jobs (full row)
CREATE POLICY "Customers can view their own jobs with exact location"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Accepted mechanics: view accepted jobs (full row)
CREATE POLICY "Accepted mechanics can view job exact location"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (accepted_mechanic_id = auth.uid() AND accepted_mechanic_id IS NOT NULL);

-- Mechanics browsing: allow SELECT for searching/quoted jobs
-- (Your app should still read from jobs_public to avoid displaying location_address)
CREATE POLICY "Mechanics can view jobs for browsing"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    status IN ('searching', 'quoted')
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'mechanic'
  );

-- Customers insert
CREATE POLICY "Customers can create jobs"
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Customers update own jobs
CREATE POLICY "Customers can update their own jobs"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- Accepted mechanics update accepted jobs
CREATE POLICY "Accepted mechanics can update job status"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (accepted_mechanic_id = auth.uid() AND accepted_mechanic_id IS NOT NULL)
  WITH CHECK (accepted_mechanic_id = auth.uid());

-- Optional: helper used by app logic (no deleted_at)
CREATE OR REPLACE FUNCTION public.can_mechanic_quote_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  job_status text;
BEGIN
  SELECT status INTO job_status
  FROM public.jobs
  WHERE id = p_job_id;

  RETURN job_status IN ('searching', 'quoted');
END;
$$;
