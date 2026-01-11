-- =====================================================
-- MIGRATION: Use payment_promo_applications table
-- =====================================================
-- Updates apply_promo_credit_to_job to also insert into payment_promo_applications

BEGIN;

-- Update the apply function to work with payment_promo_applications
CREATE OR REPLACE FUNCTION public.apply_promo_to_payment(
  p_payment_id uuid,
  p_platform_fee_cents int DEFAULT 1500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_payment record;
  v_credit_id uuid;
  v_credit_type text;
  v_discount_cents int;
  v_fee_after_cents int;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get payment and verify ownership
  SELECT p.id, p.job_id, j.customer_id
  INTO v_payment
  FROM payments p
  JOIN jobs j ON j.id = p.job_id
  WHERE p.id = p_payment_id;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;
  
  IF v_payment.customer_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  -- Check if promo already applied to this payment
  IF EXISTS (SELECT 1 FROM payment_promo_applications WHERE payment_id = p_payment_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo already applied to this payment');
  END IF;
  
  -- Find the oldest available promo credit (FIFO)
  SELECT id, credit_type::text
  INTO v_credit_id, v_credit_type
  FROM promo_credits
  WHERE user_id = v_user_id
    AND remaining_uses > 0
  ORDER BY 
    CASE WHEN credit_type = 'FEELESS' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;
  
  IF v_credit_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'has_credit', false,
      'message', 'No promo credits available'
    );
  END IF;
  
  -- Calculate discount
  v_discount_cents := CASE 
    WHEN v_credit_type = 'FEELESS' THEN p_platform_fee_cents
    WHEN v_credit_type = 'FEELESS3' THEN LEAST(300, p_platform_fee_cents)
    ELSE 0
  END;
  v_fee_after_cents := GREATEST(0, p_platform_fee_cents - v_discount_cents);
  
  -- Decrement the credit
  UPDATE promo_credits
  SET remaining_uses = remaining_uses - 1,
      updated_at = now()
  WHERE id = v_credit_id;
  
  -- Insert into payment_promo_applications
  INSERT INTO payment_promo_applications (
    payment_id, promo_credit_id, credit_type, 
    fee_before_cents, discount_cents, fee_after_cents
  )
  VALUES (
    p_payment_id, v_credit_id, v_credit_type::promo_credit_type,
    p_platform_fee_cents, v_discount_cents, v_fee_after_cents
  );
  
  -- Also update the job for easy access
  UPDATE jobs
  SET applied_promo_credit_id = v_credit_id,
      promo_discount_cents = v_discount_cents,
      promo_credit_type = v_credit_type,
      updated_at = now()
  WHERE id = v_payment.job_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'has_credit', true,
    'credit_id', v_credit_id,
    'credit_type', v_credit_type,
    'discount_cents', v_discount_cents,
    'fee_after_cents', v_fee_after_cents,
    'message', CASE 
      WHEN v_credit_type = 'FEELESS' THEN 'Platform fee waived!'
      ELSE '$3 discount applied!'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_promo_to_payment(uuid, int) TO authenticated;

-- Function to get promo info from payment_promo_applications
CREATE OR REPLACE FUNCTION public.get_payment_promo_info(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo record;
BEGIN
  SELECT ppa.*, pc.user_id as credit_owner_id
  INTO v_promo
  FROM payment_promo_applications ppa
  LEFT JOIN promo_credits pc ON pc.id = ppa.promo_credit_id
  WHERE ppa.payment_id = p_payment_id;
  
  IF v_promo IS NULL THEN
    RETURN jsonb_build_object(
      'has_promo', false,
      'discount_cents', 0
    );
  END IF;
  
  RETURN jsonb_build_object(
    'has_promo', true,
    'credit_type', v_promo.credit_type,
    'fee_before_cents', v_promo.fee_before_cents,
    'discount_cents', v_promo.discount_cents,
    'fee_after_cents', v_promo.fee_after_cents,
    'discount_description', CASE 
      WHEN v_promo.credit_type = 'FEELESS' THEN 'Platform fee waived (referral credit)'
      ELSE '$3 off platform fee (referral credit)'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_promo_info(uuid) TO authenticated;

COMMIT;
