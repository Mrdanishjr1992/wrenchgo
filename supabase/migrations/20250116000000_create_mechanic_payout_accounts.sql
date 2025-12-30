CREATE TABLE IF NOT EXISTS public.mechanic_payout_accounts (
  mechanic_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  onboarding_status TEXT NOT NULL DEFAULT 'incomplete' CHECK (onboarding_status IN ('incomplete', 'pending', 'complete', 'restricted')),
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  requirements_due JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mechanic_payout_accounts_stripe_account_id ON public.mechanic_payout_accounts(stripe_account_id);
CREATE INDEX idx_mechanic_payout_accounts_onboarding_status ON public.mechanic_payout_accounts(onboarding_status);

ALTER TABLE public.mechanic_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mechanics can view their own payout account"
  ON public.mechanic_payout_accounts
  FOR SELECT
  USING (auth.uid() = mechanic_id);

CREATE POLICY "Mechanics can insert their own payout account"
  ON public.mechanic_payout_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = mechanic_id);

CREATE POLICY "Mechanics can update their own payout account"
  ON public.mechanic_payout_accounts
  FOR UPDATE
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

CREATE OR REPLACE FUNCTION public.update_mechanic_payout_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mechanic_payout_accounts_updated_at
  BEFORE UPDATE ON public.mechanic_payout_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mechanic_payout_accounts_updated_at();
