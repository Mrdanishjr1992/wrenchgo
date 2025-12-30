-- EMERGENCY FIX: Drop the problematic trigger temporarily
-- Run this in Supabase SQL Editor NOW to restore login functionality

-- Drop the trigger that's blocking all logins
DROP TRIGGER IF EXISTS prevent_deleted_user_login ON auth.users;
DROP TRIGGER IF EXISTS prevent_blocked_email_registration ON auth.users;

-- Drop the functions
DROP FUNCTION IF EXISTS check_user_not_deleted();
DROP FUNCTION IF EXISTS check_email_not_blocked();

-- Recreate the function with proper NULL handling
CREATE OR REPLACE FUNCTION check_user_not_deleted()
RETURNS TRIGGER AS $$
DECLARE
  profile_deleted_at TIMESTAMPTZ;
BEGIN
  -- Only check if profile exists
  SELECT deleted_at INTO profile_deleted_at
  FROM profiles 
  WHERE id = NEW.id 
  LIMIT 1;
  
  -- If profile exists AND is deleted, block login
  IF profile_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account has been deleted and cannot be accessed. Contact support for reactivation.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER prevent_deleted_user_login
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION check_user_not_deleted();

-- Recreate email blocklist check (only if table exists)
CREATE OR REPLACE FUNCTION check_email_not_blocked()
RETURNS TRIGGER AS $$
DECLARE
  is_blocked BOOLEAN := false;
  table_exists BOOLEAN;
BEGIN
  -- Check if email_blocklist table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'email_blocklist'
  ) INTO table_exists;
  
  -- Only check blocklist if table exists
  IF table_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM email_blocklist 
      WHERE email = NEW.email 
      AND unblocked_at IS NULL
      AND can_reapply = false
    ) INTO is_blocked;
    
    IF is_blocked THEN
      RAISE EXCEPTION 'This email address is not eligible for registration. Please contact support.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate registration trigger
CREATE TRIGGER prevent_blocked_email_registration
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION check_email_not_blocked();
