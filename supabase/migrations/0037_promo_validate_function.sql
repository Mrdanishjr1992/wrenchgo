-- Promo validation function (read-only)
CREATE OR REPLACE FUNCTION public.validate_promo_eligibility(
  p_user_id uuid,
  p_promo_code text,
  p_quote_amount_cents int,
  p_platform_fee_cents int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $func$
DECLARE
  v_promo record;
  v_user_redemptions int;
  v_user_role text;
  v_user_created_at timestamptz;
  v_platform_fee int;
  v_discount_cents int;
  v_eligible_amount int;
BEGIN
  IF p_platform_fee_cents IS NULL THEN
    v_platform_fee := GREATEST(
      COALESCE((SELECT value_cents FROM platform_pricing WHERE key = 'min_platform_fee_cents' AND effective_until IS NULL), 500),
      LEAST(
        (p_quote_amount_cents * COALESCE((SELECT value_percent FROM platform_pricing WHERE key = 'platform_fee_percent' AND effective_until IS NULL), 10) / 100)::int,
        COALESCE((SELECT value_cents FROM platform_pricing WHERE key = 'max_platform_fee_cents' AND effective_until IS NULL), 10000)
      )
    );
  ELSE
    v_platform_fee := p_platform_fee_cents;
  END IF;

  SELECT * INTO v_promo FROM promotions WHERE UPPER(code) = UPPER(p_promo_code);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'INVALID_CODE', 'user_message', 'This promo code is not valid.');
  END IF;

  IF NOT v_promo.active THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'PROMO_INACTIVE', 'user_message', 'This promotion is no longer active.');
  END IF;

  IF v_promo.redemption_paused THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'PROMO_PAUSED', 'user_message', COALESCE(v_promo.pause_reason, 'This promotion is temporarily unavailable.'));
  END IF;

  IF v_promo.start_date > now() THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'NOT_STARTED', 'user_message', 'This promotion has not started yet.');
  END IF;

  IF v_promo.end_date IS NOT NULL AND v_promo.end_date < now() THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'EXPIRED', 'user_message', 'This promotion has expired.');
  END IF;

  IF v_promo.max_redemptions IS NOT NULL AND v_promo.current_redemptions >= v_promo.max_redemptions THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'MAX_REDEMPTIONS', 'user_message', 'This promotion has reached its maximum redemptions.');
  END IF;

  SELECT COUNT(*) INTO v_user_redemptions FROM promotion_redemptions WHERE promotion_id = v_promo.id AND user_id = p_user_id;

  IF v_promo.max_redemptions_per_user IS NOT NULL AND v_user_redemptions >= v_promo.max_redemptions_per_user THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'USER_LIMIT', 'user_message', 'You have already used this promotion the maximum number of times.');
  END IF;

  IF v_promo.max_total_discount_cents IS NOT NULL AND v_promo.current_total_discount_cents >= v_promo.max_total_discount_cents THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'BUDGET_EXHAUSTED', 'user_message', 'This promotion has reached its budget limit.');
  END IF;

  IF v_promo.minimum_amount_cents IS NOT NULL AND p_quote_amount_cents < v_promo.minimum_amount_cents THEN
    RETURN jsonb_build_object('valid', false, 'error_code', 'MINIMUM_NOT_MET', 'user_message', format('Minimum order of $%s required.', (v_promo.minimum_amount_cents / 100.0)::text));
  END IF;

  CASE COALESCE(v_promo.applies_to, 'platform_fee')
    WHEN 'platform_fee' THEN v_eligible_amount := v_platform_fee;
    WHEN 'quote_amount' THEN v_eligible_amount := p_quote_amount_cents;
    WHEN 'both' THEN v_eligible_amount := p_quote_amount_cents + v_platform_fee;
    ELSE v_eligible_amount := v_platform_fee;
  END CASE;

  CASE v_promo.type
    WHEN 'percent_discount' THEN v_discount_cents := FLOOR(v_eligible_amount * v_promo.percent_off / 100)::int;
    WHEN 'fixed_discount' THEN v_discount_cents := LEAST(v_promo.amount_cents, v_eligible_amount);
    WHEN 'waive_platform_fee' THEN v_discount_cents := v_platform_fee;
    ELSE v_discount_cents := 0;
  END CASE;

  IF v_promo.max_discount_cents IS NOT NULL THEN
    v_discount_cents := LEAST(v_discount_cents, v_promo.max_discount_cents);
  END IF;

  IF v_promo.max_total_discount_cents IS NOT NULL THEN
    v_discount_cents := LEAST(v_discount_cents, v_promo.max_total_discount_cents - COALESCE(v_promo.current_total_discount_cents, 0));
  END IF;

  v_discount_cents := GREATEST(v_discount_cents, 0);

  RETURN jsonb_build_object(
    'valid', true,
    'promo_id', v_promo.id,
    'promo_code', v_promo.code,
    'promo_type', v_promo.type,
    'applies_to', COALESCE(v_promo.applies_to, 'platform_fee'),
    'discount_cents', v_discount_cents,
    'quote_amount_cents', p_quote_amount_cents,
    'platform_fee_cents', v_platform_fee,
    'terms_text', v_promo.terms_text,
    'user_message', format('You save $%s!', (v_discount_cents / 100.0)::text)
  );
END;
$func$;
