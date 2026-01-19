-- =====================================================
-- MIGRATION: Fix Commission Calculation
-- =====================================================
-- Problem: Commission was being calculated from subtotal (labor + parts)
--          instead of labor only. This caused incorrect commission amounts.
-- 
-- Fix: Commission = 12% of LABOR ONLY (capped at $50)
-- 
-- Example:
--   Labor: $130, Parts: $300, Gross: $430
--   WRONG: Commission = 12% of $430 = $51.60 (capped to $50)
--   RIGHT: Commission = 12% of $130 = $15.60
-- =====================================================

BEGIN;

-- =====================================================
-- HELPER: Calculate labor total from line items
-- =====================================================
CREATE OR REPLACE FUNCTION get_labor_total_cents(p_contract_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_labor_cents int;
BEGIN
  SELECT COALESCE(SUM(total_cents), 0)
  INTO v_labor_cents
  FROM public.invoice_line_items
  WHERE contract_id = p_contract_id
    AND approval_status = 'approved'
    AND item_type IN ('base_labor', 'additional_labor');
  
  RETURN v_labor_cents;
END;
$$;

-- =====================================================
-- FIX: Update calculate_mechanic_commission to be clearer
-- (The function itself is correct - 12% capped at $50)
-- The bug was in HOW it was called (with subtotal instead of labor)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_mechanic_commission(price_cents int)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- 12% of LABOR ONLY, capped at $50 (5000 cents)
  -- NEVER pass subtotal or gross to this function!
  RETURN LEAST(ROUND(price_cents * 0.12)::int, 5000);
END;
$$;

COMMENT ON FUNCTION calculate_mechanic_commission(int) IS 
  'Calculate 12% commission on LABOR ONLY (not parts/gross). Capped at $50.';

-- =====================================================
-- FIX: Update recalculate_contract_totals to use labor only
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_contract_totals(p_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_labor_cents int;
  v_subtotal_cents int;
  v_platform_fee_cents int;
  v_commission_cents int;
  v_total_customer_cents int;
  v_mechanic_payout_cents int;
BEGIN
  -- Get labor total (base_labor + additional_labor only)
  SELECT COALESCE(SUM(total_cents), 0)
  INTO v_labor_cents
  FROM public.invoice_line_items
  WHERE contract_id = p_contract_id
    AND approval_status = 'approved'
    AND item_type IN ('base_labor', 'additional_labor');

  -- Get subtotal (all approved items except platform_fee)
  SELECT COALESCE(SUM(total_cents), 0)
  INTO v_subtotal_cents
  FROM public.invoice_line_items
  WHERE contract_id = p_contract_id
    AND approval_status = 'approved'
    AND item_type != 'platform_fee';

  -- Get platform fee
  SELECT platform_fee_cents INTO v_platform_fee_cents
  FROM public.job_contracts
  WHERE id = p_contract_id;

  -- Calculate commission from LABOR ONLY
  v_commission_cents := calculate_mechanic_commission(v_labor_cents);
  
  -- Calculate totals
  v_total_customer_cents := v_subtotal_cents + v_platform_fee_cents;
  v_mechanic_payout_cents := v_subtotal_cents - v_commission_cents;

  -- Update contract
  UPDATE public.job_contracts
  SET 
    subtotal_cents = v_subtotal_cents,
    total_customer_cents = v_total_customer_cents,
    mechanic_commission_cents = v_commission_cents,
    mechanic_payout_cents = v_mechanic_payout_cents,
    updated_at = now()
  WHERE id = p_contract_id;
END;
$$;

-- =====================================================
-- FIX: Update approve_line_item to use new recalculation
-- =====================================================
CREATE OR REPLACE FUNCTION approve_line_item(
  p_line_item_id uuid,
  p_customer_id uuid,
  p_approved boolean,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Get line item with contract info
  SELECT 
    li.*,
    c.customer_id,
    c.job_id,
    c.platform_fee_cents
  INTO v_item
  FROM public.invoice_line_items li
  JOIN public.job_contracts c ON c.id = li.contract_id
  WHERE li.id = p_line_item_id
  FOR UPDATE OF li;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Line item not found');
  END IF;
  
  IF v_item.customer_id != p_customer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  IF v_item.approval_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item already processed');
  END IF;
  
  IF p_approved THEN
    UPDATE public.invoice_line_items
    SET 
      approval_status = 'approved',
      approved_at = now(),
      approved_by = p_customer_id,
      updated_at = now()
    WHERE id = p_line_item_id;
    
    -- Recalculate contract totals (now uses labor only for commission)
    PERFORM recalculate_contract_totals(v_item.contract_id);
    
    -- Log event
    PERFORM log_job_event(
      v_item.job_id, v_item.contract_id, 'line_item_approved',
      p_customer_id, 'customer',
      'Additional item approved',
      v_item.description,
      jsonb_build_object('line_item_id', p_line_item_id, 'amount_cents', v_item.total_cents),
      v_item.total_cents
    );
  ELSE
    UPDATE public.invoice_line_items
    SET 
      approval_status = 'rejected',
      rejected_at = now(),
      rejected_by = p_customer_id,
      rejection_reason = p_rejection_reason,
      updated_at = now()
    WHERE id = p_line_item_id;
    
    -- Log event
    PERFORM log_job_event(
      v_item.job_id, v_item.contract_id, 'line_item_rejected',
      p_customer_id, 'customer',
      'Additional item rejected',
      v_item.description || COALESCE(' - Reason: ' || p_rejection_reason, ''),
      jsonb_build_object('line_item_id', p_line_item_id, 'reason', p_rejection_reason)
    );
  END IF;
  
  RETURN jsonb_build_object('success', true, 'approved', p_approved);
END;
$$;

-- =====================================================
-- RECOMPUTE: Fix all existing contracts with wrong commission
-- =====================================================
CREATE OR REPLACE FUNCTION recompute_all_commissions()
RETURNS TABLE(
  contract_id uuid,
  old_commission int,
  new_commission int,
  labor_cents int,
  fixed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
  v_labor_cents int;
  v_correct_commission int;
BEGIN
  FOR v_contract IN 
    SELECT c.id, c.mechanic_commission_cents, c.subtotal_cents
    FROM public.job_contracts c
    WHERE c.status IN ('active', 'completed')
  LOOP
    -- Get labor total
    SELECT COALESCE(SUM(total_cents), 0)
    INTO v_labor_cents
    FROM public.invoice_line_items
    WHERE invoice_line_items.contract_id = v_contract.id
      AND approval_status = 'approved'
      AND item_type IN ('base_labor', 'additional_labor');
    
    -- Calculate correct commission
    v_correct_commission := calculate_mechanic_commission(v_labor_cents);
    
    -- Check if needs fixing
    IF v_contract.mechanic_commission_cents != v_correct_commission THEN
      -- Fix the contract
      PERFORM recalculate_contract_totals(v_contract.id);
      
      -- Fix the payout if exists
      UPDATE public.payouts
      SET 
        commission_cents = v_correct_commission,
        net_amount_cents = gross_amount_cents - v_correct_commission,
        updated_at = now()
      WHERE payouts.contract_id = v_contract.id;
      
      contract_id := v_contract.id;
      old_commission := v_contract.mechanic_commission_cents;
      new_commission := v_correct_commission;
      labor_cents := v_labor_cents;
      fixed := true;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- Run the recomputation
DO $$
DECLARE
  v_fixed_count int;
BEGIN
  SELECT COUNT(*) INTO v_fixed_count
  FROM recompute_all_commissions();
  
  RAISE NOTICE 'Fixed % contracts with incorrect commission', v_fixed_count;
END;
$$;

-- =====================================================
-- VALIDATION: Check that all commissions are now correct
-- =====================================================
CREATE OR REPLACE FUNCTION validate_commissions()
RETURNS TABLE(
  contract_id uuid,
  labor_cents int,
  stored_commission int,
  expected_commission int,
  is_valid boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_contract RECORD;
  v_labor_cents int;
  v_expected int;
BEGIN
  FOR v_contract IN 
    SELECT c.id, c.mechanic_commission_cents
    FROM public.job_contracts c
    WHERE c.status IN ('active', 'completed')
  LOOP
    SELECT COALESCE(SUM(total_cents), 0)
    INTO v_labor_cents
    FROM public.invoice_line_items
    WHERE invoice_line_items.contract_id = v_contract.id
      AND approval_status = 'approved'
      AND item_type IN ('base_labor', 'additional_labor');
    
    v_expected := calculate_mechanic_commission(v_labor_cents);
    
    contract_id := v_contract.id;
    labor_cents := v_labor_cents;
    stored_commission := v_contract.mechanic_commission_cents;
    expected_commission := v_expected;
    is_valid := (v_contract.mechanic_commission_cents = v_expected);
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMIT;


