-- =====================================================
-- OPTIONAL: Prevent direct role changes (must use set_user_role function)
-- =====================================================
-- This trigger prevents users from changing their role directly via UPDATE
-- They must use the set_user_role() function instead

CREATE OR REPLACE FUNCTION public.prevent_direct_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Allow role change if it's coming from set_user_role function
  -- (function sets a session variable before updating)
  IF current_setting('app.allow_role_change', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- If role is being changed, reject it
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Role cannot be changed directly. Use set_user_role() function.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_direct_role_change_trigger ON public.profiles;
CREATE TRIGGER prevent_direct_role_change_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_role_change();

-- Update set_user_role to set the session variable
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

  -- Set session variable to allow role change
  PERFORM set_config('app.allow_role_change', 'true', true);

  -- Set the role
  UPDATE public.profiles
  SET role = new_role, updated_at = now()
  WHERE id = uid;

  -- Reset session variable
  PERFORM set_config('app.allow_role_change', 'false', true);

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

COMMENT ON FUNCTION public.set_user_role IS 'Allows user to set their role once. SECURITY DEFINER bypasses RLS. Auto-creates mechanic_profile if role is mechanic. Uses session variable to prevent direct role changes.';
