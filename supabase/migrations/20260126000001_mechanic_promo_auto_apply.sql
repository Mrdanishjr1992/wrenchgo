-- =====================================================
-- MIGRATION: Mechanic Promo Credit Auto-Apply
-- =====================================================
-- Fixes: Mechanic promo credits were not being auto-applied.
-- Customer credits work via apply_promo_to_payment, but mechanics
-- had no equivalent function called during contract creation.
--
-- This migration:
-- 1. Adds job_event_type enum value
-- 2. Creates mechanic_promo_applications table (parallel to payment_promo_applications)
-- 3. Adds tracking columns to job_contracts
-- 4. Creates apply_mechanic_promo_to_contract function
-- 5. Creates preview_mechanic_promo_discount function
-- 6. Updates accept_quote_and_create_contract to auto-apply mechanic promo
-- =====================================================

-- Add enum value BEFORE transaction (required for some PG versions)
DO $$
BEGIN
  ALTER TYPE public.job_event_type ADD VALUE IF NOT EXISTS 'mechanic_promo_applied';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

BEGIN;

-- =====================================================
-- TABLE: mechanic_promo_applications
-- =====================================================
-- Tracks mechanic promo credit applications per contract
-- contract_id is UNIQUE to prevent double-application
CREATE TABLE IF NOT EXISTS public.mechanic_promo_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES public.job_contracts(id) ON DELETE CASCADE,
  promo_credit_id uuid NOT NULL REFERENCES public.promo_credits(id) ON DELETE RESTRICT,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_type text NOT NULL,
  commission_before_cents int NOT NULL,
  discount_cents int NOT NULL,
  commission_after_cents int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mechanic_promo_applications_mechanic 
  ON public.mechanic_promo_applications(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_promo_applications_credit 
  ON public.mechanic_promo_applications(promo_credit_id);

COMMENT ON TABLE public.mechanic_promo_applications IS 'Tracks promo credits applied to mechanic commissions';
COMMENT ON COLUMN public.mechanic_promo_applications.contract_id IS 'The contract this promo was applied to (UNIQUE)';
COMMENT ON COLUMN public.mechanic_promo_applications.commission_before_cents IS 'Commission before discount';
COMMENT ON COLUMN public.mechanic_promo_applications.discount_cents IS 'Amount reduced from commission';
COMMENT ON COLUMN public.mechanic_promo_applications.commission_after_cents IS 'Commission after discount';

-- RLS for mechanic_promo_applications
ALTER TABLE public.mechanic_promo_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mechanics can view their own promo applications"
  ON public.mechanic_promo_applications FOR SELECT
  USING (mechanic_id = auth.uid());

CREATE POLICY "Service role full access to mechanic_promo_applications"
  ON public.mechanic_promo_applications FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- ALTER TABLE: job_contracts - add mechanic promo tracking
-- =====================================================
ALTER TABLE public.job_contracts
ADD COLUMN IF NOT EXISTS applied_mechanic_promo_credit_id uuid REFERENCES public.promo_credits(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS mechanic_promo_discount_cents int DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_mechanic_commission_cents int;

COMMENT ON COLUMN public.job_contracts.applied_mechanic_promo_credit_id IS 'Mechanic promo credit applied to this contract';
COMMENT ON COLUMN public.job_contracts.mechanic_promo_discount_cents IS 'Amount of commission discount for mechanic';
COMMENT ON COLUMN public.job_contracts.original_mechanic_commission_cents IS 'Original commission before mechanic promo discount';

CREATE INDEX IF NOT EXISTS idx_job_contracts_mechanic_promo 
  ON public.job_contracts(applied_mechanic_promo_credit_id) 
  WHERE applied_mechanic_promo_credit_id IS NOT NULL;

-- =====================================================
-- FUNCTION: preview_mechanic_promo_discount
-- =====================================================
-- Preview what discount a mechanic would get on their commission
CREATE OR REPLACE FUNCTION public.preview_mechanic_promo_discount(
  p_mechanic_id uuid DEFAULT NULL,
  p_commission_cents int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_credit RECORD;
  v_discount_cents int;
  v_actual_commission int;
BEGIN
  v_user_id := COALESCE(p_mechanic_id, auth.uid());
  v_actual_commission := COALESCE(p_commission_cents, 0);
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_discount', false,
      'reason', 'not_authenticated'
    );
  END IF;
  
  -- Find best available credit for this mechanic
  SELECT id, credit_type, remaining_uses
  INTO v_credit
  FROM public.promo_credits
  WHERE user_id = v_user_id
    AND remaining_uses > 0
    AND paused = false
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY 
    CASE credit_type 
      WHEN 'FEELESS' THEN 1  -- Prefer FEELESS (full waiver)
      WHEN 'FEELESS3' THEN 2 
      ELSE 3 
    END,
    created_at ASC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_discount', false,
      'reason', 'no_eligible_credit'
    );
  END IF;
  
  -- Calculate discount based on credit type
  v_discount_cents := CASE v_credit.credit_type
    WHEN 'FEELESS' THEN v_actual_commission  -- Full commission waiver
    WHEN 'FEELESS3' THEN LEAST(300, v_actual_commission)  -- $3 off or full if less
    ELSE 0
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'has_discount', true,
    'credit_id', v_credit.id,
    'credit_type', v_credit.credit_type,
    'remaining_uses', v_credit.remaining_uses,
    'discount_cents', v_discount_cents,
    'commission_after_cents', GREATEST(0, v_actual_commission - v_discount_cents)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_mechanic_promo_discount(uuid, int) TO authenticated;

-- =====================================================
-- FUNCTION: apply_mechanic_promo_to_contract
-- =====================================================
-- Applies mechanic's best available promo credit to a contract
-- Called during contract creation to reduce mechanic commission
-- Idempotent: UNIQUE constraint on contract_id prevents double-application
CREATE OR REPLACE FUNCTION public.apply_mechanic_promo_to_contract(
  p_contract_id uuid,
  p_mechanic_id uuid,
  p_commission_cents int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit RECORD;
  v_discount_cents int;
  v_commission_after int;
  v_contract RECORD;
  v_existing RECORD;
BEGIN
  -- Check if already applied (idempotency)
  SELECT * INTO v_existing 
  FROM public.mechanic_promo_applications 
  WHERE contract_id = p_contract_id;
  
  IF FOUND THEN
    RAISE LOG '[MECHANIC_PROMO] Already applied to contract %, returning existing application', p_contract_id;
    RETURN jsonb_build_object(
      'success', true,
      'has_credit', true,
      'already_applied', true,
      'credit_type', v_existing.credit_type,
      'discount_cents', v_existing.discount_cents,
      'commission_after_cents', v_existing.commission_after_cents
    );
  END IF;
  
  -- Verify contract exists and belongs to mechanic
  SELECT * INTO v_contract
  FROM public.job_contracts
  WHERE id = p_contract_id AND mechanic_id = p_mechanic_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE LOG '[MECHANIC_PROMO] Contract % not found or not owned by mechanic %', p_contract_id, p_mechanic_id;
    RETURN jsonb_build_object(
      'success', false,
      'has_credit', false,
      'error', 'Contract not found or not authorized'
    );
  END IF;
  
  -- Find and lock best available credit for this mechanic
  SELECT id, credit_type, remaining_uses
  INTO v_credit
  FROM public.promo_credits
  WHERE user_id = p_mechanic_id
    AND remaining_uses > 0
    AND paused = false
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY 
    CASE credit_type 
      WHEN 'FEELESS' THEN 1
      WHEN 'FEELESS3' THEN 2 
      ELSE 3 
    END,
    created_at ASC
  LIMIT 1
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE LOG '[MECHANIC_PROMO] No eligible credit for mechanic %', p_mechanic_id;
    RETURN jsonb_build_object(
      'success', true,
      'has_credit', false,
      'reason', 'no_eligible_credit'
    );
  END IF;
  
  -- Calculate discount
  v_discount_cents := CASE v_credit.credit_type
    WHEN 'FEELESS' THEN p_commission_cents
    WHEN 'FEELESS3' THEN LEAST(300, p_commission_cents)
    ELSE 0
  END;
  v_commission_after := GREATEST(0, p_commission_cents - v_discount_cents);
  
  RAISE LOG '[MECHANIC_PROMO] Applying % credit (%) to contract %, discount: % cents', 
    v_credit.credit_type, v_credit.id, p_contract_id, v_discount_cents;
  
  -- Decrement remaining uses
  UPDATE public.promo_credits
  SET remaining_uses = remaining_uses - 1,
      updated_at = now()
  WHERE id = v_credit.id;
  
  -- Record application (UNIQUE constraint ensures idempotency)
  INSERT INTO public.mechanic_promo_applications (
    contract_id, promo_credit_id, mechanic_id, credit_type,
    commission_before_cents, discount_cents, commission_after_cents
  ) VALUES (
    p_contract_id, v_credit.id, p_mechanic_id, v_credit.credit_type,
    p_commission_cents, v_discount_cents, v_commission_after
  );
  
  -- Update contract with promo info
  UPDATE public.job_contracts
  SET applied_mechanic_promo_credit_id = v_credit.id,
      mechanic_promo_discount_cents = v_discount_cents,
      original_mechanic_commission_cents = p_commission_cents,
      mechanic_commission_cents = v_commission_after,
      mechanic_payout_cents = quoted_price_cents - v_commission_after
  WHERE id = p_contract_id;
  
  RAISE LOG '[MECHANIC_PROMO] Successfully applied to contract %, new commission: % cents, new payout: % cents',
    p_contract_id, v_commission_after, (SELECT mechanic_payout_cents FROM public.job_contracts WHERE id = p_contract_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'has_credit', true,
    'credit_id', v_credit.id,
    'credit_type', v_credit.credit_type,
    'discount_cents', v_discount_cents,
    'commission_after_cents', v_commission_after
  );
EXCEPTION WHEN unique_violation THEN
  -- Another transaction already applied - return existing
  SELECT * INTO v_existing 
  FROM public.mechanic_promo_applications 
  WHERE contract_id = p_contract_id;
  
  RAISE LOG '[MECHANIC_PROMO] Concurrent application detected for contract %, returning existing', p_contract_id;
  RETURN jsonb_build_object(
    'success', true,
    'has_credit', true,
    'already_applied', true,
    'credit_type', v_existing.credit_type,
    'discount_cents', v_existing.discount_cents,
    'commission_after_cents', v_existing.commission_after_cents
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_mechanic_promo_to_contract(uuid, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_mechanic_promo_to_contract(uuid, uuid, int) TO service_role;

-- =====================================================
-- FUNCTION: get_contract_mechanic_promo_info
-- =====================================================
-- Returns promo info for a contract (for UI display)
CREATE OR REPLACE FUNCTION public.get_contract_mechanic_promo_info(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
BEGIN
  SELECT mpa.*, jc.mechanic_id
  INTO v_app
  FROM public.mechanic_promo_applications mpa
  JOIN public.job_contracts jc ON jc.id = mpa.contract_id
  WHERE mpa.contract_id = p_contract_id
    AND (jc.mechanic_id = auth.uid() OR jc.customer_id = auth.uid());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_promo', false
    );
  END IF;
  
  RETURN jsonb_build_object(
    'has_promo', true,
    'credit_type', v_app.credit_type,
    'commission_before_cents', v_app.commission_before_cents,
    'discount_cents', v_app.discount_cents,
    'commission_after_cents', v_app.commission_after_cents,
    'discount_description', CASE v_app.credit_type
      WHEN 'FEELESS' THEN 'Free commission (referral credit)'
      WHEN 'FEELESS3' THEN '$3 off commission (referral credit)'
      ELSE 'Promo discount'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contract_mechanic_promo_info(uuid) TO authenticated;

-- =====================================================
-- UPDATED FUNCTION: accept_quote_and_create_contract
-- =====================================================
-- Now auto-applies mechanic promo credit after contract creation
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
  v_terms_check jsonb;
  v_mechanic_promo_result jsonb;
BEGIN
  -- ENFORCEMENT: Check platform terms accepted
  v_terms_check := public.check_terms_accepted('customer');
  IF NOT (v_terms_check->>'accepted')::boolean THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Please accept platform terms first',
      'requires_terms', true,
      'terms_version', v_terms_check->>'version'
    );
  END IF;

  -- Get quote with lock
  SELECT q.*, j.customer_id as job_customer_id, j.status as job_status, j.id as actual_job_id
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
  
  -- ENFORCEMENT: Check job acknowledgement exists
  IF NOT EXISTS (
    SELECT 1 FROM public.job_acknowledgements
    WHERE job_id = v_quote.actual_job_id 
    AND user_id = p_customer_id 
    AND role = 'customer'
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Please acknowledge job terms first',
      'requires_acknowledgement', true,
      'job_id', v_quote.actual_job_id
    );
  END IF;
  
  -- Calculate fees (initial, before mechanic promo)
  v_commission_cents := calculate_mechanic_commission(v_quote.price_cents);
  v_total_customer_cents := v_quote.price_cents + v_platform_fee_cents;
  v_mechanic_payout_cents := v_quote.price_cents - v_commission_cents;
  
  -- Create contract
  INSERT INTO public.job_contracts (
    job_id, quote_id, customer_id, mechanic_id,
    status, quoted_price_cents, platform_fee_cents, estimated_hours,
    subtotal_cents, total_customer_cents, mechanic_commission_cents, mechanic_payout_cents,
    customer_acknowledged_at
  ) VALUES (
    v_quote.job_id, p_quote_id, p_customer_id, v_quote.mechanic_id,
    'active', v_quote.price_cents, v_platform_fee_cents, v_quote.estimated_hours,
    v_quote.price_cents, v_total_customer_cents, v_commission_cents, v_mechanic_payout_cents,
    now()
  )
  RETURNING id INTO v_contract_id;
  
  -- =====================================================
  -- AUTO-APPLY MECHANIC PROMO CREDIT
  -- =====================================================
  -- This is the key fix: apply mechanic's promo credit to reduce their commission
  v_mechanic_promo_result := public.apply_mechanic_promo_to_contract(
    v_contract_id,
    v_quote.mechanic_id,
    v_commission_cents
  );
  
  -- Log mechanic promo application result
  IF (v_mechanic_promo_result->>'has_credit')::boolean THEN
    RAISE LOG '[CONTRACT_CREATE] Mechanic promo applied to contract %: type=%, discount=% cents',
      v_contract_id, 
      v_mechanic_promo_result->>'credit_type',
      v_mechanic_promo_result->>'discount_cents';
    
    -- Log job event for mechanic promo
    PERFORM log_job_event(
      v_quote.job_id, v_contract_id, 'mechanic_promo_applied',
      v_quote.mechanic_id, 'mechanic',
      'Promo credit applied',
      'Mechanic promo credit reduced commission',
      jsonb_build_object(
        'credit_type', v_mechanic_promo_result->>'credit_type',
        'discount_cents', (v_mechanic_promo_result->>'discount_cents')::int,
        'commission_before_cents', v_commission_cents,
        'commission_after_cents', (v_mechanic_promo_result->>'commission_after_cents')::int
      ),
      (v_mechanic_promo_result->>'discount_cents')::int
    );
  ELSE
    RAISE LOG '[CONTRACT_CREATE] No mechanic promo for contract %: reason=%',
      v_contract_id, 
      COALESCE(v_mechanic_promo_result->>'reason', 'unknown');
  END IF;
  
  -- Update job_acknowledgements with contract_id
  UPDATE public.job_acknowledgements
  SET contract_id = v_contract_id
  WHERE job_id = v_quote.job_id AND user_id = p_customer_id AND role = 'customer';
  
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
  
  -- Update quote status
  UPDATE public.quotes
  SET status = 'accepted', updated_at = now()
  WHERE id = p_quote_id;
  
  -- Decline all other quotes for this job
  UPDATE public.quotes
  SET status = 'declined', updated_at = now()
  WHERE job_id = v_quote.job_id AND id != p_quote_id;
  
  -- Update job status
  UPDATE public.jobs
  SET 
    status = 'accepted',
    accepted_mechanic_id = v_quote.mechanic_id,
    updated_at = now()
  WHERE id = v_quote.job_id;
  
  -- Log event
  PERFORM log_job_event(
    v_quote.job_id, v_contract_id, 'contract_created',
    p_customer_id, 'customer',
    'Contract created',
    'Quote accepted and contract created',
    jsonb_build_object(
      'quoted_price_cents', v_quote.price_cents,
      'platform_fee_cents', v_platform_fee_cents,
      'total_cents', v_total_customer_cents,
      'mechanic_promo_applied', (v_mechanic_promo_result->>'has_credit')::boolean,
      'mechanic_promo_discount_cents', COALESCE((v_mechanic_promo_result->>'discount_cents')::int, 0)
    ),
    v_total_customer_cents
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract_id,
    'total_cents', v_total_customer_cents,
    'mechanic_id', v_quote.mechanic_id,
    'mechanic_promo_applied', (v_mechanic_promo_result->>'has_credit')::boolean,
    'mechanic_promo_discount_cents', COALESCE((v_mechanic_promo_result->>'discount_cents')::int, 0)
  );
END;
$$;

COMMIT;
