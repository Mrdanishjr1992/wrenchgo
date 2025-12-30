-- Re-enable Login Prevention Trigger
-- Run this in Supabase SQL Editor after deploying the updated Edge Function

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS prevent_deleted_user_login ON auth.users;
DROP FUNCTION IF EXISTS check_user_not_deleted();

-- Create function to check if user is deleted
CREATE OR REPLACE FUNCTION check_user_not_deleted()
RETURNS TRIGGER AS $$
DECLARE
  profile_deleted_at TIMESTAMPTZ;
BEGIN
  -- Only check on login attempts (when last_sign_in_at changes)
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    -- Check if profile exists and is deleted
    SELECT deleted_at INTO profile_deleted_at
    FROM profiles
    WHERE id = NEW.id;
    
    -- If profile is soft-deleted, prevent login
    IF profile_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'This account has been deleted. Please contact support to reactivate.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE TRIGGER prevent_deleted_user_login
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION check_user_not_deleted();

-- Verify trigger is active
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'prevent_deleted_user_login';
