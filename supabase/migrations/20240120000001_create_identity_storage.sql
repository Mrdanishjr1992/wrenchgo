-- Migration: Create Identity Documents Storage Bucket
-- Timestamp: 20240120000001
-- Description: Creates a private storage bucket for ID documents with RLS policies

-- Create private storage bucket for identity documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-docs',
  'identity-docs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Users can upload own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all ID documents" ON storage.objects;

-- Policy: Users can upload their own ID documents
CREATE POLICY "Users can upload own ID documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'identity-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own ID documents
CREATE POLICY "Users can read own ID documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'identity-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own ID documents
CREATE POLICY "Users can update own ID documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'identity-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own ID documents
CREATE POLICY "Users can delete own ID documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'identity-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Admins can read all ID documents for verification (removed - role column doesn't exist yet)
-- This policy will be added in a later migration after the role column is created
