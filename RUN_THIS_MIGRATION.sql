-- ============================================================================
-- COMPLETE PAYMENTS SYSTEM MIGRATION
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: Create utility function for updated_at timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Create ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'requires_payment',
    'processing',
    'paid',
    'failed',
    'refunded',
    'partially_refunded',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE promotion_type AS ENUM (
    'percent_discount',
    'fixed_discount',
    'waive_platform_fee',
    'credit',
    'referral_bonus'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE stripe_account_status AS ENUM (
    'not_started',
    'pending',
    'active',
    'restricted',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 3: Create mechanic_stripe_accounts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mechanic_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE NOT NULL,
  status stripe_account_status DEFAULT 'pending' NOT NULL,
  charges_enabled BOOLEAN DEFAULT false NOT NULL,
  payouts_enabled BOOLEAN DEFAULT false NOT NULL,
  details_submitted BOOLEAN DEFAULT false NOT NULL,
  onboarding_url TEXT,
  onboarding_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mechanic_stripe_accounts_mechanic_id 
  ON public.mechanic_stripe_accounts(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_stripe_accounts_stripe_account_id 
  ON public.mechanic_stripe_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_stripe_accounts_status 
  ON public.mechanic_stripe_accounts(status);

-- ============================================================================
-- STEP 4: Create promotions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type promotion_type NOT NULL,
  amount_cents INTEGER,
  percent_off DECIMAL(5,2),
  description TEXT,
  start_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  end_date TIMESTAMPTZ,
  max_redemptions INTEGER,
  max_redemptions_per_user INTEGER DEFAULT 1,
  current_redemptions INTEGER DEFAULT 0 NOT NULL,
  customer_only BOOLEAN DEFAULT false,
  mechanic_only BOOLEAN DEFAULT false,
  first_job_only BOOLEAN DEFAULT false,
  minimum_amount_cents INTEGER,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT valid_promotion_amount CHECK (
    (type IN ('percent_discount') AND percent_off IS NOT NULL AND percent_off > 0 AND percent_off <= 100) OR
    (type IN ('fixed_discount', 'credit', 'referral_bonus') AND amount_cents IS NOT NULL AND amount_cents > 0) OR
    (type = 'waive_platform_fee')
  )
);

CREATE INDEX IF NOT EXISTS idx_promotions_code ON public.promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(active);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON public.promotions(start_date, end_date);

-- ============================================================================
-- STEP 5: Create promotion_redemptions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  payment_id UUID,
  discount_amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  UNIQUE(promotion_id, user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_promotion_id 
  ON public.promotion_redemptions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_user_id 
  ON public.promotion_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_job_id 
  ON public.promotion_redemptions(job_id);

-- ============================================================================
-- STEP 6: Create payments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Amounts (all in cents)
  quote_amount_cents INTEGER NOT NULL,
  customer_platform_fee_cents INTEGER DEFAULT 1500 NOT NULL,
  customer_discount_cents INTEGER DEFAULT 0 NOT NULL,
  customer_total_cents INTEGER NOT NULL,
  
  mechanic_platform_commission_cents INTEGER NOT NULL,
  mechanic_discount_cents INTEGER DEFAULT 0 NOT NULL,
  mechanic_payout_cents INTEGER NOT NULL,
  
  platform_revenue_cents INTEGER NOT NULL,
  
  currency TEXT DEFAULT 'usd' NOT NULL,
  
  -- Stripe references
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,
  stripe_connected_account_id TEXT,
  
  -- Status and metadata
  status payment_status DEFAULT 'requires_payment' NOT NULL,
  payment_method_type TEXT,
  receipt_url TEXT,
  failure_reason TEXT,
  refund_amount_cents INTEGER DEFAULT 0,
  
  -- Promotion tracking
  promotion_codes TEXT[],
  
  -- Timestamps
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_amounts CHECK (
    quote_amount_cents > 0 AND
    customer_platform_fee_cents >= 0 AND
    customer_discount_cents >= 0 AND
    customer_total_cents >= 0 AND
    mechanic_platform_commission_cents >= 0 AND
    mechanic_discount_cents >= 0 AND
    mechanic_payout_cents >= 0 AND
    platform_revenue_cents >= 0
  ),
  CONSTRAINT valid_customer_total CHECK (
    customer_total_cents = quote_amount_cents + customer_platform_fee_cents - customer_discount_cents
  ),
  CONSTRAINT valid_mechanic_payout CHECK (
    mechanic_payout_cents = quote_amount_cents - mechanic_platform_commission_cents - mechanic_discount_cents
  ),
  CONSTRAINT valid_platform_revenue CHECK (
    platform_revenue_cents = customer_platform_fee_cents + mechanic_platform_commission_cents - customer_discount_cents - mechanic_discount_cents
  )
);

CREATE INDEX IF NOT EXISTS idx_payments_job_id ON public.payments(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_quote_id ON public.payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_mechanic_id ON public.payments(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id 
  ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- Add foreign key for promotion_redemptions.payment_id
ALTER TABLE public.promotion_redemptions 
  ADD CONSTRAINT fk_promotion_redemptions_payment_id 
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 7: Enable RLS
-- ============================================================================

ALTER TABLE public.mechanic_stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: Create RLS Policies
-- ============================================================================

-- mechanic_stripe_accounts policies
DROP POLICY IF EXISTS "Mechanics can view their own Stripe account" 
  ON public.mechanic_stripe_accounts;
DROP POLICY IF EXISTS "Mechanics can update their own Stripe account" 
  ON public.mechanic_stripe_accounts;

CREATE POLICY "Mechanics can view their own Stripe account"
  ON public.mechanic_stripe_accounts FOR SELECT
  USING (auth.uid() = mechanic_id);

CREATE POLICY "Mechanics can update their own Stripe account"
  ON public.mechanic_stripe_accounts FOR UPDATE
  USING (auth.uid() = mechanic_id);

-- promotions policies (public read for active promotions)
DROP POLICY IF EXISTS "Anyone can view active promotions" ON public.promotions;

CREATE POLICY "Anyone can view active promotions"
  ON public.promotions FOR SELECT
  USING (active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));

-- promotion_redemptions policies
DROP POLICY IF EXISTS "Users can view their own redemptions" 
  ON public.promotion_redemptions;

CREATE POLICY "Users can view their own redemptions"
  ON public.promotion_redemptions FOR SELECT
  USING (auth.uid() = user_id);

-- payments policies (customers see customer view, mechanics see mechanic view)
DROP POLICY IF EXISTS "Customers can view their payments" ON public.payments;
DROP POLICY IF EXISTS "Mechanics can view their payments" ON public.payments;

CREATE POLICY "Customers can view their payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Mechanics can view their payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = mechanic_id);

-- ============================================================================
-- STEP 9: Create business logic functions
-- ============================================================================

-- Function to calculate mechanic platform commission (12% capped at $50)
CREATE OR REPLACE FUNCTION calculate_mechanic_commission(quote_amount_cents INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN LEAST(ROUND(quote_amount_cents * 0.12), 5000);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update promotion redemption count
CREATE OR REPLACE FUNCTION increment_promotion_redemptions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.promotions
  SET current_redemptions = current_redemptions + 1
  WHERE id = NEW.promotion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 10: Create triggers
-- ============================================================================

-- Trigger to increment promotion redemptions
DROP TRIGGER IF EXISTS increment_promotion_redemptions_trigger 
  ON public.promotion_redemptions;
CREATE TRIGGER increment_promotion_redemptions_trigger
  AFTER INSERT ON public.promotion_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION increment_promotion_redemptions();

-- Updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON public.mechanic_stripe_accounts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.mechanic_stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.promotions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.payments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- STEP 11: Add table comments
-- ============================================================================

COMMENT ON TABLE public.mechanic_stripe_accounts IS 'Stripe Connect accounts for mechanics';
COMMENT ON TABLE public.promotions IS 'Promotional codes and campaigns';
COMMENT ON TABLE public.promotion_redemptions IS 'Tracks promotion usage';
COMMENT ON TABLE public.payments IS 'Payment transactions with full fee breakdown';

COMMENT ON COLUMN public.payments.customer_platform_fee_cents IS 'Fixed $15 platform fee charged to customer';
COMMENT ON COLUMN public.payments.mechanic_platform_commission_cents IS '12% of quote amount, capped at $50';
COMMENT ON COLUMN public.payments.platform_revenue_cents IS 'Total platform revenue from this transaction';

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
