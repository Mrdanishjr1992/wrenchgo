-- Migration: Add 'admin' to user_role enum
-- Required for job_media policies that check for admin role

BEGIN;

-- Add 'admin' to the user_role enum if it doesn't exist
DO $$
BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
