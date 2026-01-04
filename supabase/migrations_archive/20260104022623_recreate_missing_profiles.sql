-- Migration: Recreate missing profiles for auth users
-- Purpose: Create profiles for any auth.users that don't have a corresponding profiles row
-- This fixes users who got stuck during the schema mismatch period

-- Insert profiles for any auth users that don't have one
INSERT INTO public.profiles (auth_id, full_name, email, role, created_at, updated_at)
SELECT 
  au.id as auth_id,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    SPLIT_PART(au.email, '@', 1),
    'User'
  ) as full_name,
  au.email,
  NULL as role,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.auth_id = au.id
WHERE p.id IS NULL
  AND au.deleted_at IS NULL
ON CONFLICT (auth_id) DO UPDATE
SET 
  email = EXCLUDED.email,
  updated_at = NOW();

-- Log how many were created/updated
DO $$
DECLARE
  affected_count integer;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count > 0 THEN
    RAISE NOTICE 'Created/updated % profiles for auth users', affected_count;
  ELSE
    RAISE NOTICE 'All auth users already have valid profiles';
  END IF;
END $$;
