-- Migration: Add missing columns to profiles table
-- Purpose: Add email and phone columns that exist in baseline schema but are missing in remote database
-- This fixes the schema mismatch causing profile creation failures

-- Add email column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email text;
    RAISE NOTICE 'Added email column to profiles table';
  ELSE
    RAISE NOTICE 'email column already exists in profiles table';
  END IF;
END $$;

-- Add phone column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone text;
    RAISE NOTICE 'Added phone column to profiles table';
  ELSE
    RAISE NOTICE 'phone column already exists in profiles table';
  END IF;
END $$;

-- Backfill email from auth.users for existing profiles
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.auth_id = au.id
  AND p.email IS NULL
  AND au.email IS NOT NULL;

COMMENT ON COLUMN public.profiles.email IS 'User email address, synced from auth.users';
COMMENT ON COLUMN public.profiles.phone IS 'User phone number (optional)';
