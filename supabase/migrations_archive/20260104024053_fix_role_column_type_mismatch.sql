-- Migration: Fix role column type mismatch
-- Purpose: Convert role column from user_role enum to text with CHECK constraint
-- This aligns the remote database with the local schema

-- Step 1: Check if user_role enum exists and what values it has
DO $$
BEGIN
  -- If the enum exists, add any missing values
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    -- Try to add 'customer' if it doesn't exist
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'customer value already exists in user_role enum';
    END;
    
    -- Try to add 'mechanic' if it doesn't exist
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'mechanic';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'mechanic value already exists in user_role enum';
    END;
    
    RAISE NOTICE 'user_role enum exists and has been updated';
  ELSE
    RAISE NOTICE 'user_role enum does not exist';
  END IF;
END $$;

-- Step 2: Update the set_user_role function to properly cast to the enum type
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

  -- Role is NULL or invalid, so set it
  -- Use EXECUTE to dynamically handle both enum and text types
  EXECUTE format(
    'UPDATE public.profiles SET role = %L, updated_at = NOW() WHERE auth_id = %L',
    new_role,
    user_id
  );

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
'Sets the user role (customer or mechanic) for the authenticated user. Handles both enum and text column types.';
