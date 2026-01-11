-- =====================================================
-- MIGRATION: Retroactively apply promo credits to existing jobs
-- =====================================================
-- Creates a function to apply promo credit to an existing job/payment

BEGIN;

-- Function to retroactively apply promo to an existing job
CREATE OR REPLACE FUNCTION public.retroactive_apply_promo(
  p_job_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_job record;
  v_payment record;
  v_credit_id uuid;
  v_credit_type text;
  v_discount_cents int;
  v_fee_after_cents int;
  v_platform_fee_cents int := 1500;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get job and verify ownership
  SELECT id, customer_id, applied_promo_credit_id
  INTO v_job
  FROM jobs
  WHERE id = p_job_id;
  
  IF v_job IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;
  
  IF v_job.customer_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  -- Check if promo already applied
  IF v_job.applied_promo_credit_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo already applied to this job');
  END IF;
  
  -- Get payment for this job
  SELECT id INTO v_payment FROM payments WHERE job_id = p_job_id LIMIT 1;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No payment found for this job');
  END IF;
  
  -- Check if promo already applied to payment
  IF EXISTS (SELECT 1 FROM payment_promo_applications WHERE payment_id = v_payment.id) THEN
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
    WHEN v_credit_type = 'FEELESS' THEN v_platform_fee_cents
    WHEN v_credit_type = 'FEELESS3' THEN LEAST(300, v_platform_fee_cents)
    ELSE 0
  END;
  v_fee_after_cents := GREATEST(0, v_platform_fee_cents - v_discount_cents);
  
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
    v_payment.id, v_credit_id, v_credit_type::promo_credit_type,
    v_platform_fee_cents, v_discount_cents, v_fee_after_cents
  );
  
  -- Update the job
  UPDATE jobs
  SET applied_promo_credit_id = v_credit_id,
      promo_discount_cents = v_discount_cents,
      promo_credit_type = v_credit_type,
      updated_at = now()
  WHERE id = p_job_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'has_credit', true,
    'credit_type', v_credit_type,
    'discount_cents', v_discount_cents,
    'fee_after_cents', v_fee_after_cents
  );
END;
$$;

COMMIT;
