-- Migration: Fix corrupted role data
-- Purpose: Reset any profiles with invalid role values (like 'postgres') to NULL
-- This allows users to properly set their role during onboarding

-- Reset any profiles with invalid roles to NULL
UPDATE public.profiles
SET role = NULL, updated_at = NOW()
WHERE role IS NOT NULL 
  AND role NOT IN ('customer', 'mechanic');

-- Log how many were fixed
DO $$
DECLARE
  fixed_count integer;
BEGIN
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  IF fixed_count > 0 THEN
    RAISE NOTICE 'Fixed % profiles with invalid role values', fixed_count;
  END IF;
END $$;

COMMENT ON TABLE public.profiles IS 'User profiles. Role must be NULL, customer, or mechanic.';
