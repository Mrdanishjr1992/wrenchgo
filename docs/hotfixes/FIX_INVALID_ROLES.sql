-- =====================================================
-- FIX INVALID ROLE VALUES
-- =====================================================
-- This script fixes profiles that have invalid role values
-- (e.g., 'postgres' instead of 'customer' or 'mechanic')
--
-- Run this in Supabase SQL Editor if you see:
-- "Role already set to postgres" or similar errors
-- =====================================================

BEGIN;

-- 1. Check for invalid roles
SELECT 
  id,
  email,
  role,
  created_at,
  'INVALID - will be reset to NULL' as status
FROM public.profiles
WHERE role IS NOT NULL 
  AND role NOT IN ('customer', 'mechanic');

-- 2. Reset invalid roles to NULL
UPDATE public.profiles
SET role = NULL, updated_at = now()
WHERE role IS NOT NULL 
  AND role NOT IN ('customer', 'mechanic');

-- 3. Verify the fix
SELECT 
  id,
  email,
  role,
  updated_at,
  'Fixed - role is now NULL' as status
FROM public.profiles
WHERE id IN (
  SELECT id FROM public.profiles
  WHERE updated_at > now() - interval '10 seconds'
);

COMMIT;

-- =====================================================
-- WHAT THIS DOES:
-- =====================================================
-- 1. Finds profiles with invalid role values
-- 2. Resets them to NULL (allowing user to choose again)
-- 3. Shows which profiles were fixed
--
-- After running this:
-- 1. Restart your app: npx expo start -c
-- 2. Sign in again
-- 3. Choose your role (customer or mechanic)
-- =====================================================
