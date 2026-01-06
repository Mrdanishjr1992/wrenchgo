-- WrenchGo Stripe Connect Marketplace Schema
-- Migration: 001_stripe_marketplace_schema.sql

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE job_status AS ENUM (
  'draft',
  'quoted',
  'accepted',
  'in_progress',
  'mechanic_verified',
  'customer_verified',
  'completed',
  'paid',
  'cancelled',
  'disputed'
);

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'locked',
  'paid',
  'refunded',
  'disputed'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'requires_action',
  'succeeded',
  'failed',
  'cancelled',
  'refunded'
);

CREATE TYPE ledger_status AS ENUM (
  'pending',
  'available_for_transfer',
  'transferred',
  'paid_out',
  'refunded'
);

CREATE TYPE transfer_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'reversed'
);

CREATE TYPE notification_type AS ENUM (
  'payment_succeeded',
  'payment_failed',
  'transfer_created',
  'payout_completed',
  'job_completed',
  'dispute_created',
  'refund_issued'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Mechanic Stripe Connect Accounts
CREATE TABLE mechanic_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  details_submitted BOOLEAN DEFAULT FALSE,
  country TEXT,
  currency TEXT DEFAULT 'usd',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mechanic_id)
);

CREATE INDEX idx_mechanic_stripe_accounts_mechanic_id ON mechanic_stripe_accounts(mechanic_id);
CREATE INDEX idx_mechanic_stripe_accounts_stripe_account_id ON mechanic_stripe_accounts(stripe_account_id);

-- Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mechanic_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status job_status DEFAULT 'draft',
  title TEXT NOT NULL,
  description TEXT,
  mechanic_verified_at TIMESTAMPTZ,
  customer_verified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX idx_jobs_mechanic_id ON jobs(mechanic_id);
CREATE INDEX idx_jobs_status ON jobs(status);

-- Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  labor_cost_cents INTEGER NOT NULL CHECK (labor_cost_cents >= 0),
  parts_cost_cents INTEGER NOT NULL CHECK (parts_cost_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  description TEXT,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_job_id ON quotes(job_id);
CREATE INDEX idx_quotes_mechanic_id ON quotes(mechanic_id);

-- Job Adjustments (mid-job changes)
CREATE TABLE job_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL, -- 'additional_labor', 'additional_parts', 'discount'
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  customer_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_adjustments_job_id ON job_adjustments(job_id);

-- Job Invoices (locked receipt snapshot)
CREATE TABLE job_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE RESTRICT,
  status invoice_status DEFAULT 'draft',
  original_labor_cents INTEGER NOT NULL,
  original_parts_cents INTEGER NOT NULL,
  adjustments_cents INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  mechanic_net_cents INTEGER NOT NULL,
  line_items JSONB NOT NULL, -- immutable snapshot
  locked_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id)
);

CREATE INDEX idx_job_invoices_job_id ON job_invoices(job_id);
CREATE INDEX idx_job_invoices_status ON job_invoices(status);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES job_invoices(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status payment_status DEFAULT 'pending',
  client_secret TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_job_id ON payments(job_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_mechanic_id ON payments(mechanic_id);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Mechanic Ledger (tracks earnings and transfers)
CREATE TABLE mechanic_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status ledger_status DEFAULT 'pending',
  available_for_transfer_at TIMESTAMPTZ,
  transferred_at TIMESTAMPTZ,
  stripe_transfer_id TEXT,
  paid_out_at TIMESTAMPTZ,
  stripe_payout_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mechanic_ledger_mechanic_id ON mechanic_ledger(mechanic_id);
CREATE INDEX idx_mechanic_ledger_payment_id ON mechanic_ledger(payment_id);
CREATE INDEX idx_mechanic_ledger_status ON mechanic_ledger(status);
CREATE INDEX idx_mechanic_ledger_available_for_transfer ON mechanic_ledger(available_for_transfer_at) WHERE status = 'available_for_transfer';

-- Transfers (weekly payouts)
CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL,
  stripe_transfer_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status transfer_status DEFAULT 'pending',
  ledger_item_ids UUID[] NOT NULL,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transfers_mechanic_id ON transfers(mechanic_id);
CREATE INDEX idx_transfers_stripe_transfer_id ON transfers(stripe_transfer_id);
CREATE INDEX idx_transfers_status ON transfers(status);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unsent ON notifications(sent_at) WHERE sent_at IS NULL;

-- Stripe Webhook Events (idempotency)
CREATE TABLE stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_stripe_webhook_events_stripe_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX idx_stripe_webhook_events_event_type ON stripe_webhook_events(event_type);

-- ============================================================================
-- TRIGGERS (updated_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mechanic_stripe_accounts_updated_at BEFORE UPDATE ON mechanic_stripe_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_invoices_updated_at BEFORE UPDATE ON job_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mechanic_ledger_updated_at BEFORE UPDATE ON mechanic_ledger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transfers_updated_at BEFORE UPDATE ON transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE mechanic_stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanic_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- mechanic_stripe_accounts: mechanics can read their own, service role can write
CREATE POLICY mechanic_stripe_accounts_select ON mechanic_stripe_accounts FOR SELECT USING (auth.uid() = mechanic_id);
CREATE POLICY mechanic_stripe_accounts_service ON mechanic_stripe_accounts FOR ALL USING (auth.role() = 'service_role');

-- jobs: customers and mechanics can read their own jobs
CREATE POLICY jobs_select ON jobs FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = mechanic_id);
CREATE POLICY jobs_insert_customer ON jobs FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY jobs_update_customer ON jobs FOR UPDATE USING (auth.uid() = customer_id OR auth.uid() = mechanic_id);

-- quotes: customers and mechanics can read quotes for their jobs
CREATE POLICY quotes_select ON quotes FOR SELECT USING (
  EXISTS (SELECT 1 FROM jobs WHERE jobs.id = quotes.job_id AND (jobs.customer_id = auth.uid() OR jobs.mechanic_id = auth.uid()))
);
CREATE POLICY quotes_insert_mechanic ON quotes FOR INSERT WITH CHECK (auth.uid() = mechanic_id);
CREATE POLICY quotes_update_mechanic ON quotes FOR UPDATE USING (auth.uid() = mechanic_id);

-- job_adjustments: customers and mechanics can read adjustments for their jobs
CREATE POLICY job_adjustments_select ON job_adjustments FOR SELECT USING (
  EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_adjustments.job_id AND (jobs.customer_id = auth.uid() OR jobs.mechanic_id = auth.uid()))
);
CREATE POLICY job_adjustments_insert_mechanic ON job_adjustments FOR INSERT WITH CHECK (auth.uid() = mechanic_id);
CREATE POLICY job_adjustments_update_customer ON job_adjustments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_adjustments.job_id AND jobs.customer_id = auth.uid())
);

-- job_invoices: customers and mechanics can read invoices for their jobs
CREATE POLICY job_invoices_select ON job_invoices FOR SELECT USING (
  EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_invoices.job_id AND (jobs.customer_id = auth.uid() OR jobs.mechanic_id = auth.uid()))
);

-- payments: customers and mechanics can read their own payments
CREATE POLICY payments_select ON payments FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = mechanic_id);

-- mechanic_ledger: mechanics can read their own ledger
CREATE POLICY mechanic_ledger_select ON mechanic_ledger FOR SELECT USING (auth.uid() = mechanic_id);

-- transfers: mechanics can read their own transfers
CREATE POLICY transfers_select ON transfers FOR SELECT USING (auth.uid() = mechanic_id);

-- notifications: users can read their own notifications
CREATE POLICY notifications_select ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifications_update_own ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- stripe_webhook_events: service role only
CREATE POLICY stripe_webhook_events_service ON stripe_webhook_events FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- SECURE RPC FUNCTIONS
-- ============================================================================

-- Function: verify_job_completion (mechanic or customer)
CREATE OR REPLACE FUNCTION verify_job_completion(p_job_id UUID, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;
  
  IF p_role = 'mechanic' AND v_job.mechanic_id = auth.uid() THEN
    UPDATE jobs SET 
      mechanic_verified_at = NOW(),
      status = CASE 
        WHEN customer_verified_at IS NOT NULL THEN 'customer_verified'::job_status
        ELSE 'mechanic_verified'::job_status
      END
    WHERE id = p_job_id;
    RETURN jsonb_build_object('success', true, 'verified_by', 'mechanic');
  ELSIF p_role = 'customer' AND v_job.customer_id = auth.uid() THEN
    UPDATE jobs SET 
      customer_verified_at = NOW(),
      status = 'customer_verified'::job_status,
      completed_at = NOW()
    WHERE id = p_job_id;
    RETURN jsonb_build_object('success', true, 'verified_by', 'customer');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
END;
$$;

-- Function: check_user_eligibility (ID verified + mechanic has Stripe account)
CREATE OR REPLACE FUNCTION check_user_eligibility(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id_verified BOOLEAN;
  v_stripe_ready BOOLEAN := TRUE;
BEGIN
  -- Check ID verification (assumes auth.users has id_verified column or metadata)
  -- Adjust based on your actual ID verification implementation
  SELECT COALESCE((raw_user_meta_data->>'id_verified')::BOOLEAN, FALSE) INTO v_id_verified
  FROM auth.users WHERE id = p_user_id;
  
  IF NOT v_id_verified THEN
    RETURN FALSE;
  END IF;
  
  -- If mechanic, check Stripe account
  IF p_role = 'mechanic' THEN
    SELECT onboarding_completed AND charges_enabled INTO v_stripe_ready
    FROM mechanic_stripe_accounts WHERE mechanic_id = p_user_id;
    
    IF v_stripe_ready IS NULL OR NOT v_stripe_ready THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$;
