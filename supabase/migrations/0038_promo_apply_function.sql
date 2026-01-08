-- Atomic promo application function
CREATE OR REPLACE FUNCTION public.apply_promo_atomic(
  p_user_id uuid,
  p_promo_id uuid,
  p_payment_id uuid,
  p_discount_cents int,
  p_quote_amount_cents int,
  p_platform_fee_cents int,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_promo record;
  v_existing_redemption uuid;
  v_redemption_id uuid;
BEGIN
  SELECT id INTO v_existing_redemption FROM promotion_redemptions WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'redemption_id', v_existing_redemption, 'idempotent', true);
  END IF;

  SELECT * INTO v_promo FROM promotions WHERE id = p_promo_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROMO_NOT_FOUND');
  END IF;

  IF NOT v_promo.active THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROMO_INACTIVE');
  END IF;

  IF v_promo.redemption_paused THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROMO_PAUSED');
  END IF;

  IF v_promo.max_redemptions IS NOT NULL AND v_promo.current_redemptions >= v_promo.max_redemptions THEN
    RETURN jsonb_build_object('success', false, 'error', 'MAX_REDEMPTIONS');
  END IF;

  IF v_promo.max_total_discount_cents IS NOT NULL AND (COALESCE(v_promo.current_total_discount_cents, 0) + p_discount_cents) > v_promo.max_total_discount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'BUDGET_EXCEEDED');
  END IF;

  INSERT INTO promotion_redemptions (promotion_id, user_id, payment_id, discount_cents, quote_amount_cents, platform_fee_cents, discount_type, idempotency_key)
  VALUES (p_promo_id, p_user_id, p_payment_id, p_discount_cents, p_quote_amount_cents, p_platform_fee_cents, v_promo.type, p_idempotency_key)
  RETURNING id INTO v_redemption_id;

  UPDATE promotions SET current_redemptions = current_redemptions + 1, current_total_discount_cents = COALESCE(current_total_discount_cents, 0) + p_discount_cents, updated_at = now() WHERE id = p_promo_id;

  RETURN jsonb_build_object('success', true, 'redemption_id', v_redemption_id, 'discount_applied_cents', p_discount_cents);
END;
$func$;
