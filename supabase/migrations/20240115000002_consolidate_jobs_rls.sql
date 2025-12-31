-- ============================================================================
-- Migration: Consolidate Jobs RLS Policies
-- Phase: 1 (RLS Consolidation)
-- Downtime: NONE
-- Rollback: Run 20240115000002_rollback.sql
-- ============================================================================

-- PROBLEM: 9 duplicate policies on jobs table
-- SOLUTION: Keep only necessary, well-named policies

-- ============================================================================
-- STEP 1: Drop all duplicate policies (idempotent)
-- ============================================================================

-- Drop old verbose policies
DROP POLICY IF EXISTS "customer can create job" ON public.jobs;
DROP POLICY IF EXISTS "customer can read own jobs" ON public.jobs;
DROP POLICY IF EXISTS "customer can update own job" ON public.jobs;
DROP POLICY IF EXISTS "mechanic can read assigned jobs" ON public.jobs;
DROP POLICY IF EXISTS "assigned mechanic can update job" ON public.jobs;
DROP POLICY IF EXISTS "mechanics can view searching jobs" ON public.jobs;

-- Drop duplicate standardized policies (will recreate)
DROP POLICY IF EXISTS "jobs_insert_customer" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_owner_or_assigned" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_customer_or_assigned_mechanic" ON public.jobs;

-- Drop the new consolidated policies if they exist (for idempotency)
DROP POLICY IF EXISTS "jobs_select_owner_or_assigned_or_searching" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_customer_owner" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_owner_or_assigned" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_customer_owner" ON public.jobs;

-- ============================================================================
-- STEP 2: Create consolidated policies
-- ============================================================================

-- SELECT: Customers see their jobs, mechanics see assigned jobs, all see "searching"
CREATE POLICY "jobs_select_owner_or_assigned_or_searching"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR accepted_mechanic_id = auth.uid()
  OR status = 'searching'::job_status
);

-- INSERT: Only customers can create jobs
CREATE POLICY "jobs_insert_customer_owner"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid()
);

-- UPDATE: Customers can update their jobs, mechanics can update assigned jobs
CREATE POLICY "jobs_update_owner_or_assigned"
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

-- DELETE: Only customers can delete their own jobs (if status allows)
CREATE POLICY "jobs_delete_customer_owner"
ON public.jobs
FOR DELETE
TO authenticated
USING (
  customer_id = auth.uid()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check policy count (should be 4 total)
-- SELECT COUNT(*) FROM pg_policies WHERE tablename = 'jobs';

-- Test as customer
-- SELECT * FROM jobs WHERE customer_id = auth.uid();

-- Test as mechanic viewing searching jobs
-- SELECT * FROM jobs WHERE status = 'searching';

-- ============================================================================
-- ROLLBACK NOTES
-- ============================================================================
-- To rollback: Drop new policies and recreate old ones
-- See: 20240115000002_rollback.sql
