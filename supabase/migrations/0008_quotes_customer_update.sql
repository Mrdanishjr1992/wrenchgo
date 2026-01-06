-- =====================================================
-- MIGRATION 0009: Allow customers to update quotes
-- =====================================================
-- Purpose: Add RLS policy for customers to accept/reject quotes
-- Depends on: 0002_rls_policies.sql
-- =====================================================

BEGIN;

-- Allow customers to update quotes for their jobs (accept/reject)
DROP POLICY IF EXISTS "quotes_update_customer" ON public.quotes;
CREATE POLICY "quotes_update_customer" ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    job_id IN (SELECT id FROM jobs WHERE customer_id = auth.uid())
  )
  WITH CHECK (
    job_id IN (SELECT id FROM jobs WHERE customer_id = auth.uid())
  );

COMMIT;