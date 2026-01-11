-- Migration: Add payout_method_status to profiles for mechanics
-- Similar to payment_method_status for customers

-- ENUM: payout_method_status (reuse payment_method_status enum values)
DO $$ BEGIN
  CREATE TYPE public.payout_method_status AS ENUM (
    'none',
    'pending',
    'active',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ADD payout_method_status TO profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payout_method_status public.payout_method_status DEFAULT 'none' NOT NULL;

-- FUNCTION: Update payout_method_status when mechanic_stripe_accounts changes
CREATE OR REPLACE FUNCTION public.sync_payout_method_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.onboarding_complete = true AND NEW.payouts_enabled = true AND NEW.deleted_at IS NULL THEN
      UPDATE public.profiles
      SET payout_method_status = 'active'
      WHERE id = NEW.mechanic_id;
    ELSIF NEW.onboarding_complete = true AND NEW.payouts_enabled = false THEN
      UPDATE public.profiles
      SET payout_method_status = 'pending'
      WHERE id = NEW.mechanic_id;
    ELSIF NEW.deleted_at IS NOT NULL THEN
      UPDATE public.profiles
      SET payout_method_status = 'none'
      WHERE id = NEW.mechanic_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET payout_method_status = 'none'
    WHERE id = OLD.mechanic_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: sync payout status on mechanic_stripe_accounts changes
DROP TRIGGER IF EXISTS sync_payout_method_status_trigger ON public.mechanic_stripe_accounts;
CREATE TRIGGER sync_payout_method_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.mechanic_stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_payout_method_status();

-- Backfill existing mechanic_stripe_accounts
UPDATE public.profiles p
SET payout_method_status = 'active'
FROM public.mechanic_stripe_accounts msa
WHERE msa.mechanic_id = p.id
  AND msa.onboarding_complete = true
  AND msa.payouts_enabled = true
  AND msa.deleted_at IS NULL;

UPDATE public.profiles p
SET payout_method_status = 'pending'
FROM public.mechanic_stripe_accounts msa
WHERE msa.mechanic_id = p.id
  AND msa.onboarding_complete = true
  AND msa.payouts_enabled = false
  AND msa.deleted_at IS NULL
  AND p.payout_method_status = 'none';
