-- Test script to verify ID verification setup
-- Run this in Supabase Studio SQL Editor

-- 1. Check if profiles table has the correct columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('id_verified', 'id_verified_at')
ORDER BY column_name;

-- 2. Check if mark_id_verified function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'mark_id_verified';

-- 3. Test the mark_id_verified function (will fail if no user is logged in)
-- SELECT mark_id_verified();

-- 4. Check current user's verification status
SELECT id, auth_id, full_name, id_verified, id_verified_at
FROM public.profiles
WHERE auth_id = auth.uid();
