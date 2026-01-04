-- Migration: Recreate set_user_role function with better error handling
-- Purpose: Fix the "Role already set to postgres" error by ensuring proper role validation

CREATE OR REPLACE FUNCTION public.set_user_role(new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
  current_role text;
  profile_exists boolean;
BEGIN
  user_id := auth.uid();

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF new_role NOT IN ('customer', 'mechanic') THEN
    RAISE EXCEPTION 'Invalid role: must be customer or mechanic';
  END IF;

  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE auth_id = user_id) INTO profile_exists;
  
  IF NOT profile_exists THEN
    RAISE EXCEPTION 'Profile not found for user %', user_id;
  END IF;

  -- Get current role, casting to text to handle enum types
  SELECT COALESCE(role::text, '') INTO current_role
  FROM public.profiles
  WHERE auth_id = user_id;

  -- If role is already set to the same value, just return success (idempotent)
  IF current_role = new_role THEN
    RAISE NOTICE 'Role already set to %, returning success', new_role;
    RETURN;
  END IF;

  -- If role is set to a different valid value, that's an error
  IF current_role != '' AND current_role IN ('customer', 'mechanic') AND current_role != new_role THEN
    RAISE EXCEPTION 'Role already set to %. Cannot change role after initial selection.', current_role;
  END IF;

  -- Role is NULL or invalid, so set it (this handles the 'postgres' corruption case)
  UPDATE public.profiles
  SET
    role = new_role::text,
    updated_at = NOW()
  WHERE auth_id = user_id;

  RAISE NOTICE 'Successfully set role to % for user %', new_role, user_id;

  -- Create mechanic profile if needed
  IF new_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (user_id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.set_user_role(text) IS
'Sets the user role (customer or mechanic) for the authenticated user. Can only be set once unless corrupted.';
