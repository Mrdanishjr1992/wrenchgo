-- =====================================================
-- HOTFIX: Fix avatars storage bucket RLS policies
-- =====================================================
-- Run this in Supabase SQL Editor to fix the error:
-- "new row violates row-level security policy" when uploading avatars
-- =====================================================

-- Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies
DROP POLICY IF EXISTS "Avatar upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete" ON storage.objects;
DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;

-- Policy: Authenticated users can upload their own avatar
CREATE POLICY "Avatar upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.filename(name) LIKE auth.uid()::text || '.%')
  );

-- Policy: Users can update their own avatar
CREATE POLICY "Avatar update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.filename(name) LIKE auth.uid()::text || '.%')
  );

-- Policy: Users can delete their own avatar
CREATE POLICY "Avatar delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.filename(name) LIKE auth.uid()::text || '.%')
  );

-- Policy: Anyone can read avatars (public bucket)
CREATE POLICY "Avatar public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Verify
SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
