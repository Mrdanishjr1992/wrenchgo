-- ============================================
-- REMOVE ensure_profile_self_heal FUNCTION
-- ============================================
-- Safe to run multiple times
-- Execute in Supabase SQL Editor

-- Drop the function (all overloads)
DROP FUNCTION IF EXISTS public.ensure_profile_self_heal();
DROP FUNCTION IF EXISTS public.ensure_profile_self_heal(uuid);
DROP FUNCTION IF EXISTS public.ensure_profile_self_heal(text);

-- Revoke any permissions (if function existed)
-- Note: This will fail silently if function doesn't exist
DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.ensure_profile_self_heal() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.ensure_profile_self_heal() FROM anon;
  REVOKE ALL ON FUNCTION public.ensure_profile_self_heal() FROM authenticated;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

-- Verify removal
SELECT 
  routine_name, 
  routine_type,
  routine_schema
FROM information_schema.routines 
WHERE routine_name LIKE '%ensure_profile_self_heal%'
  AND routine_schema = 'public';

-- Expected result: 0 rows (function is gone)
