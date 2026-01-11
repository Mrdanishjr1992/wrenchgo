-- =====================================================
-- MIGRATION 0023: FINANCIAL VISIBILITY SYSTEM
-- =====================================================
-- Purpose: Production-grade financial ledger, invoices, and audit trail
-- =====================================================

BEGIN;

-- =====================================================
-- ENUM: Ledger entry types
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.ledger_entry_type AS ENUM (
    'job_payment',           -- Customer payment for job
    'platform_fee',          -- Platform fee charged
    'mechanic_commission',   -- Commission deducted from mechanic
    'mechanic_payout',       -- Payout to mechanic
    'travel_fee',            -- Travel/arrival fee
    'parts_charge',          -- Parts charges
    'labor_charge',          -- Labor charges
    'addon_charge',          -- Add-on charges
    'tax',                   -- Tax charges
    'refund',                -- Refund to customer
    'adjustment',            -- Manual adjustment
    'cancellation_fee',      -- Cancellation fee
    'no_show_fee',           -- No-show fee
    'dispute_hold',          -- Amount held for dispute
    'dispute_release',       -- Amount released after dispute
    'dispute_deduction'      -- Amount deducted due to dispute
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'finalized',
    'paid',
    'partially_refunded',
    'fully_refunded',
    'voided'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_type AS ENUM (
    'customer_invoice',
    'mechanic_statement'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TABLE: financial_ledger
-- =====================================================
-- Immutable audit trail of all financial transactions
CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.job_contracts(id) ON DELETE SET NULL,
  payout_id uuid REFERENCES public.payouts(id) ON DELETE SET NULL,
  
  -- Parties
  from_party_id uuid REFERENCES public.profiles(id),  -- Who paid
  to_party_id uuid REFERENCES public.profiles(id),    -- Who received
  from_party_type text,  -- 'customer', 'mechanic', 'platform'
  to_party_type text,    -- 'customer', 'mechanic', 'platform'
  
  -- Transaction details
  entry_type public.ledger_entry_type NOT NULL,
  amount_cents int NOT NULL,  -- Always positive, direction determined by from/to
  currency text DEFAULT 'USD' NOT NULL,
  
  -- Description
  description text NOT NULL,
  reference_id text,  -- External reference (Stripe ID, etc.)
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  
  -- Immutability
  is_immutable boolean DEFAULT true NOT NULL,
  superseded_by uuid REFERENCES public.financial_ledger(id),
  supersedes uuid REFERENCES public.financial_ledger(id),
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  effective_at timestamptz DEFAULT now() NOT NULL,
  
  -- Audit
  created_by uuid REFERENCES public.profiles(id),
  
  CONSTRAINT positive_amount CHECK (amount_cents >= 0)
);

COMMENT ON TABLE public.financial_ledger IS 'Immutable financial audit trail';

-- =====================================================
-- TABLE: invoices
-- =====================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Invoice number (human readable)
  invoice_number text UNIQUE NOT NULL,
  
  -- References
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.job_contracts(id) ON DELETE SET NULL,
  
  -- Type and parties
  invoice_type public.invoice_type NOT NULL,
  issuer_id uuid NOT NULL REFERENCES public.profiles(id),  -- Platform or mechanic
  recipient_id uuid NOT NULL REFERENCES public.profiles(id),  -- Customer or mechanic
  
  -- Status
  status public.invoice_status DEFAULT 'draft' NOT NULL,
  
  -- Amounts (all in cents)
  subtotal_cents int NOT NULL DEFAULT 0,
  platform_fee_cents int NOT NULL DEFAULT 0,
  travel_fee_cents int NOT NULL DEFAULT 0,
  tax_cents int NOT NULL DEFAULT 0,
  discount_cents int NOT NULL DEFAULT 0,
  total_cents int NOT NULL DEFAULT 0,
  
  -- For mechanic statements
  gross_earnings_cents int DEFAULT 0,
  commission_deducted_cents int DEFAULT 0,
  adjustments_cents int DEFAULT 0,
  net_payout_cents int DEFAULT 0,
  
  -- Payment info
  payment_method text,
  payment_reference text,
  paid_at timestamptz,
  
  -- Versioning for adjustments
  version int DEFAULT 1 NOT NULL,
  previous_version_id uuid REFERENCES public.invoices(id),
  adjustment_reason text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  finalized_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  
  CONSTRAINT valid_amounts CHECK (
    subtotal_cents >= 0 AND
    platform_fee_cents >= 0 AND
    travel_fee_cents >= 0 AND
    tax_cents >= 0 AND
    discount_cents >= 0 AND
    total_cents >= 0
  )
);

COMMENT ON TABLE public.invoices IS 'Customer invoices and mechanic statements';

-- =====================================================
-- TABLE: invoice_items
-- =====================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  
  -- Item details
  item_type text NOT NULL,  -- 'labor', 'parts', 'travel', 'platform_fee', 'tax', etc.
  description text NOT NULL,
  quantity numeric DEFAULT 1 NOT NULL,
  unit_price_cents int NOT NULL,
  total_cents int NOT NULL,
  
  -- For parts
  part_number text,
  part_source text,
  
  -- Ordering
  sort_order int DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT positive_item_amounts CHECK (
    quantity > 0 AND
    unit_price_cents >= 0 AND
    total_cents >= 0
  )
);

COMMENT ON TABLE public.invoice_items IS 'Line items on invoices';

-- =====================================================
-- TABLE: financial_summaries (materialized view alternative)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.financial_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_role text NOT NULL,  -- 'customer' or 'mechanic'
  
  -- Period
  period_type text NOT NULL,  -- 'all_time', 'year', 'month', 'week'
  period_start date,
  period_end date,
  
  -- Aggregates
  total_jobs int DEFAULT 0,
  total_amount_cents bigint DEFAULT 0,
  total_fees_cents bigint DEFAULT 0,
  total_payouts_cents bigint DEFAULT 0,
  pending_payouts_cents bigint DEFAULT 0,
  
  -- Last updated
  calculated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(user_id, period_type, period_start)
);

COMMENT ON TABLE public.financial_summaries IS 'Pre-calculated financial summaries';

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_financial_ledger_job_id ON public.financial_ledger(job_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_contract_id ON public.financial_ledger(contract_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_from_party ON public.financial_ledger(from_party_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_to_party ON public.financial_ledger(to_party_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_entry_type ON public.financial_ledger(entry_type);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_effective_at ON public.financial_ledger(effective_at);

CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON public.invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_recipient_id ON public.invoices(recipient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(invoice_type);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_financial_summaries_user_id ON public.financial_summaries(user_id);

-- =====================================================
-- FUNCTION: Generate invoice number
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_type public.invoice_type)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text;
  v_seq int;
  v_year text;
BEGIN
  v_year := to_char(now(), 'YY');
  
  IF p_type = 'customer_invoice' THEN
    v_prefix := 'INV';
  ELSE
    v_prefix := 'STM';
  END IF;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$')
      THEN CAST(split_part(invoice_number, '-', 3) AS int)
      ELSE 0
    END
  ), 0) + 1
  INTO v_seq
  FROM public.invoices
  WHERE invoice_type = p_type;
  
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_seq::text, 6, '0');
END;
$$;

-- =====================================================
-- FUNCTION: Create ledger entry
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_ledger_entry(
  p_job_id uuid,
  p_contract_id uuid,
  p_entry_type public.ledger_entry_type,
  p_amount_cents int,
  p_from_party_id uuid,
  p_from_party_type text,
  p_to_party_id uuid,
  p_to_party_type text,
  p_description text,
  p_reference_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry_id uuid;
BEGIN
  INSERT INTO public.financial_ledger (
    job_id, contract_id, entry_type, amount_cents,
    from_party_id, from_party_type, to_party_id, to_party_type,
    description, reference_id, metadata, created_by
  ) VALUES (
    p_job_id, p_contract_id, p_entry_type, p_amount_cents,
    p_from_party_id, p_from_party_type, p_to_party_id, p_to_party_type,
    p_description, p_reference_id, p_metadata, auth.uid()
  )
  RETURNING id INTO v_entry_id;
  
  RETURN v_entry_id;
END;
$$;

-- =====================================================
-- FUNCTION: Generate invoices for completed job
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_job_invoices(p_job_id uuid)
RETURNS TABLE(customer_invoice_id uuid, mechanic_statement_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job record;
  v_contract record;
  v_customer_invoice_id uuid;
  v_mechanic_statement_id uuid;
  v_line_item record;
  v_platform_id uuid;
BEGIN
  -- Get job and contract details
  SELECT j.*, c.id as contract_id, c.quoted_price_cents, c.platform_fee_cents,
         c.subtotal_cents, c.total_customer_cents, c.mechanic_commission_cents,
         c.mechanic_payout_cents, c.stripe_payment_intent_id
  INTO v_job
  FROM public.jobs j
  JOIN public.job_contracts c ON c.job_id = j.id
  WHERE j.id = p_job_id;
  
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job or contract not found';
  END IF;
  
  -- Platform ID is NULL (system-level entity, no user profile)
  v_platform_id := NULL;
  
  -- Create customer invoice
  INSERT INTO public.invoices (
    invoice_number, job_id, contract_id, invoice_type,
    issuer_id, recipient_id, status,
    subtotal_cents, platform_fee_cents, total_cents,
    payment_method, payment_reference, paid_at, finalized_at
  ) VALUES (
    public.generate_invoice_number('customer_invoice'),
    p_job_id, v_job.contract_id, 'customer_invoice',
    COALESCE(v_platform_id, v_job.accepted_mechanic_id), v_job.customer_id, 'paid',
    v_job.subtotal_cents, v_job.platform_fee_cents, v_job.total_customer_cents,
    'card', v_job.stripe_payment_intent_id, now(), now()
  )
  RETURNING id INTO v_customer_invoice_id;
  
  -- Add line items from contract
  FOR v_line_item IN
    SELECT * FROM public.invoice_line_items
    WHERE contract_id = v_job.contract_id
    AND approval_status = 'approved'
    ORDER BY sort_order
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, item_type, description, quantity,
      unit_price_cents, total_cents, part_number, part_source, sort_order
    ) VALUES (
      v_customer_invoice_id, v_line_item.item_type::text, v_line_item.description,
      v_line_item.quantity, v_line_item.unit_price_cents, v_line_item.total_cents,
      v_line_item.part_number, v_line_item.part_source, v_line_item.sort_order
    );
  END LOOP;
  
  -- Add platform fee as line item
  IF v_job.platform_fee_cents > 0 THEN
    INSERT INTO public.invoice_items (
      invoice_id, item_type, description, quantity,
      unit_price_cents, total_cents, sort_order
    ) VALUES (
      v_customer_invoice_id, 'platform_fee', 'Service Fee', 1,
      v_job.platform_fee_cents, v_job.platform_fee_cents, 9999
    );
  END IF;
  
  -- Create mechanic statement
  INSERT INTO public.invoices (
    invoice_number, job_id, contract_id, invoice_type,
    issuer_id, recipient_id, status,
    gross_earnings_cents, commission_deducted_cents, net_payout_cents,
    finalized_at
  ) VALUES (
    public.generate_invoice_number('mechanic_statement'),
    p_job_id, v_job.contract_id, 'mechanic_statement',
    COALESCE(v_platform_id, v_job.accepted_mechanic_id), v_job.accepted_mechanic_id, 'finalized',
    v_job.subtotal_cents, v_job.mechanic_commission_cents, v_job.mechanic_payout_cents,
    now()
  )
  RETURNING id INTO v_mechanic_statement_id;
  
  -- Add earnings breakdown to mechanic statement
  INSERT INTO public.invoice_items (
    invoice_id, item_type, description, quantity,
    unit_price_cents, total_cents, sort_order
  ) VALUES 
    (v_mechanic_statement_id, 'gross_earnings', 'Gross Job Earnings', 1, v_job.subtotal_cents, v_job.subtotal_cents, 1),
    (v_mechanic_statement_id, 'commission', 'Platform Commission (12%, max $50)', 1, -v_job.mechanic_commission_cents, -v_job.mechanic_commission_cents, 2),
    (v_mechanic_statement_id, 'net_payout', 'Net Payout', 1, v_job.mechanic_payout_cents, v_job.mechanic_payout_cents, 3);
  
  -- Create ledger entries
  -- Customer payment
  PERFORM public.create_ledger_entry(
    p_job_id, v_job.contract_id, 'job_payment', v_job.total_customer_cents,
    v_job.customer_id, 'customer', NULL, 'platform',
    'Payment for job ' || p_job_id::text,
    v_job.stripe_payment_intent_id
  );
  
  -- Platform fee
  IF v_job.platform_fee_cents > 0 THEN
    PERFORM public.create_ledger_entry(
      p_job_id, v_job.contract_id, 'platform_fee', v_job.platform_fee_cents,
      v_job.customer_id, 'customer', NULL, 'platform',
      'Platform service fee'
    );
  END IF;
  
  -- Mechanic commission
  IF v_job.mechanic_commission_cents > 0 THEN
    PERFORM public.create_ledger_entry(
      p_job_id, v_job.contract_id, 'mechanic_commission', v_job.mechanic_commission_cents,
      v_job.accepted_mechanic_id, 'mechanic', NULL, 'platform',
      'Platform commission (12%, max $50)'
    );
  END IF;
  
  RETURN QUERY SELECT v_customer_invoice_id, v_mechanic_statement_id;
END;
$$;

-- =====================================================
-- FUNCTION: Get job financial breakdown (customer view)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_customer_job_financials(p_job_id uuid, p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'job_id', j.id,
    'quote_amount_cents', c.quoted_price_cents,
    'subtotal_cents', c.subtotal_cents,
    'platform_fee_cents', c.platform_fee_cents,
    'total_cents', c.total_customer_cents,
    'payment_status', CASE WHEN c.payment_captured_at IS NOT NULL THEN 'paid' ELSE 'pending' END,
    'payment_method', 'card',
    'paid_at', c.payment_captured_at,
    'invoice', (
      SELECT jsonb_build_object(
        'id', i.id,
        'invoice_number', i.invoice_number,
        'status', i.status,
        'items', (
          SELECT jsonb_agg(jsonb_build_object(
            'type', ii.item_type,
            'description', ii.description,
            'quantity', ii.quantity,
            'unit_price_cents', ii.unit_price_cents,
            'total_cents', ii.total_cents
          ) ORDER BY ii.sort_order)
          FROM public.invoice_items ii
          WHERE ii.invoice_id = i.id
        )
      )
      FROM public.invoices i
      WHERE i.job_id = j.id AND i.invoice_type = 'customer_invoice'
      LIMIT 1
    ),
    'line_items', (
      SELECT jsonb_agg(jsonb_build_object(
        'type', ili.item_type,
        'description', ili.description,
        'quantity', ili.quantity,
        'unit_price_cents', ili.unit_price_cents,
        'total_cents', ili.total_cents,
        'status', ili.approval_status
      ) ORDER BY ili.sort_order)
      FROM public.invoice_line_items ili
      WHERE ili.contract_id = c.id
    )
  )
  INTO v_result
  FROM public.jobs j
  JOIN public.job_contracts c ON c.job_id = j.id
  WHERE j.id = p_job_id AND j.customer_id = p_customer_id;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- =====================================================
-- FUNCTION: Get job financial breakdown (mechanic view)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_mechanic_job_financials(p_job_id uuid, p_mechanic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'job_id', j.id,
    'gross_amount_cents', c.subtotal_cents,
    'commission_cents', c.mechanic_commission_cents,
    'net_payout_cents', c.mechanic_payout_cents,
    'payout_status', COALESCE(p.status::text, 'pending'),
    'payout_id', p.id,
    'stripe_transfer_id', p.stripe_transfer_id,
    'statement', (
      SELECT jsonb_build_object(
        'id', i.id,
        'invoice_number', i.invoice_number,
        'status', i.status,
        'items', (
          SELECT jsonb_agg(jsonb_build_object(
            'type', ii.item_type,
            'description', ii.description,
            'total_cents', ii.total_cents
          ) ORDER BY ii.sort_order)
          FROM public.invoice_items ii
          WHERE ii.invoice_id = i.id
        )
      )
      FROM public.invoices i
      WHERE i.job_id = j.id AND i.invoice_type = 'mechanic_statement'
      LIMIT 1
    )
  )
  INTO v_result
  FROM public.jobs j
  JOIN public.job_contracts c ON c.job_id = j.id
  LEFT JOIN public.payouts p ON p.contract_id = c.id
  WHERE j.id = p_job_id AND j.accepted_mechanic_id = p_mechanic_id;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- =====================================================
-- FUNCTION: Get financial summary
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_financial_summary(
  p_user_id uuid,
  p_role text,
  p_period_type text DEFAULT 'all_time'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_start_date date;
BEGIN
  -- Calculate period start
  v_start_date := CASE p_period_type
    WHEN 'week' THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN 'month' THEN CURRENT_DATE - INTERVAL '30 days'
    WHEN 'year' THEN CURRENT_DATE - INTERVAL '365 days'
    ELSE NULL
  END;
  
  IF p_role = 'mechanic' THEN
    SELECT jsonb_build_object(
      'total_jobs', COUNT(DISTINCT j.id),
      'total_earnings_cents', COALESCE(SUM(c.mechanic_payout_cents), 0),
      'total_commission_cents', COALESCE(SUM(c.mechanic_commission_cents), 0),
      'pending_payouts_cents', COALESCE(SUM(
        CASE WHEN p.status = 'pending' THEN p.net_amount_cents ELSE 0 END
      ), 0),
      'completed_payouts_cents', COALESCE(SUM(
        CASE WHEN p.status = 'completed' THEN p.net_amount_cents ELSE 0 END
      ), 0)
    )
    INTO v_result
    FROM public.jobs j
    JOIN public.job_contracts c ON c.job_id = j.id
    LEFT JOIN public.payouts p ON p.contract_id = c.id
    WHERE j.accepted_mechanic_id = p_user_id
      AND j.status = 'completed'
      AND (v_start_date IS NULL OR j.created_at >= v_start_date);
  ELSE
    SELECT jsonb_build_object(
      'total_jobs', COUNT(DISTINCT j.id),
      'total_spent_cents', COALESCE(SUM(c.total_customer_cents), 0),
      'total_fees_cents', COALESCE(SUM(c.platform_fee_cents), 0)
    )
    INTO v_result
    FROM public.jobs j
    JOIN public.job_contracts c ON c.job_id = j.id
    WHERE j.customer_id = p_user_id
      AND j.status = 'completed'
      AND (v_start_date IS NULL OR j.created_at >= v_start_date);
  END IF;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- =====================================================
-- FUNCTION: Process refund
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_refund(
  p_job_id uuid,
  p_amount_cents int,
  p_reason text,
  p_initiated_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job record;
  v_entry_id uuid;
BEGIN
  SELECT j.*, c.id as contract_id, c.total_customer_cents
  INTO v_job
  FROM public.jobs j
  JOIN public.job_contracts c ON c.job_id = j.id
  WHERE j.id = p_job_id;
  
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  IF p_amount_cents > v_job.total_customer_cents THEN
    RAISE EXCEPTION 'Refund amount exceeds total paid';
  END IF;
  
  -- Create refund ledger entry
  v_entry_id := public.create_ledger_entry(
    p_job_id, v_job.contract_id, 'refund', p_amount_cents,
    NULL, 'platform', v_job.customer_id, 'customer',
    'Refund: ' || p_reason
  );
  
  -- Update invoice status
  UPDATE public.invoices
  SET status = CASE 
    WHEN p_amount_cents >= v_job.total_customer_cents THEN 'fully_refunded'
    ELSE 'partially_refunded'
  END,
  updated_at = now()
  WHERE job_id = p_job_id AND invoice_type = 'customer_invoice';
  
  RETURN v_entry_id;
END;
$$;

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_summaries ENABLE ROW LEVEL SECURITY;

-- Financial ledger: users can see entries where they are a party
CREATE POLICY "Users can view their ledger entries"
  ON public.financial_ledger FOR SELECT
  USING (
    from_party_id = auth.uid() OR
    to_party_id = auth.uid()
  );

-- Invoices: users can see their own invoices
CREATE POLICY "Users can view their invoices"
  ON public.invoices FOR SELECT
  USING (
    recipient_id = auth.uid() OR
    issuer_id = auth.uid()
  );

-- Invoice items: through invoice access
CREATE POLICY "Users can view invoice items"
  ON public.invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
      AND (i.recipient_id = auth.uid() OR i.issuer_id = auth.uid())
    )
  );

-- Financial summaries: users can see their own
CREATE POLICY "Users can view their summaries"
  ON public.financial_summaries FOR SELECT
  USING (user_id = auth.uid());

COMMIT;
