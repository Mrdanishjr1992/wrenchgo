-- =====================================================
-- MIGRATION 0026: EARNINGS & TAXES RPCs
-- =====================================================
-- Purpose: RPCs for mechanic earnings dashboard
-- Timezone: All boundaries use America/Chicago
-- =====================================================

BEGIN;

-- =====================================================
-- INDEXES for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_payouts_mechanic_processed 
  ON public.payouts (mechanic_id, processed_at);

CREATE INDEX IF NOT EXISTS idx_payouts_mechanic_status 
  ON public.payouts (mechanic_id, status);

CREATE INDEX IF NOT EXISTS idx_payouts_status_processed 
  ON public.payouts (status, processed_at);

-- =====================================================
-- RPC 1: get_mechanic_earnings_summary
-- =====================================================
-- Returns aggregated earnings for a date range

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
  v_net_completed bigint;
  v_gross_completed bigint;
  v_commission_completed bigint;
  v_adjustments_completed bigint;
  v_net_pending bigint;
  v_count_completed bigint;
  v_avg_net bigint;
  v_take_rate int;
BEGIN
  -- Completed payouts in range
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

  -- Pending payouts (all time for this mechanic)
  SELECT COALESCE(SUM(net_amount_cents), 0)
  INTO v_net_pending
  FROM payouts
  WHERE mechanic_id = p_mechanic_id
    AND status IN ('pending', 'processing', 'held');

  -- Calculate averages and rates
  IF v_count_completed > 0 THEN
    v_avg_net := v_net_completed / v_count_completed;
  ELSE
    v_avg_net := 0;
  END IF;

  IF v_gross_completed > 0 THEN
    v_take_rate := ((v_net_completed::numeric / v_gross_completed::numeric) * 10000)::int;
  ELSE
    v_take_rate := 0;
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

COMMENT ON FUNCTION public.get_mechanic_earnings_summary IS 'Get aggregated earnings summary for a mechanic within a date range';

-- =====================================================
-- RPC 2: get_mechanic_payouts
-- =====================================================
-- Returns paginated payout list with job/customer details

CREATE OR REPLACE FUNCTION public.get_mechanic_payouts(
  p_mechanic_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  payout_id uuid,
  contract_id uuid,
  status text,
  gross_amount_cents int,
  commission_cents int,
  adjustments_cents int,
  net_amount_cents int,
  scheduled_for timestamptz,
  processed_at timestamptz,
  failed_at timestamptz,
  held_at timestamptz,
  failure_reason text,
  hold_reason text,
  job_id uuid,
  job_title text,
  customer_id uuid,
  customer_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as payout_id,
    p.contract_id,
    p.status::text,
    p.gross_amount_cents,
    p.commission_cents,
    p.adjustments_cents,
    p.net_amount_cents,
    p.scheduled_for,
    p.processed_at,
    p.failed_at,
    p.held_at,
    p.failure_reason,
    p.hold_reason,
    j.id as job_id,
    j.title as job_title,
    j.customer_id,
    COALESCE(pr.display_name, pr.full_name, 'Customer') as customer_name,
    p.created_at
  FROM payouts p
  JOIN job_contracts jc ON jc.id = p.contract_id
  JOIN jobs j ON j.id = jc.job_id
  LEFT JOIN profiles pr ON pr.id = j.customer_id
  WHERE p.mechanic_id = p_mechanic_id
    AND (
      (p.status = 'completed' AND p.processed_at >= p_start AND p.processed_at < p_end)
      OR (p.status IN ('pending', 'processing', 'held', 'failed') AND p.created_at >= p_start AND p.created_at < p_end)
    )
  ORDER BY 
    CASE WHEN p.status IN ('pending', 'processing', 'held') THEN 0 ELSE 1 END,
    COALESCE(p.processed_at, p.created_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.get_mechanic_payouts IS 'Get paginated payout list with job and customer details';

-- =====================================================
-- RPC 3: get_mechanic_tax_year_summary
-- =====================================================
-- Returns yearly tax summary with monthly breakdown

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
  v_net bigint;
  v_commission bigint;
  v_adjustments bigint;
  v_monthly jsonb;
BEGIN
  -- Year boundaries in America/Chicago timezone
  v_year_start := (p_tax_year || '-01-01')::date AT TIME ZONE 'America/Chicago';
  v_year_end := ((p_tax_year + 1) || '-01-01')::date AT TIME ZONE 'America/Chicago';

  -- Yearly totals (cash basis - only completed payouts)
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

  -- Monthly breakdown
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

  RETURN QUERY SELECT 
    v_net,
    v_commission,
    v_adjustments,
    v_net - v_commission - v_adjustments,
    v_monthly;
END;
$$;

COMMENT ON FUNCTION public.get_mechanic_tax_year_summary IS 'Get yearly tax summary with monthly breakdown for a mechanic';

-- =====================================================
-- RPC 4: get_mechanic_available_tax_years
-- =====================================================
-- Returns list of years that have payout data

CREATE OR REPLACE FUNCTION public.get_mechanic_available_tax_years(
  p_mechanic_id uuid
)
RETURNS TABLE (tax_year int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT EXTRACT(YEAR FROM processed_at AT TIME ZONE 'America/Chicago')::int as tax_year
  FROM payouts
  WHERE mechanic_id = p_mechanic_id
    AND status = 'completed'
    AND processed_at IS NOT NULL
  ORDER BY tax_year DESC;
END;
$$;

COMMENT ON FUNCTION public.get_mechanic_available_tax_years IS 'Get list of tax years with payout data';

COMMIT;
