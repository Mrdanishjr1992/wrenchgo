-- ============================================================================
-- Migration: Consolidate Vehicles RLS Policies
-- Phase: 1 (RLS Consolidation)
-- Downtime: NONE
-- Rollback: Run 20240115000001_rollback.sql
-- ============================================================================

-- PROBLEM: 13 duplicate policies on vehicles table doing the same thing
-- SOLUTION: Keep only the most permissive, well-named policies

-- ============================================================================
-- STEP 1: Drop all duplicate/legacy policies (idempotent)
-- ============================================================================

-- Drop old "Users can..." policies (replaced by "customers can...")
DROP POLICY IF EXISTS "Users can view own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can insert own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can update own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Users can delete own vehicles" ON public.vehicles;

-- Drop duplicate "customers can..." policies (keep standardized names)
DROP POLICY IF EXISTS "customers can read own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "customers can insert own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "customers can update own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "customers can delete own vehicles" ON public.vehicles;

-- Drop old standardized policies (will recreate with better names)
DROP POLICY IF EXISTS "vehicles_select_owner" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_update_owner" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_write_owner" ON public.vehicles;

-- Keep this one - it's unique for mechanics
-- DROP POLICY IF EXISTS "Mechanics can view vehicles for their jobs" ON public.vehicles;

-- ============================================================================
-- STEP 2: Create consolidated, well-named policies
-- ============================================================================

-- SELECT: Customers can view their own vehicles
CREATE POLICY "vehicles_select_customer_owner"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR is_admin()
);

-- INSERT: Customers can create their own vehicles
CREATE POLICY "vehicles_insert_customer_owner"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid()
  OR is_admin()
);

-- UPDATE: Customers can update their own vehicles
CREATE POLICY "vehicles_update_customer_owner"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (customer_id = auth.uid() OR is_admin())
WITH CHECK (customer_id = auth.uid() OR is_admin());

-- DELETE: Customers can delete their own vehicles
CREATE POLICY "vehicles_delete_customer_owner"
ON public.vehicles
FOR DELETE
TO authenticated
USING (
  customer_id = auth.uid()
  OR is_admin()
);

-- SELECT: Mechanics can view vehicles for jobs they're quoting/working on
-- (Keep existing policy, just ensure it exists)
DROP POLICY IF EXISTS "Mechanics can view vehicles for their jobs" ON public.vehicles;
CREATE POLICY "vehicles_select_mechanic_jobs"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    INNER JOIN public.quote_requests qr ON qr.job_id = j.id
    WHERE j.vehicle_id = vehicles.id
    AND qr.mechanic_id = auth.uid()
  )
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check policy count (should be 5 total)
-- SELECT COUNT(*) FROM pg_policies WHERE tablename = 'vehicles';

-- Test as customer
-- SELECT * FROM vehicles WHERE customer_id = auth.uid();

-- Test as mechanic
-- SELECT v.* FROM vehicles v
-- JOIN jobs j ON j.vehicle_id = v.id
-- JOIN quote_requests qr ON qr.job_id = j.id
-- WHERE qr.mechanic_id = auth.uid();

-- ============================================================================
-- ROLLBACK NOTES
-- ============================================================================
-- To rollback: Drop new policies and recreate old ones
-- See: 20240115000001_rollback.sql
