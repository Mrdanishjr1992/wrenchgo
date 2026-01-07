-- =====================================================
-- CRITICAL HOTFIX: Apply Missing Changes
-- Run this in Supabase SQL Editor to fix:
-- 1. "permission denied for table media_assets"
-- 2. "Could not find the function public.set_user_role"
-- 3. "permission denied for table profiles" in SECURITY DEFINER function
-- =====================================================

BEGIN;

-- =====================================================
-- FIX 0: Ensure postgres owns critical tables (for RLS bypass)
-- =====================================================
-- This ensures SECURITY DEFINER functions owned by postgres can bypass RLS
ALTER TABLE public.profiles OWNER TO postgres;
ALTER TABLE public.mechanic_profiles OWNER TO postgres;

-- =====================================================
-- FIX 1: Add set_user_role function with proper security
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_user_role(new_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_role public.user_role;
  uid uuid;
BEGIN
  uid := auth.uid();

  IF uid IS NULL THEN
    RAISE EXCEPTION 'No auth.uid() in context';
  END IF;

  -- Read current role
  SELECT role INTO current_role
  FROM public.profiles
  WHERE id = uid;

  -- If role is already set, raise error
  IF current_role IS NOT NULL THEN
    RAISE EXCEPTION 'Role already set to %', current_role;
  END IF;

  -- Set the role
  UPDATE public.profiles
  SET role = new_role, updated_at = now()
  WHERE id = uid;

  -- Auto-create mechanic_profile if role = mechanic
  IF new_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (uid, now(), now())
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.set_user_role IS 'Allows user to set their role once. SECURITY DEFINER function that bypasses RLS on profiles and creates mechanic_profile when needed.';

-- Ensure function is owned by postgres (same as table owner for RLS bypass)
ALTER FUNCTION public.set_user_role(public.user_role) OWNER TO postgres;

-- Restrict who can execute this function
REVOKE ALL ON FUNCTION public.set_user_role(public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(public.user_role) TO authenticated;

-- =====================================================
-- FIX 2: Grant SELECT on media_assets to anon role
-- =====================================================
GRANT SELECT ON public.media_assets TO anon;

-- =====================================================
-- FIX 3: Add RLS policy for anon access to public media assets
-- (CRITICAL: Grants alone don't work with RLS - policies are required)
-- =====================================================

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "media_assets_select_public_or_involved" ON public.media_assets;

-- Create comprehensive policy that allows:
-- 1. Anon users to see public assets (uploaded_by IS NULL AND job_id IS NULL)
-- 2. Authenticated users to see their own uploads
-- 3. Authenticated users to see job-related assets they're involved in
CREATE POLICY "media_assets_select_public_or_involved"
  ON public.media_assets FOR SELECT
  USING (
    -- Public assets (accessible to anon + authenticated)
    (uploaded_by IS NULL AND job_id IS NULL)
    OR
    -- Authenticated users can see their own uploads
    (auth.uid() = uploaded_by)
    OR
    -- Authenticated users can see job-related assets they're involved in
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = media_assets.job_id
      AND (jobs.customer_id = auth.uid() OR jobs.accepted_mechanic_id = auth.uid())
    )
  );

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- 1. Verify table ownership (should be postgres)
SELECT
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'mechanic_profiles', 'media_assets')
ORDER BY tablename;

-- Expected: All owned by postgres

-- 2. Verify set_user_role function exists with correct security
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'set_user_role';

-- Expected: set_user_role | FUNCTION | DEFINER

-- 3. Verify function ownership (should be postgres)
SELECT
  proname as function_name,
  pg_get_userbyid(proowner) as owner
FROM pg_proc
WHERE proname = 'set_user_role'
  AND pronamespace = 'public'::regnamespace;

-- Expected: set_user_role | postgres

-- 4. Verify function execute permissions
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'set_user_role'
ORDER BY grantee;

-- Expected: authenticated has EXECUTE, anon should NOT have EXECUTE

-- 5. Verify anon has SELECT grant on media_assets
SELECT
  table_name,
  privilege_type,
  grantee
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'media_assets'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee;

-- Expected: media_assets | SELECT | anon
--           media_assets | SELECT | authenticated (and other privileges)

-- 6. Verify RLS policy exists for media_assets
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'media_assets'
  AND policyname = 'media_assets_select_public_or_involved';

-- Expected: 1 row with policy details

-- 7. Test public media asset access (as anon)
SET ROLE anon;
SELECT key, public_url
FROM public.media_assets
WHERE key IN ('wrenchgo_ad_1', 'logo_video')
LIMIT 5;
RESET ROLE;

-- Expected: Should return rows without permission denied error
-- If no rows returned, it means the assets don't exist yet (need to be uploaded)

-- 8. Test that anon CANNOT see private assets
SET ROLE anon;
SELECT COUNT(*) as should_be_zero_or_only_public
FROM public.media_assets
WHERE uploaded_by IS NOT NULL OR job_id IS NOT NULL;
RESET ROLE;

-- Expected: 0 rows (anon can only see public assets)

-- 9. Test set_user_role function (as authenticated user - will fail in SQL editor but shows it exists)
-- This will fail with "No auth.uid() in context" which is expected in SQL editor
-- The function will work properly when called from the app with authenticated user
-- SELECT public.set_user_role('customer');
-- Expected error: "No auth.uid() in context" (this is correct - function requires authenticated session)

-- =====================================================
-- CRITICAL: Check for invalid role values
-- =====================================================
-- This query checks if any profiles have invalid role values
-- Valid values are: NULL, 'customer', 'mechanic'
SELECT
  id,
  email,
  role,
  created_at,
  COUNT(*) OVER () as total_invalid_roles
FROM public.profiles
WHERE role IS NOT NULL
  AND role NOT IN ('customer', 'mechanic')
ORDER BY created_at DESC;

-- Expected: 0 rows (no invalid roles)
-- If rows are returned, run the FIX script below

-- =====================================================
-- FIX: Reset invalid role values to NULL
-- =====================================================
-- UNCOMMENT AND RUN THIS IF THE ABOVE QUERY SHOWS INVALID ROLES:
/*
BEGIN;
UPDATE public.profiles
SET role = NULL, updated_at = now()
WHERE role IS NOT NULL
  AND role NOT IN ('customer', 'mechanic');

-- Verify the fix
SELECT COUNT(*) as invalid_roles_remaining
FROM public.profiles
WHERE role IS NOT NULL
  AND role NOT IN ('customer', 'mechanic');

COMMIT;
*/

-- =====================================================
-- ADDITIONAL VALIDATION: Check user_role enum type
-- =====================================================
-- Verify the user_role enum has correct values
SELECT
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder as sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'user_role'
ORDER BY e.enumsortorder;

-- Expected: user_role enum with values: 'customer', 'mechanic'
