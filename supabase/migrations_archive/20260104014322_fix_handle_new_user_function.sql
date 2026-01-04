

-- Migration: Fix handle_new_user function to not explicitly set id
-- Purpose: Let the profiles table use its default gen_random_uuid() for id column
-- This fixes "Database error saving new user" during Google sign-in

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

  INSERT INTO public.profiles (auth_id, full_name, email, role, created_at, updated_at)
  VALUES (NEW.id, fn, NEW.email, NULL, NOW(), NOW())
  ON CONFLICT (auth_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to create profile row when new auth user is created. Uses default id generation.';
