-- Fix submit_quote_with_payment_check to upsert instead of insert

CREATE OR REPLACE FUNCTION public.submit_quote_with_payment_check(
  p_job_id uuid,
  p_price_cents int,
  p_estimated_hours numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_id uuid;
  v_has_payout boolean;
  v_quote_id uuid;
BEGIN
  v_mechanic_id := auth.uid();
  
  IF v_mechanic_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHENTICATED');
  END IF;

  -- Check if mechanic has payout setup (check both tables)
  SELECT EXISTS (
    SELECT 1 FROM mechanic_stripe_accounts 
    WHERE mechanic_id = v_mechanic_id AND stripe_account_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM mechanic_profiles 
    WHERE id = v_mechanic_id AND stripe_account_id IS NOT NULL
  ) INTO v_has_payout;

  IF NOT v_has_payout THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PAYOUT_NOT_SETUP',
      'message', 'Please set up your payout account before submitting quotes'
    );
  END IF;

  INSERT INTO quotes (job_id, mechanic_id, price_cents, estimated_hours, notes, status)
  VALUES (p_job_id, v_mechanic_id, p_price_cents, p_estimated_hours, p_notes, 'pending')
  ON CONFLICT (job_id, mechanic_id) DO UPDATE SET
    price_cents = EXCLUDED.price_cents,
    estimated_hours = EXCLUDED.estimated_hours,
    notes = EXCLUDED.notes,
    status = 'pending',
    updated_at = now()
  RETURNING id INTO v_quote_id;

  RETURN jsonb_build_object('success', true, 'quote_id', v_quote_id);
END;
$$;
