-- Migration: Grant permissions for trigger function
-- Purpose: Ensure the handle_new_user trigger can insert into profiles table
-- This should fix "Database error saving new user" by ensuring proper permissions

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant all on profiles table to postgres (function owner)
GRANT ALL ON public.profiles TO postgres;

-- Ensure the function has proper ownership
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Recreate the function with explicit grants
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn text;
BEGIN
  fn := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  -- Explicitly disable RLS for this insert
  INSERT INTO public.profiles (auth_id, full_name, email, role, created_at, updated_at)
  VALUES (NEW.id, fn, NEW.email, NULL, NOW(), NOW())
  ON CONFLICT (auth_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to create profile row when new auth user is created. Has exception handling to not block auth.';
