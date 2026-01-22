-- =====================================================
-- EMERGENCY FIX: Allow Role Reset for Invalid Values
-- =====================================================
-- This temporarily modifies set_user_role to allow resetting
-- invalid role values, then restores the original behavior.
--
-- Run this in Supabase SQL Editor as the postgres user
-- =====================================================

BEGIN;

-- Step 1: Temporarily modify set_user_role to allow role reset
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

  -- TEMPORARILY ALLOW RESET (we'll restore the check after)
  -- IF current_role IS NOT NULL THEN
  --   RAISE EXCEPTION 'Role already set to %', current_role;
  -- END IF;

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

ALTER FUNCTION public.set_user_role(public.user_role) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_user_role(public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(public.user_role) TO authenticated;

COMMIT;

-- =====================================================
-- INSTRUCTIONS:
-- =====================================================
-- 1. Run this script in Supabase SQL Editor
-- 2. In your app, sign in and choose your role again
-- 3. After successfully setting your role, run RESTORE_SET_USER_ROLE.sql
--    to restore the one-time-only protection
-- =====================================================
