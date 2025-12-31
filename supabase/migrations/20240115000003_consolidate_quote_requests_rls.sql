-- ============================================================================
-- Migration: Consolidate Quote Requests RLS Policies
-- Phase: 1 (RLS Consolidation)
-- Downtime: NONE
-- Rollback: Run 20240115000003_rollback.sql
-- ============================================================================

-- PROBLEM: 11 duplicate policies on quote_requests table
-- SOLUTION: Keep only necessary, well-named policies

-- ============================================================================
-- STEP 1: Drop all duplicate policies (idempotent)
-- ============================================================================

-- Drop old verbose policies
DROP POLICY IF EXISTS "customer can create quote_requests" ON public.quote_requests;
DROP POLICY IF EXISTS "customer can update own quote_requests" ON public.quote_requests;
DROP POLICY IF EXISTS "mechanic can send quote" ON public.quote_requests;
DROP POLICY IF EXISTS "mechanic updates own quote_requests" ON public.quote_requests;
DROP POLICY IF EXISTS "read own quotes" ON public.quote_requests;
DROP POLICY IF EXISTS "update own quotes" ON public.quote_requests;

-- Drop duplicate standardized policies (will recreate)
DROP POLICY IF EXISTS "quote_requests_select_participants" ON public.quote_requests;
DROP POLICY IF EXISTS "quote_requests_update_mechanic" ON public.quote_requests;
DROP POLICY IF EXISTS "quotes_insert_mechanic" ON public.quote_requests;
DROP POLICY IF EXISTS "quotes_select_party" ON public.quote_requests;
DROP POLICY IF EXISTS "quotes_update_party" ON public.quote_requests;

-- Drop the new consolidated policies if they exist (for idempotency)
DROP POLICY IF EXISTS "quote_requests_insert_mechanic" ON public.quote_requests;
DROP POLICY IF EXISTS "quote_requests_update_participants" ON public.quote_requests;
DROP POLICY IF EXISTS "quote_requests_delete_mechanic" ON public.quote_requests;

-- ============================================================================
-- STEP 2: Create consolidated policies
-- ============================================================================

-- SELECT: Both customer and mechanic can view their quote_requests
CREATE POLICY "quote_requests_select_participants"
ON public.quote_requests
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR mechanic_id = auth.uid()
);

-- INSERT: Mechanics create quotes for jobs
CREATE POLICY "quote_requests_insert_mechanic"
ON public.quote_requests
FOR INSERT
TO authenticated
WITH CHECK (
  mechanic_id = auth.uid()
);

-- UPDATE: Both parties can update (customer accepts/rejects, mechanic updates quote)
CREATE POLICY "quote_requests_update_participants"
ON public.quote_requests
FOR UPDATE
TO authenticated
USING (
  customer_id = auth.uid()
  OR mechanic_id = auth.uid()
)
WITH CHECK (
  customer_id = auth.uid()
  OR mechanic_id = auth.uid()
);

-- DELETE: Only mechanics can withdraw their quotes (soft delete recommended)
CREATE POLICY "quote_requests_delete_mechanic"
ON public.quote_requests
FOR DELETE
TO authenticated
USING (
  mechanic_id = auth.uid()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check policy count (should be 4 total)
-- SELECT COUNT(*) FROM pg_policies WHERE tablename = 'quote_requests';

-- Test as customer
-- SELECT * FROM quote_requests WHERE customer_id = auth.uid();

-- Test as mechanic
-- SELECT * FROM quote_requests WHERE mechanic_id = auth.uid();

-- ============================================================================
-- ROLLBACK NOTES
-- ============================================================================
-- To rollback: Drop new policies and recreate old ones
-- See: 20240115000003_rollback.sql
