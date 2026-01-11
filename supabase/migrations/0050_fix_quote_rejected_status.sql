-- Fix: Change 'rejected' to 'declined' in accept_quote_and_create_contract
-- The quotes table CHECK constraint only allows: pending, accepted, declined, expired, withdrawn

BEGIN;

CREATE OR REPLACE FUNCTION accept_quote_and_create_contract(
  p_quote_id uuid,
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_job RECORD;
  v_contract_id uuid;
  v_progress_id uuid;
  v_platform_fee_cents int := 1500;
  v_commission_cents int;
  v_total_customer_cents int;
  v_mechanic_payout_cents int;
  v_line_item_id uuid;
BEGIN
  SELECT q.*, j.customer_id as job_customer_id, j.status as job_status
  INTO v_quote
  FROM public.quotes q
  JOIN public.jobs j ON j.id = q.job_id
  WHERE q.id = p_quote_id
  FOR UPDATE OF q, j;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  IF v_quote.job_customer_id != p_customer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  IF v_quote.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote is no longer available');
  END IF;
  
  IF v_quote.job_status NOT IN ('searching', 'quoted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job is no longer accepting quotes');
  END IF;
  
  v_commission_cents := calculate_mechanic_commission(v_quote.price_cents);
  v_total_customer_cents := v_quote.price_cents + v_platform_fee_cents;
  v_mechanic_payout_cents := v_quote.price_cents - v_commission_cents;
  
  INSERT INTO public.job_contracts (
    job_id, quote_id, customer_id, mechanic_id,
    status, quoted_price_cents, platform_fee_cents, estimated_hours,
    subtotal_cents, total_customer_cents, mechanic_commission_cents, mechanic_payout_cents
  ) VALUES (
    v_quote.job_id, p_quote_id, p_customer_id, v_quote.mechanic_id,
    'active', v_quote.price_cents, v_platform_fee_cents, v_quote.estimated_hours,
    v_quote.price_cents, v_total_customer_cents, v_commission_cents, v_mechanic_payout_cents
  )
  RETURNING id INTO v_contract_id;
  
  INSERT INTO public.invoice_line_items (
    contract_id, item_type, description, quantity, unit_price_cents, total_cents,
    approval_status, requires_approval, added_by, added_by_role, sort_order
  ) VALUES (
    v_contract_id, 'base_labor', 'Service as quoted', 1, v_quote.price_cents, v_quote.price_cents,
    'approved', false, v_quote.mechanic_id, 'mechanic', 0
  )
  RETURNING id INTO v_line_item_id;
  
  INSERT INTO public.invoice_line_items (
    contract_id, item_type, description, quantity, unit_price_cents, total_cents,
    approval_status, requires_approval, added_by, added_by_role, sort_order
  ) VALUES (
    v_contract_id, 'platform_fee', 'WrenchGo platform fee', 1, v_platform_fee_cents, v_platform_fee_cents,
    'approved', false, p_customer_id, 'customer', 100
  );
  
  INSERT INTO public.job_progress (job_id, contract_id)
  VALUES (v_quote.job_id, v_contract_id)
  RETURNING id INTO v_progress_id;
  
  UPDATE public.quotes
  SET status = 'accepted', updated_at = now()
  WHERE id = p_quote_id;
  
  -- Use 'declined' instead of 'rejected' to match CHECK constraint
  UPDATE public.quotes
  SET status = 'declined', updated_at = now()
  WHERE job_id = v_quote.job_id AND id != p_quote_id AND status = 'pending';
  
  UPDATE public.jobs
  SET 
    status = 'accepted',
    accepted_mechanic_id = v_quote.mechanic_id,
    updated_at = now()
  WHERE id = v_quote.job_id;
  
  PERFORM log_job_event(
    v_quote.job_id, v_contract_id, 'contract_created',
    p_customer_id, 'customer',
    'Contract created',
    'Quote accepted and contract created',
    jsonb_build_object(
      'quoted_price_cents', v_quote.price_cents,
      'platform_fee_cents', v_platform_fee_cents,
      'total_cents', v_total_customer_cents
    ),
    v_total_customer_cents
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract_id,
    'total_cents', v_total_customer_cents,
    'mechanic_id', v_quote.mechanic_id
  );
END;
$$;

COMMIT;