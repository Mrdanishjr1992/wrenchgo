-- Migration: Add Photo ID Verification to Profiles
-- Timestamp: 20240120000000
-- Description: Adds identity verification fields to profiles table for secure ID document verification

-- Add ID verification columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS id_photo_path TEXT,
ADD COLUMN IF NOT EXISTS id_status TEXT DEFAULT 'none' CHECK (id_status IN ('none', 'pending', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS id_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS id_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS id_rejected_reason TEXT,
ADD COLUMN IF NOT EXISTS id_verified_by UUID REFERENCES auth.users(id);

-- Create index for faster verification status lookups
CREATE INDEX IF NOT EXISTS idx_profiles_id_status ON profiles(id_status);
CREATE INDEX IF NOT EXISTS idx_profiles_id_verified_at ON profiles(id_verified_at);

-- Add comment for documentation
COMMENT ON COLUMN profiles.id_photo_path IS 'Storage path to identity document (not public URL)';
COMMENT ON COLUMN profiles.id_status IS 'Verification status: none, pending, verified, rejected';
COMMENT ON COLUMN profiles.id_uploaded_at IS 'When user uploaded their ID';
COMMENT ON COLUMN profiles.id_verified_at IS 'When admin verified the ID';
COMMENT ON COLUMN profiles.id_rejected_reason IS 'Reason for rejection (shown to user)';
COMMENT ON COLUMN profiles.id_verified_by IS 'Admin user who verified/rejected the ID';
