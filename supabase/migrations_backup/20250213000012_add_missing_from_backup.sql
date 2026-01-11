-- ============================================================================
-- Migration: 20250213000012_add_missing_from_backup.sql
-- ============================================================================
-- Purpose: Add missing functions and tables from backup migrations 0017-0026
-- Dependencies: 20250111000001 (profiles, jobs, quotes tables)
-- Risk Level: Low (new functions and tables, idempotent)
-- Rollback: DROP FUNCTION cancel_quote_by_customer, generate_invoice_number,
--           get_mechanic_earnings_summary, get_mechanic_tax_year_summary,
--           get_mechanic_available_tax_years; DROP TABLE financial_summaries;
--
-- NOTE: Tables that depend on job_contracts are skipped (need 0006 first):
--       financial_ledger, invoices, invoice_items
-- ============================================================================

-- =====================================================
-- From 0017: cancel_quote_by_customer
-- =====================================================
CREATE OR REPLACE FUNCTION public.cancel_quote_by_customer(
  p_quote_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_quote_customer_id uuid;
BEGIN
  v_customer_id := auth.uid();

  SELECT customer_id INTO v_quote_customer_id
  FROM public.jobs j
  JOIN public.quotes q ON q.job_id = j.id
  WHERE q.id = p_quote_id;

  IF v_quote_customer_id IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_quote_customer_id != v_customer_id THEN
    RAISE EXCEPTION 'Not authorized to cancel this quote';
  END IF;

  UPDATE public.quotes
  SET
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_quote_id;

  RETURN jsonb_build_object('success', true, 'quote_id', p_quote_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_quote_by_customer(uuid, text, text) TO authenticated;

-- =====================================================
-- From 0023: Financial visibility ENUMs
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.ledger_entry_type AS ENUM (
    'job_payment', 'platform_fee', 'mechanic_commission', 'mechanic_payout',
    'travel_fee', 'parts_charge', 'labor_charge', 'addon_charge', 'tax',
    'refund', 'adjustment', 'cancellation_fee', 'no_show_fee',
    'dispute_hold', 'dispute_release', 'dispute_deduction'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM (
    'draft', 'finalized', 'paid', 'partially_refunded', 'fully_refunded', 'voided'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_type AS ENUM ('customer_invoice', 'mechanic_statement');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- From 0023: financial_summaries table (no FK to job_contracts)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.financial_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_role text NOT NULL,
  period_type text NOT NULL,
  period_start date,
  period_end date,
  total_jobs int DEFAULT 0,
  total_amount_cents bigint DEFAULT 0,
  total_fees_cents bigint DEFAULT 0,
  total_payouts_cents bigint DEFAULT 0,
  pending_payouts_cents bigint DEFAULT 0,
  calculated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_financial_summaries_user_id ON public.financial_summaries(user_id);

ALTER TABLE public.financial_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own financial summaries" ON public.financial_summaries;
CREATE POLICY "Users can view their own financial summaries" ON public.financial_summaries
  FOR SELECT USING (user_id = auth.uid());

GRANT SELECT ON public.financial_summaries TO authenticated;

-- =====================================================
-- From 0023: generate_invoice_number function
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_type text)
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
  
  v_seq := floor(random() * 900000 + 100000)::int;
  
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_seq::text, 6, '0');
END;
$$;

-- =====================================================
-- From 0026: Earnings RPCs (only if payouts table exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payouts') THEN
    CREATE INDEX IF NOT EXISTS idx_payouts_mechanic_processed 
      ON public.payouts (mechanic_id, processed_at);
    CREATE INDEX IF NOT EXISTS idx_payouts_mechanic_status 
      ON public.payouts (mechanic_id, status);
    CREATE INDEX IF NOT EXISTS idx_payouts_status_processed 
      ON public.payouts (status, processed_at);
  END IF;
END $$;

-- =====================================================
-- From 0026: get_mechanic_earnings_summary
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_mechanic_earnings_summary(
  p_mechanic_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE (
  net_completed_cents bigint,
  gross_completed_cents bigint,
  commission_completed_cents bigint,
  adjustments_completed_cents bigint,
  net_pending_cents bigint,
  count_completed bigint,
  avg_net_completed_cents bigint,
  take_rate_bps int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_net_completed bigint := 0;
  v_gross_completed bigint := 0;
  v_commission_completed bigint := 0;
  v_adjustments_completed bigint := 0;
  v_net_pending bigint := 0;
  v_count_completed bigint := 0;
  v_avg_net bigint := 0;
  v_take_rate int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payouts') THEN
    SELECT 
      COALESCE(SUM(net_amount_cents), 0),
      COALESCE(SUM(gross_amount_cents), 0),
      COALESCE(SUM(commission_cents), 0),
      COALESCE(SUM(adjustments_cents), 0),
      COUNT(*)
    INTO 
      v_net_completed,
      v_gross_completed,
      v_commission_completed,
      v_adjustments_completed,
      v_count_completed
    FROM payouts
    WHERE mechanic_id = p_mechanic_id
      AND status = 'completed'
      AND processed_at >= p_start
      AND processed_at < p_end;

    SELECT COALESCE(SUM(net_amount_cents), 0)
    INTO v_net_pending
    FROM payouts
    WHERE mechanic_id = p_mechanic_id
      AND status IN ('pending', 'processing', 'held');

    IF v_count_completed > 0 THEN
      v_avg_net := v_net_completed / v_count_completed;
    END IF;

    IF v_gross_completed > 0 THEN
      v_take_rate := ((v_net_completed::numeric / v_gross_completed::numeric) * 10000)::int;
    END IF;
  END IF;

  RETURN QUERY SELECT 
    v_net_completed,
    v_gross_completed,
    v_commission_completed,
    v_adjustments_completed,
    v_net_pending,
    v_count_completed,
    v_avg_net,
    v_take_rate;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_earnings_summary(uuid, timestamptz, timestamptz) TO authenticated;

-- =====================================================
-- From 0026: get_mechanic_tax_year_summary
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_mechanic_tax_year_summary(
  p_mechanic_id uuid,
  p_tax_year int
)
RETURNS TABLE (
  year_net_payouts_cents bigint,
  year_commission_cents bigint,
  year_adjustments_cents bigint,
  year_taxable_estimate_cents bigint,
  monthly_breakdown jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_start timestamptz;
  v_year_end timestamptz;
  v_net bigint := 0;
  v_commission bigint := 0;
  v_adjustments bigint := 0;
  v_monthly jsonb := '[]'::jsonb;
BEGIN
  v_year_start := (p_tax_year || '-01-01')::date AT TIME ZONE 'America/Chicago';
  v_year_end := ((p_tax_year + 1) || '-01-01')::date AT TIME ZONE 'America/Chicago';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payouts') THEN
    SELECT 
      COALESCE(SUM(net_amount_cents), 0),
      COALESCE(SUM(commission_cents), 0),
      COALESCE(SUM(adjustments_cents), 0)
    INTO v_net, v_commission, v_adjustments
    FROM payouts
    WHERE mechanic_id = p_mechanic_id
      AND status = 'completed'
      AND processed_at >= v_year_start
      AND processed_at < v_year_end;

    SELECT jsonb_agg(
      jsonb_build_object(
        'month', m.month,
        'net_cents', COALESCE(d.net, 0),
        'commission_cents', COALESCE(d.commission, 0),
        'adjustments_cents', COALESCE(d.adjustments, 0)
      ) ORDER BY m.month
    )
    INTO v_monthly
    FROM generate_series(1, 12) AS m(month)
    LEFT JOIN (
      SELECT 
        EXTRACT(MONTH FROM processed_at AT TIME ZONE 'America/Chicago')::int as month,
        SUM(net_amount_cents) as net,
        SUM(commission_cents) as commission,
        SUM(adjustments_cents) as adjustments
      FROM payouts
      WHERE mechanic_id = p_mechanic_id
        AND status = 'completed'
        AND processed_at >= v_year_start
        AND processed_at < v_year_end
      GROUP BY EXTRACT(MONTH FROM processed_at AT TIME ZONE 'America/Chicago')
    ) d ON d.month = m.month;
  END IF;

  RETURN QUERY SELECT 
    v_net,
    v_commission,
    v_adjustments,
    v_net - v_commission - v_adjustments,
    COALESCE(v_monthly, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_tax_year_summary(uuid, int) TO authenticated;

-- =====================================================
-- From 0026: get_mechanic_available_tax_years
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_mechanic_available_tax_years(
  p_mechanic_id uuid
)
RETURNS TABLE (tax_year int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payouts') THEN
    RETURN QUERY
    SELECT DISTINCT EXTRACT(YEAR FROM processed_at AT TIME ZONE 'America/Chicago')::int as tax_year
    FROM payouts
    WHERE mechanic_id = p_mechanic_id
      AND status = 'completed'
      AND processed_at IS NOT NULL
    ORDER BY tax_year DESC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_available_tax_years(uuid) TO authenticated;
