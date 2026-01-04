-- Migration: Ensure all auth users have profiles
-- Purpose: Create missing profiles for any auth.users that don't have a corresponding profiles row
-- This handles cases where the handle_new_user trigger may have failed

-- Insert profiles for any auth users that don't have one
INSERT INTO public.profiles (auth_id, full_name, role, created_at, updated_at)
SELECT 
  au.id as auth_id,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    SPLIT_PART(au.email, '@', 1)
  ) as full_name,
  NULL as role,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.auth_id = au.id
WHERE p.id IS NULL
  AND au.deleted_at IS NULL;

-- Log how many were created
DO $$
DECLARE
  created_count integer;
BEGIN
  GET DIAGNOSTICS created_count = ROW_COUNT;
  IF created_count > 0 THEN
    RAISE NOTICE 'Created % missing profiles for auth users', created_count;
  ELSE
    RAISE NOTICE 'All auth users already have profiles';
  END IF;
END $$;
