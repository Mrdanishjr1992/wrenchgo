-- =====================================================
-- HOTFIX: Fix media_assets RLS policy
-- =====================================================
-- Run this in Supabase SQL Editor to fix the error:
-- "permission denied for table jobs" when loading media assets
-- =====================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "media_assets_select_public_or_involved" ON public.media_assets;

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

-- Policy 3: Job media - participants can read
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

-- Verify
SELECT policyname FROM pg_policies WHERE tablename = 'media_assets';
