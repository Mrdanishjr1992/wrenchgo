-- =====================================================
-- CREATE PAYMENTS TABLE
-- =====================================================
-- Purpose: Track all payment transactions for jobs
-- This table is required by the stripe-webhook handler
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  quote_id uuid,
  customer_id uuid NOT NULL,
  mechanic_id uuid NOT NULL,
  
  -- Stripe identifiers
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  stripe_connected_account_id text,
  
  -- Payment status
  status text DEFAULT 'processing' CHECK (
    status = ANY (ARRAY[
      'processing'::text,
      'paid'::text,
      'failed'::text,
      'cancelled'::text,
      'refunded'::text,
      'partially_refunded'::text
    ])
  ),
  
  -- Amount breakdown (all in cents)
  quote_amount_cents integer NOT NULL,
  customer_platform_fee_cents integer DEFAULT 0,
  customer_discount_cents integer DEFAULT 0,
  customer_total_cents integer NOT NULL,
  mechanic_platform_commission_cents integer NOT NULL,
  mechanic_payout_cents integer NOT NULL,
  platform_revenue_cents integer NOT NULL,
  
  -- Payment details
  payment_method_type text,
  receipt_url text,
  
  -- Timestamps
  paid_at timestamptz,
  refunded_at timestamptz,
  refund_amount_cents integer DEFAULT 0,
  failure_reason text,
  
  -- Promotions
  promotion_codes text[],
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT payments_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_job_id ON public.payments(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_mechanic_id ON public.payments(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- Add RLS policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Customers can view own payments" ON public.payments;
  DROP POLICY IF EXISTS "Mechanics can view their payments" ON public.payments;
  DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Customers can view their own payments
CREATE POLICY "Customers can view own payments"
  ON public.payments
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM public.profiles WHERE auth_id = auth.uid()
    )
  );

-- Mechanics can view payments for their jobs
CREATE POLICY "Mechanics can view their payments"
  ON public.payments
  FOR SELECT
  USING (
    mechanic_id IN (
      SELECT id FROM public.profiles WHERE auth_id = auth.uid()
    )
  );

-- Service role can manage all payments
CREATE POLICY "Service role can manage payments"
  ON public.payments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_payments_updated_at'
  ) THEN
    CREATE TRIGGER set_payments_updated_at
      BEFORE UPDATE ON public.payments
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Add comment
COMMENT ON TABLE public.payments IS 'Tracks all payment transactions for jobs. Updated by Stripe webhooks.';
