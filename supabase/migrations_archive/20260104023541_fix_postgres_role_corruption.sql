-- Migration: Fix corrupted role data in profiles table
-- Purpose: Reset any invalid role values (like 'postgres') to NULL
-- This allows users to properly select their role

-- Update any profiles with invalid role values
UPDATE public.profiles
SET role = NULL, updated_at = NOW()
WHERE role IS NOT NULL 
  AND role NOT IN ('customer', 'mechanic');

-- Log the fix
DO $$
DECLARE
  affected_count integer;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count > 0 THEN
    RAISE NOTICE 'Fixed % profiles with corrupted role data', affected_count;
  ELSE
    RAISE NOTICE 'No corrupted role data found';
  END IF;
END $$;
