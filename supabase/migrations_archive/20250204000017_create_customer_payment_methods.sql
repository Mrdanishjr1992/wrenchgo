-- =====================================================
-- CREATE CUSTOMER PAYMENT METHODS TABLE
-- =====================================================
-- Purpose: Store customer Stripe payment methods
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  
  -- Stripe identifiers
  stripe_customer_id text NOT NULL,
  stripe_payment_method_id text NOT NULL UNIQUE,
  
  -- Card details
  card_brand text,
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,
  
  -- Status
  is_default boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT customer_payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT customer_payment_methods_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer_id ON public.customer_payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_stripe_customer_id ON public.customer_payment_methods(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_stripe_payment_method_id ON public.customer_payment_methods(stripe_payment_method_id);

-- Add RLS policies
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Customers can view own payment methods" ON public.customer_payment_methods;
  DROP POLICY IF EXISTS "Customers can insert own payment methods" ON public.customer_payment_methods;
  DROP POLICY IF EXISTS "Customers can update own payment methods" ON public.customer_payment_methods;
  DROP POLICY IF EXISTS "Customers can delete own payment methods" ON public.customer_payment_methods;
  DROP POLICY IF EXISTS "Service role can manage payment methods" ON public.customer_payment_methods;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Customers can view their own payment methods
CREATE POLICY "Customers can view own payment methods"
  ON public.customer_payment_methods
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM public.profiles WHERE auth_id = auth.uid()
    )
  );

-- Customers can insert their own payment methods
CREATE POLICY "Customers can insert own payment methods"
  ON public.customer_payment_methods
  FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT id FROM public.profiles WHERE auth_id = auth.uid()
    )
  );

-- Customers can update their own payment methods
CREATE POLICY "Customers can update own payment methods"
  ON public.customer_payment_methods
  FOR UPDATE
  USING (
    customer_id IN (
      SELECT id FROM public.profiles WHERE auth_id = auth.uid()
    )
  );

-- Customers can delete their own payment methods
CREATE POLICY "Customers can delete own payment methods"
  ON public.customer_payment_methods
  FOR DELETE
  USING (
    customer_id IN (
      SELECT id FROM public.profiles WHERE auth_id = auth.uid()
    )
  );

-- Service role can manage all payment methods
CREATE POLICY "Service role can manage payment methods"
  ON public.customer_payment_methods
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_customer_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_payment_methods_updated_at ON public.customer_payment_methods;
CREATE TRIGGER update_customer_payment_methods_updated_at
  BEFORE UPDATE ON public.customer_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_payment_methods_updated_at();
