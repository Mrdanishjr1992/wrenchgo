-- Migration: Force reset role for specific user
-- Purpose: Reset role to NULL for user 89b65fe9-9b98-4368-a98c-d4eb2a455d0e
-- This user has a corrupted role value that's preventing role selection

-- Force update using CAST to bypass enum type issues
UPDATE public.profiles
SET 
  role = NULL,
  updated_at = NOW()
WHERE auth_id = '89b65fe9-9b98-4368-a98c-d4eb2a455d0e';

-- Also reset ALL profiles with any non-standard role values
-- by attempting to cast and catching failures
DO $$
DECLARE
  profile_record RECORD;
  affected_count integer := 0;
BEGIN
  FOR profile_record IN 
    SELECT id, auth_id, role::text as role_text 
    FROM public.profiles 
    WHERE role IS NOT NULL
  LOOP
    -- Check if role is valid
    IF profile_record.role_text NOT IN ('customer', 'mechanic') THEN
      UPDATE public.profiles
      SET role = NULL, updated_at = NOW()
      WHERE id = profile_record.id;
      affected_count := affected_count + 1;
    END IF;
  END LOOP;
  
  IF affected_count > 0 THEN
    RAISE NOTICE 'Reset % profiles with invalid role values', affected_count;
  ELSE
    RAISE NOTICE 'All profiles have valid role values';
  END IF;
END $$;
