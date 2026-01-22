-- =====================================================
-- QUICK FIX: Run this in Supabase SQL Editor
-- Fixes payment flow for accepted quotes without contracts
-- =====================================================

-- Fix the accept_quote_and_create_contract function to handle
-- already-accepted quotes (inconsistent state recovery)
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
  v_existing_contract_id uuid;
  v_progress_id uuid;
  v_platform_fee_cents int := 1500;  -- $15
  v_commission_cents int;
  v_total_customer_cents int;
  v_mechanic_payout_cents int;
  v_line_item_id uuid;
BEGIN
  -- Get quote with lock
  SELECT q.*, j.customer_id as job_customer_id, j.status as job_status
  INTO v_quote
  FROM public.quotes q
  JOIN public.jobs j ON j.id = q.job_id
  WHERE q.id = p_quote_id
  FOR UPDATE OF q, j;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  -- Validate customer owns the job
  IF v_quote.job_customer_id != p_customer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  -- Check if contract already exists for this job
  SELECT id INTO v_existing_contract_id 
  FROM public.job_contracts 
  WHERE job_id = v_quote.job_id;
  
  IF v_existing_contract_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'contract_id', v_existing_contract_id, 'message', 'Contract already exists');
  END IF;
  
  -- Allow both 'pending' and 'accepted' quotes (accepted without contract = inconsistent state, recover it)
  IF v_quote.status NOT IN ('pending', 'accepted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote is no longer available');
  END IF;
  
  -- Validate job is in correct state (allow accepted too for recovery)
  IF v_quote.job_status NOT IN ('searching', 'quoted', 'accepted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job is no longer accepting quotes');
  END IF;
  
  -- Calculate fees
  v_commission_cents := calculate_mechanic_commission(v_quote.price_cents);
  v_total_customer_cents := v_quote.price_cents + v_platform_fee_cents;
  v_mechanic_payout_cents := v_quote.price_cents - v_commission_cents;
  
  -- Create contract
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
  
  -- Create initial line item for base labor
  INSERT INTO public.invoice_line_items (
    contract_id, item_type, description, quantity, unit_price_cents, total_cents,
    approval_status, requires_approval, added_by, added_by_role, sort_order
  ) VALUES (
    v_contract_id, 'base_labor', 'Service as quoted', 1, v_quote.price_cents, v_quote.price_cents,
    'approved', false, v_quote.mechanic_id, 'mechanic', 0
  )
  RETURNING id INTO v_line_item_id;
  
  -- Create platform fee line item
  INSERT INTO public.invoice_line_items (
    contract_id, item_type, description, quantity, unit_price_cents, total_cents,
    approval_status, requires_approval, added_by, added_by_role, sort_order
  ) VALUES (
    v_contract_id, 'platform_fee', 'WrenchGo platform fee', 1, v_platform_fee_cents, v_platform_fee_cents,
    'approved', false, p_customer_id, 'customer', 100
  );
  
  -- Create job progress record
  INSERT INTO public.job_progress (job_id, contract_id)
  VALUES (v_quote.job_id, v_contract_id)
  RETURNING id INTO v_progress_id;
  
  -- Update quote status (if not already accepted)
  UPDATE public.quotes
  SET status = 'accepted', updated_at = now()
  WHERE id = p_quote_id AND status != 'accepted';
  
  -- Reject all other quotes for this job
  UPDATE public.quotes
  SET status = 'rejected', updated_at = now()
  WHERE job_id = v_quote.job_id AND id != p_quote_id AND status = 'pending';
  
  -- Update job status
  UPDATE public.jobs
  SET 
    status = 'accepted',
    accepted_mechanic_id = v_quote.mechanic_id,
    updated_at = now()
  WHERE id = v_quote.job_id;
  
  -- Log event (may fail silently if function doesn't exist)
  BEGIN
    PERFORM log_job_event(
      v_quote.job_id, v_contract_id, 'contract_created',
      p_customer_id, 'customer',
      'Contract created',
      'Quote accepted and contract created',
      jsonb_build_object(
        'quote_id', p_quote_id,
        'quoted_price_cents', v_quote.price_cents,
        'platform_fee_cents', v_platform_fee_cents,
        'total_customer_cents', v_total_customer_cents
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore logging errors
    NULL;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract_id,
    'progress_id', v_progress_id,
    'total_customer_cents', v_total_customer_cents
  );
END;
$$;
