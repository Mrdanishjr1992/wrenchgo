-- ============================================================================
-- PHOTO ID VERIFICATION - COMPLETE MIGRATION
-- ============================================================================
-- Run this entire script in Supabase Dashboard > SQL Editor
-- This combines all three migration files for easy deployment
-- ============================================================================

-- ============================================================================
-- PART 1: Add ID Verification Fields to Profiles Table
-- Migration: 20240120000000_add_id_verification.sql
-- ============================================================================

-- Add ID verification columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS id_photo_path TEXT,
ADD COLUMN IF NOT EXISTS id_status TEXT DEFAULT 'none' CHECK (id_status IN ('none', 'pending', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS id_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS id_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS id_rejected_reason TEXT,
ADD COLUMN IF NOT EXISTS id_verified_by UUID REFERENCES auth.users(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_id_status ON profiles(id_status);
CREATE INDEX IF NOT EXISTS idx_profiles_id_verified_at ON profiles(id_verified_at);

-- Add comments for documentation
COMMENT ON COLUMN profiles.id_photo_path IS 'Storage path to uploaded ID photo (NOT public URL)';
COMMENT ON COLUMN profiles.id_status IS 'ID verification status: none, pending, verified, rejected';
COMMENT ON COLUMN profiles.id_uploaded_at IS 'Timestamp when user uploaded their ID';
COMMENT ON COLUMN profiles.id_verified_at IS 'Timestamp when admin verified the ID';
COMMENT ON COLUMN profiles.id_rejected_reason IS 'Reason for rejection (shown to user)';
COMMENT ON COLUMN profiles.id_verified_by IS 'Admin user ID who verified the ID';

-- ============================================================================
-- PART 2: Create Identity Documents Storage Bucket
-- Migration: 20240120000001_create_identity_storage.sql
-- ============================================================================
-- PART 2: Create Identity Documents Storage Bucket
-- Migration: 20240120000001_create_identity_storage.sql
-- ============================================================================

-- Create private storage bucket for identity documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-docs',
  'identity-docs',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Users can upload own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all ID documents" ON storage.objects;

-- RLS Policy: Users can upload their own ID documents
CREATE POLICY "Users can upload own ID documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'identity-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can read their own ID documents
CREATE POLICY "Users can read own ID documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'identity-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can update their own ID documents
CREATE POLICY "Users can update own ID documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'identity-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can delete their own ID documents
CREATE POLICY "Users can delete own ID documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'identity-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Admins can read all ID documents for verification
CREATE POLICY "Admins can read all ID documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'identity-docs' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- PART 3: Add RLS Policies to Enforce ID Verification
-- Migration: 20240120000002_add_verification_rls.sql
-- ============================================================================

-- Function to check if user is ID verified
CREATE OR REPLACE FUNCTION is_user_id_verified(user_id UUID)

-- ============================================================================
-- PART 3: Add RLS Policies to Enforce ID Verification
-- Migration: 20240120000002_add_verification_rls.sql
-- ============================================================================

-- Function to check if user is ID verified
CREATE OR REPLACE FUNCTION is_user_id_verified(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND id_status = 'verified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Verified users can create jobs" ON jobs;
DROP POLICY IF EXISTS "Verified mechanics can accept quotes" ON quotes;

-- Policy: Only verified customers can create jobs
CREATE POLICY "Verified users can create jobs"
ON jobs
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid() AND
  is_user_id_verified(auth.uid())
);

-- Policy: Only verified mechanics can accept quotes
CREATE POLICY "Verified mechanics can accept quotes"
ON quotes
FOR UPDATE
TO authenticated
USING (
  mechanic_id = auth.uid() AND
  is_user_id_verified(auth.uid())
)
WITH CHECK (
  mechanic_id = auth.uid() AND
  is_user_id_verified(auth.uid())
);

-- Add comment for documentation
COMMENT ON FUNCTION is_user_id_verified IS 'Checks if a user has verified ID status';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Verify storage bucket was created: Storage > Buckets > identity-docs
-- 2. Test upload flow as a customer
-- 3. Test upload flow as a mechanic
-- 4. Test admin verification workflow
-- ============================================================================
