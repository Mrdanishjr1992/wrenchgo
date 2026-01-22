-- ===================================================================
-- WrenchGo: baseline split (functions)
-- Generated: 2026-01-22
-- Source: reset-baseline
-- Run these files in order (0001 -> 0011).
-- ===================================================================

SET search_path TO public, extensions;


-- Functions kept intentionally minimal for reset safety.

-- =====================================================
-- FUNCTION: set_updated_at
-- Why it exists:
-- - Consistent updated_at timestamps without repeating app logic.
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- FUNCTION: handle_new_user
-- Why it exists:
-- - Supabase pattern: create a profile row when a new auth user is created.
-- - Keeps auth.users lean while giving the app a stable profile row.
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
