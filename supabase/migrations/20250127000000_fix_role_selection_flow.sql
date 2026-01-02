-- Migration: Fix role selection flow - remove default role assignment
-- Date: 2025-01-XX
-- Purpose: Ensure users explicitly choose their role during onboarding

-- 1) Drop the default value from profiles.role column
ALTER TABLE public.profiles 
  ALTER COLUMN role DROP DEFAULT;

-- 2) Allow role to be NULL initially (users must choose)
ALTER TABLE public.profiles 
  ALTER COLUMN role DROP NOT NULL;

-- 3) Replace the handle_new_user trigger to NOT default role to 'customer'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  fn text;
BEGIN
  fn := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.profiles (id, auth_id, full_name, role, created_at, updated_at)
  VALUES (NEW.id, NEW.id, fn, NULL, NOW(), NOW())
  ON CONFLICT (auth_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4) Create RPC function to set user role (called from choose-role screen)
CREATE OR REPLACE FUNCTION public.set_user_role(new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

  IF current_role IS NOT NULL THEN
    RAISE EXCEPTION 'Role already set. Cannot change role after initial selection.';
  END IF;

  UPDATE public.profiles
  SET 
    role = new_role::public.user_role,
    updated_at = NOW()
  WHERE auth_id = user_id;

  IF new_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (user_id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

-- 5) Add RLS policy for set_user_role (users can only set their own role once)
CREATE POLICY "Users can update their own role if null"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid() AND role IS NULL)
  WITH CHECK (auth_id = auth.uid());

-- 6) Grant execute permission on the RPC function
GRANT EXECUTE ON FUNCTION public.set_user_role(text) TO authenticated;

-- 7) Add index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_auth_id_role 
  ON public.profiles(auth_id, role) 
  WHERE deleted_at IS NULL;

-- 8) Add comment for documentation
COMMENT ON FUNCTION public.set_user_role(text) IS 
  'Sets the user role during onboarding. Can only be called once per user. Role must be customer or mechanic.';
