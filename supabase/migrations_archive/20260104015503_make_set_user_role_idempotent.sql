-- Migration: Make set_user_role idempotent
-- Purpose: If role is already set to the same value, just return success instead of error
-- This fixes the "Role already set" error when users try to set their role again

CREATE OR REPLACE FUNCTION public.set_user_role(new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
  current_role text;
BEGIN
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF new_role NOT IN ('customer', 'mechanic') THEN
    RAISE EXCEPTION 'Invalid role: must be customer or mechanic';
  END IF;

  SELECT role INTO current_role
  FROM public.profiles
  WHERE auth_id = user_id;

  -- If role is already set to the same value, just return success (idempotent)
  IF current_role = new_role THEN
    RETURN;
  END IF;

  -- If role is set to a different value, that's an error
  IF current_role IS NOT NULL AND current_role != new_role THEN
    RAISE EXCEPTION 'Role already set to %. Cannot change role after initial selection.', current_role;
  END IF;

  -- Role is NULL, so set it
  UPDATE public.profiles
  SET 
    role = new_role,
    updated_at = NOW()
  WHERE auth_id = user_id;

  IF new_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (user_id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.set_user_role(text) IS 
  'Sets the user role during onboarding. Idempotent - can be called multiple times with same role. Role must be customer or mechanic.';
