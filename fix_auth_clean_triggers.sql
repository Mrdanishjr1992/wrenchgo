-- Remove duplicate/conflicting updated_at triggers
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;

-- Keep only the moddatetime trigger (it's the standard one)
-- If moddatetime doesn't exist, we'll create our own

-- Check if moddatetime extension exists, if not create our own function
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'moddatetime') THEN
    -- moddatetime doesn't exist, so drop that trigger too
    DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
  END IF;
END $$;

-- Create a single, reliable updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Drop all existing updated_at triggers and create one clean one
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Now fix the auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_full_name text;
BEGIN
  v_full_name := nullif(trim(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), '');
  
  IF lower(coalesce(NEW.raw_user_meta_data->>'role','')) = 'mechanic' THEN
    v_role := 'mechanic';
  ELSE
    v_role := 'customer';
  END IF;

  INSERT INTO public.profiles (id, role, full_name, created_at, updated_at)
  VALUES (NEW.id, v_role::public.user_role, v_full_name, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET role = COALESCE(profiles.role, EXCLUDED.role),
        full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
        updated_at = now();

  IF v_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (user_id) 
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Recreate the RPC function
DROP FUNCTION IF EXISTS public.ensure_profile_consistency(text, text, text, text);

CREATE OR REPLACE FUNCTION public.ensure_profile_consistency(
  role_hint text DEFAULT NULL, 
  full_name text DEFAULT NULL, 
  phone text DEFAULT NULL, 
  photo_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  v_role text;
  v_result json;
BEGIN
  uid := auth.uid();
  
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF lower(coalesce(role_hint,'')) = 'mechanic' THEN
    v_role := 'mechanic';
  ELSIF lower(coalesce(role_hint,'')) = 'customer' THEN
    v_role := 'customer';
  ELSE
    v_role := 'customer';
  END IF;

  INSERT INTO public.profiles (id, role, full_name, phone, photo_url, created_at, updated_at)
  VALUES (
    uid, 
    v_role::public.user_role, 
    nullif(trim(coalesce(full_name, '')), ''), 
    nullif(trim(coalesce(phone, '')), ''), 
    nullif(trim(coalesce(photo_url, '')), ''), 
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET 
      role = COALESCE(profiles.role, EXCLUDED.role),
      full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
      phone = COALESCE(profiles.phone, EXCLUDED.phone),
      photo_url = COALESCE(profiles.photo_url, EXCLUDED.photo_url),
      updated_at = now();

  IF v_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (user_id) 
    VALUES (uid)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT json_build_object(
    'id', p.id,
    'role', p.role,
    'full_name', p.full_name,
    'phone', p.phone,
    'photo_url', p.photo_url,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) INTO v_result
  FROM public.profiles p
  WHERE p.id = uid;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile_consistency(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;

-- Fix existing data
INSERT INTO public.profiles (id, role, full_name, created_at, updated_at)
SELECT 
  u.id,
  'customer'::public.user_role,
  nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), ''),
  coalesce(u.created_at, now()),
  now()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET role = 'customer'::public.user_role, updated_at = now()
WHERE role IS NULL;

INSERT INTO public.mechanic_profiles (user_id)
SELECT p.id
FROM public.profiles p
WHERE p.role = 'mechanic'
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'customer'::public.user_role;
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;
