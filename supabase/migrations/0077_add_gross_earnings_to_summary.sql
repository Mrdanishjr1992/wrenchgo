-- Add gross_earnings_cents to financial summary for mechanics
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
      'gross_earnings_cents', COALESCE(SUM(c.mechanic_payout_cents + c.mechanic_commission_cents), 0),
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
