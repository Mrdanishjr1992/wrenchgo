-- Check if soft delete columns exist in profiles table
-- Run this in Supabase SQL Editor

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('deleted_at', 'deleted_reason', 'deletion_requested_by', 'can_reapply', 'reapplication_notes')
ORDER BY column_name;

-- Check if any profiles are already soft-deleted
SELECT 
  id, 
  email, 
  user_type,
  deleted_at, 
  deleted_reason
FROM profiles
WHERE deleted_at IS NOT NULL
LIMIT 5;

-- Check current user's profile
SELECT 
  id,
  email,
  user_type,
  deleted_at,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;
