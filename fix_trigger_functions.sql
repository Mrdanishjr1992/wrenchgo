-- Fix the check_user_not_deleted function with proper schema reference
CREATE OR REPLACE FUNCTION public.check_user_not_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_deleted_at TIMESTAMPTZ;
BEGIN
  -- Only check if profile exists (with explicit schema reference)
  SELECT deleted_at INTO profile_deleted_at
  FROM public.profiles
  WHERE id = NEW.id
  LIMIT 1;

  -- If profile exists AND is deleted, block login
  IF profile_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account has been deleted and cannot be accessed. Contact support for reactivation.';
  END IF;

  RETURN NEW;
END;
$$;

-- Also fix check_email_not_blocked to be safe
CREATE OR REPLACE FUNCTION public.check_email_not_blocked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      SELECT 1 FROM public.email_blocklist
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
$$;
