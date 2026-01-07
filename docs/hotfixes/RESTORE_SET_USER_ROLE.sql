-- =====================================================
-- RESTORE: set_user_role One-Time Protection
-- =====================================================
-- This restores the original set_user_role function that
-- prevents users from changing their role after it's set.
--
-- Run this AFTER you've successfully reset your role
-- =====================================================

BEGIN;

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

  -- If role is already set, raise error (ONE-TIME ONLY)
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

ALTER FUNCTION public.set_user_role(public.user_role) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_user_role(public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(public.user_role) TO authenticated;

COMMIT;

-- =====================================================
-- DONE: Role protection restored
-- =====================================================
