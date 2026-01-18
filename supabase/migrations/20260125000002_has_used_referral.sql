-- MIGRATION: Referral Code UX Enforcement
-- 
-- Provides a dedicated RPC to check if user has ever used a referral code.
-- Source of truth: existence of row in invitations where invited_id = current_user

BEGIN;

-- Create has_used_referral function for clean frontend querying
CREATE OR REPLACE FUNCTION public.has_used_referral()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM invitations WHERE invited_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_used_referral() TO authenticated;

COMMENT ON FUNCTION public.has_used_referral() IS 
  'Returns true if the current user has ever applied a referral code. Used to hide referral input UI.';

-- Ensure defensive constraint exists on invitations.invited_id
-- This prevents a user from being invited more than once at DB level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invitations_invited_unique' 
    AND conrelid = 'public.invitations'::regclass
  ) THEN
    ALTER TABLE public.invitations 
      ADD CONSTRAINT invitations_invited_unique UNIQUE (invited_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMIT;
