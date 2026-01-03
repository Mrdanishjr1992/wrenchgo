-- Migration: Fix role selection flow - remove default role assignment
-- Purpose: Ensure users explicitly choose their role during onboarding
-- NOTE: This file may run before baseline schema on fresh databases, so everything is guarded.

-- ------------------------------------------------------------
-- 1) Only run table alterations if profiles exists
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    -- Drop default (safe even if no default? can still error in some cases, so guard it)
    BEGIN
      ALTER TABLE public.profiles
        ALTER COLUMN role DROP DEFAULT;
    EXCEPTION WHEN others THEN
      -- ignore (e.g. column doesn't exist yet)
      NULL;
    END;

    -- Allow NULL role
    BEGIN
      ALTER TABLE public.profiles
        ALTER COLUMN role DROP NOT NULL;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2) Replace/define handle_new_user() (safe anytime)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  fn text;
BEGIN
  fn := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  -- Only insert if profiles table exists (because this migration might run before baseline)
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    INSERT INTO public.profiles (id, auth_id, full_name, role, created_at, updated_at)
    VALUES (NEW.id, NEW.id, fn, NULL, NOW(), NOW())
    ON CONFLICT (auth_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 3) RPC to set role once (safe anytime; runtime depends on profiles existing)
-- ------------------------------------------------------------
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

  -- Ensure profiles table exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'profiles table not found';
  END IF;

  SELECT role::text INTO current_role
  FROM public.profiles
  WHERE auth_id = user_id;

  IF current_role IS NOT NULL THEN
    RAISE EXCEPTION 'Role already set. Cannot change role after initial selection.';
  END IF;

  -- If your baseline defines role as text with CHECK constraint, no cast needed
  -- If baseline isn't applied yet, this update won't be called successfully anyway.
  UPDATE public.profiles
  SET
    role = new_role,
    updated_at = NOW()
  WHERE auth_id = user_id;

  -- Only attempt mechanic_profiles insert if the table exists
  IF new_role = 'mechanic' THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'mechanic_profiles'
    ) THEN
      INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
      VALUES (user_id, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 4) RLS policy (only if profiles exists AND RLS is enabled)
-- ------------------------------------------------------------
DO $$
DECLARE
  rls_enabled boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles';

    IF rls_enabled THEN
      -- Drop existing policy if it exists (idempotent)
      IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'profiles'
          AND policyname = 'Users can update their own role if null'
      ) THEN
        EXECUTE 'DROP POLICY "Users can update their own role if null" ON public.profiles';
      END IF;

      EXECUTE $pol$
        CREATE POLICY "Users can update their own role if null"
          ON public.profiles
          FOR UPDATE
          TO authenticated
          USING (auth_id = auth.uid() AND role IS NULL)
          WITH CHECK (auth_id = auth.uid())
      $pol$;
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5) Grants + index + comment (only if needed)
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.set_user_role(text) TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    -- Index is safe with IF NOT EXISTS
    CREATE INDEX IF NOT EXISTS idx_profiles_auth_id_role
      ON public.profiles(auth_id, role)
      WHERE deleted_at IS NULL;
  END IF;
END $$;

COMMENT ON FUNCTION public.set_user_role(text) IS
  'Sets the user role during onboarding. Can only be called once per user. Role must be customer or mechanic.';
