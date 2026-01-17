-- Fix storage policies for mechanic-verification bucket
BEGIN;

-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mechanic-verification',
  'mechanic-verification',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Mechanics can upload own docs" ON storage.objects;
DROP POLICY IF EXISTS "Mechanics can view own docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all verification docs" ON storage.objects;
DROP POLICY IF EXISTS "mechanic_verification_insert" ON storage.objects;
DROP POLICY IF EXISTS "mechanic_verification_select" ON storage.objects;
DROP POLICY IF EXISTS "mechanic_verification_update" ON storage.objects;

-- Create upload policy - mechanics can upload to their own folder
CREATE POLICY "mechanic_verification_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mechanic-verification'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create update policy - mechanics can update their own files
CREATE POLICY "mechanic_verification_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'mechanic-verification'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create select policy - mechanics see own, admins see all
CREATE POLICY "mechanic_verification_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mechanic-verification'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin(auth.uid())
  )
);

COMMIT;
