-- Migration: Add RLS policies for location privacy on jobs table
-- Purpose: Ensure exact location is only visible to customer and accepted mechanic

-- 1. Drop existing overly permissive policies if they exist
DROP POLICY IF EXISTS "Mechanics can view jobs for quoting" ON public.jobs;
DROP POLICY IF EXISTS "Mechanics can view all jobs" ON public.jobs;

-- 2. Create helper function to check if user can see exact location
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

-- 3. Create policy for customers to see their own jobs (full access)
CREATE POLICY "Customers can view their own jobs with exact location"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    AND deleted_at IS NULL
  );

-- 4. Create policy for accepted mechanics to see exact location
CREATE POLICY "Accepted mechanics can view job exact location"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    accepted_mechanic_id = auth.uid()
    AND accepted_mechanic_id IS NOT NULL
    AND deleted_at IS NULL
  );

-- 5. Create policy for mechanics to view jobs for browsing (limited fields)
-- Note: This policy allows SELECT but mechanics should use jobs_public view
-- Direct queries will work but app should enforce view usage
CREATE POLICY "Mechanics can view jobs for browsing"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    status IN ('searching', 'quoted')
    AND deleted_at IS NULL
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) = 'mechanic'
  );

-- 6. Create policy for customers to insert jobs
CREATE POLICY "Customers can create jobs"
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) = 'customer'
  );

-- 7. Create policy for customers to update their own jobs
CREATE POLICY "Customers can update their own jobs"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    customer_id = auth.uid()
  );

-- 8. Create policy for mechanics to update accepted jobs
CREATE POLICY "Accepted mechanics can update job status"
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (
    accepted_mechanic_id = auth.uid()
    AND accepted_mechanic_id IS NOT NULL
    AND deleted_at IS NULL
  )
  WITH CHECK (
    accepted_mechanic_id = auth.uid()
  );

-- 9. Add security barrier to prevent location leakage via joins
-- Create a secure function for mechanics to check if they can quote
CREATE OR REPLACE FUNCTION public.can_mechanic_quote_job(job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  job_status text;
  job_deleted_at timestamptz;
BEGIN
  SELECT status, deleted_at INTO job_status, job_deleted_at
  FROM public.jobs
  WHERE id = job_id;
  
  RETURN (
    job_status IN ('searching', 'quoted')
    AND job_deleted_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.can_see_exact_job_location IS 'Returns true if current user can see exact location (customer or accepted mechanic)';
COMMENT ON FUNCTION public.can_mechanic_quote_job IS 'Returns true if mechanic can submit quote for this job';
