-- Unban Previously Deleted Users
-- Run this in Supabase SQL Editor to remove the ban from users who were deleted

-- Check for banned users
SELECT 
  id,
  email,
  banned_until,
  deleted_at
FROM auth.users
WHERE banned_until IS NOT NULL
ORDER BY banned_until DESC;

-- Unban all users (the trigger will handle login prevention)
UPDATE auth.users
SET banned_until = NULL
WHERE banned_until IS NOT NULL;

-- Verify no users are banned
SELECT COUNT(*) as banned_users_count
FROM auth.users
WHERE banned_until IS NOT NULL;
