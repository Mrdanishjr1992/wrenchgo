-- =====================================================
-- CREATE MECHANIC_STRIPE_ACCOUNTS TABLE
-- =====================================================
-- Purpose: Store Stripe Connect account information for mechanics
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mechanic_stripe_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL,
  stripe_account_id text NOT NULL UNIQUE,
  status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'restricted'::text, 'disabled'::text])),
  charges_enabled boolean DEFAULT false,
  payouts_enabled boolean DEFAULT false,
  details_submitted boolean DEFAULT false,
  onboarding_url text,
  onboarding_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT mechanic_stripe_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT mechanic_stripe_accounts_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_mechanic_stripe_accounts_mechanic_id ON public.mechanic_stripe_accounts(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_stripe_accounts_stripe_account_id ON public.mechanic_stripe_accounts(stripe_account_id);

-- Add RLS policies
ALTER TABLE public.mechanic_stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Mechanics can view their own Stripe account info
CREATE POLICY "Mechanics can view own stripe account"
  ON public.mechanic_stripe_accounts
  FOR SELECT
  USING (
    mechanic_id IN (
      SELECT id FROM public.profiles WHERE auth_id = auth.uid()
    )
  );

-- Service role can manage all Stripe accounts
CREATE POLICY "Service role can manage stripe accounts"
  ON public.mechanic_stripe_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER set_mechanic_stripe_accounts_updated_at
  BEFORE UPDATE ON public.mechanic_stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
