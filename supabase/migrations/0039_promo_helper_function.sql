-- Helper function to get platform fee
CREATE OR REPLACE FUNCTION public.get_platform_fee(p_quote_amount_cents int)
RETURNS int
LANGUAGE plpgsql
STABLE
AS $func$
DECLARE
  v_percent numeric;
  v_min int;
  v_max int;
  v_fee int;
BEGIN
  SELECT value_percent INTO v_percent FROM platform_pricing WHERE key = 'platform_fee_percent' AND effective_until IS NULL;
  SELECT value_cents INTO v_min FROM platform_pricing WHERE key = 'min_platform_fee_cents' AND effective_until IS NULL;
  SELECT value_cents INTO v_max FROM platform_pricing WHERE key = 'max_platform_fee_cents' AND effective_until IS NULL;

  v_fee := FLOOR(p_quote_amount_cents * COALESCE(v_percent, 10) / 100)::int;
  v_fee := GREATEST(v_fee, COALESCE(v_min, 500));
  v_fee := LEAST(v_fee, COALESCE(v_max, 10000));

  RETURN v_fee;
END;
$func$;
