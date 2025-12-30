-- Database trigger to prevent deleted users from logging in
-- This runs BEFORE authentication completes

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS prevent_deleted_user_login ON auth.users;
DROP TRIGGER IF EXISTS prevent_blocked_email_registration ON auth.users;
DROP FUNCTION IF EXISTS check_user_not_deleted();
DROP FUNCTION IF EXISTS check_email_not_blocked();

-- Function to check if user is deleted
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

-- Trigger on auth.users table (requires superuser or service role)
-- Note: This may need to be run via Supabase Dashboard SQL Editor with elevated privileges
CREATE TRIGGER prevent_deleted_user_login
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION check_user_not_deleted();

-- Alternative: Function to check email blocklist during registration
CREATE OR REPLACE FUNCTION check_email_not_blocked()
RETURNS TRIGGER AS $$
DECLARE
  is_blocked BOOLEAN;
BEGIN
  -- Check if email_blocklist table exists
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'email_blocklist'
  ) THEN
    -- Check if email is in blocklist
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

-- Trigger on auth.users for new registrations
CREATE TRIGGER prevent_blocked_email_registration
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION check_email_not_blocked();
