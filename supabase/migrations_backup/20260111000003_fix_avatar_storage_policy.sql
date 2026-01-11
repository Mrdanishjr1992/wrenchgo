-- ============================================================================
-- Migration: 20260111000003_fix_avatar_storage_policy.sql
-- ============================================================================
-- Purpose: Fix avatars storage bucket RLS policies
-- Issue: Policy checks for folder path but uploads use root-level files
-- Upload path: avatars/{userId}.{ext} (no subfolder)
-- ============================================================================

BEGIN;

-- Drop existing policies that have wrong path logic
DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "Avatar upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete" ON storage.objects;

-- Policy: Authenticated users can upload their own avatar
-- File path: {userId}.{ext} at bucket root
CREATE POLICY "avatars_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND name LIKE auth.uid()::text || '.%'
  );

-- Policy: Users can update their own avatar
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE auth.uid()::text || '.%'
  );

-- Policy: Users can delete their own avatar
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE auth.uid()::text || '.%'
  );

COMMIT;
