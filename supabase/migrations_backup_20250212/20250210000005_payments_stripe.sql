-- =====================================================
-- PAYMENTS AND STRIPE (PRODUCTION-READY)
-- =====================================================
-- Purpose: payments, customer_payment_methods, mechanic_stripe_accounts
-- =====================================================

BEGIN;

-- =====================================================
-- TABLE: mechanic_stripe_accounts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_stripe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  stripe_account_id text UNIQUE NOT NULL,
  onboarding_complete boolean DEFAULT false,
  charges_enabled boolean DEFAULT false,
  payouts_enabled boolean DEFAULT false,
  
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(mechanic_id)
);

CREATE INDEX IF NOT EXISTS idx_mechanic_stripe_accounts_mechanic ON public.mechanic_stripe_accounts(mechanic_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mechanic_stripe_accounts_stripe_id ON public.mechanic_stripe_accounts(stripe_account_id) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE: customer_payment_methods
-- =====================================================
CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  stripe_payment_method_id text UNIQUE NOT NULL,
  is_default boolean DEFAULT false,
  
  card_brand text,
  card_last4 text,
  card_exp_month int,
  card_exp_year int,
  
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer ON public.customer_payment_methods(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_default ON public.customer_payment_methods(customer_id, is_default) WHERE deleted_at IS NULL AND is_default = true;

-- =====================================================
-- TABLE: payments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  stripe_payment_intent_id text UNIQUE,
  stripe_transfer_id text,
  
  amount_cents int NOT NULL,
  platform_fee_cents int DEFAULT 0,
  mechanic_payout_cents int,
  
  status public.payment_status DEFAULT 'pending' NOT NULL,
  
  paid_at timestamptz,
  refunded_at timestamptz,
  
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT payments_positive_amount CHECK (amount_cents > 0),
  CONSTRAINT payments_customer_not_mechanic CHECK (customer_id != mechanic_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_job ON public.payments(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_mechanic ON public.payments(mechanic_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON public.payments(stripe_payment_intent_id) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE: webhook_events (optional, for Stripe webhooks)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  event_type text NOT NULL,
  stripe_event_id text UNIQUE,
  payload jsonb NOT NULL,
  
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,
  
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed, created_at) WHERE NOT processed;

COMMIT;
