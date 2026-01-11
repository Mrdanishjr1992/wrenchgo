-- =====================================================
-- MIGRATION 0024: Job Lifecycle Hardening
-- =====================================================
-- Purpose: Fix quote status bug, add race condition protection,
--          improve status reconciliation, clarify payment flow
-- =====================================================

BEGIN;

-- =====================================================
-- 1. FIX: Quote acceptance trigger (rejected → declined)
-- =====================================================
-- The 'rejected' status doesn't exist in quote_status enum
-- Valid values: pending, accepted, declined, expired, withdrawn

CREATE OR REPLACE FUNCTION public.on_quote_accepted()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if transitioning TO accepted from a non-accepted state
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status <> 'accepted') THEN
    -- Ensure only pending quotes can be accepted
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Only pending quotes can be accepted. Current status: %', OLD.status;
    END IF;
    
    -- Update job status and assign mechanic
    UPDATE public.jobs
    SET 
      status = 'accepted',
      accepted_mechanic_id = NEW.mechanic_id,
      updated_at = NOW()
    WHERE id = NEW.job_id
      AND status IN ('searching', 'quoted');
    
    -- Decline all other pending quotes for this job (FIX: was 'rejected')
    UPDATE public.quotes
    SET status = 'declined', updated_at = NOW()
    WHERE job_id = NEW.job_id
      AND id <> NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. CONSTRAINT: Only one accepted quote per job
-- =====================================================
-- Partial unique index prevents race conditions at DB level

CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_accepted_quote_per_job
ON public.quotes(job_id)
WHERE status = 'accepted';

COMMENT ON INDEX uniq_one_accepted_quote_per_job IS 
  'Ensures only one quote can be accepted per job, preventing race conditions';

-- =====================================================
-- 3. IMPROVED: Job effective status reconciliation
-- =====================================================
-- Self-healing function that fixes inconsistent states
-- Safe to call from API layer, idempotent

CREATE OR REPLACE FUNCTION public.get_job_effective_status(p_job_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_job RECORD;
  v_has_pending_quotes BOOLEAN;
  v_has_accepted_quote BOOLEAN;
  v_contract_status TEXT;
BEGIN
  -- Get current job state
  SELECT id, status INTO v_job FROM public.jobs WHERE id = p_job_id;
  
  IF v_job IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Never override cancelled status
  IF v_job.status = 'cancelled' THEN
    RETURN 'cancelled';
  END IF;
  
  -- Check for accepted quote
  SELECT EXISTS(
    SELECT 1 FROM public.quotes WHERE job_id = p_job_id AND status = 'accepted'
  ) INTO v_has_accepted_quote;
  
  -- If accepted quote exists, job must be accepted
  IF v_has_accepted_quote THEN
    IF v_job.status <> 'accepted' THEN
      UPDATE public.jobs 
      SET status = 'accepted', updated_at = NOW() 
      WHERE id = p_job_id;
    END IF;
    RETURN 'accepted';
  END IF;
  
  -- Check for pending quotes
  SELECT EXISTS(
    SELECT 1 FROM public.quotes WHERE job_id = p_job_id AND status = 'pending'
  ) INTO v_has_pending_quotes;
  
  -- If pending quotes exist and job is searching, upgrade to quoted
  IF v_has_pending_quotes AND v_job.status = 'searching' THEN
    UPDATE public.jobs 
    SET status = 'quoted', updated_at = NOW() 
    WHERE id = p_job_id;
    RETURN 'quoted';
  END IF;
  
  -- If job is quoted but no pending quotes, revert to searching
  IF NOT v_has_pending_quotes AND v_job.status = 'quoted' THEN
    UPDATE public.jobs 
    SET status = 'searching', updated_at = NOW() 
    WHERE id = p_job_id;
    RETURN 'searching';
  END IF;
  
  RETURN v_job.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. FUNCTION: Accept quote and create contract
-- =====================================================
-- Atomic operation: accept quote + create contract + authorize payment
-- Returns contract_id on success

CREATE OR REPLACE FUNCTION public.accept_quote_and_create_contract(
  p_quote_id UUID,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_quote RECORD;
  v_job RECORD;
  v_contract_id UUID;
  v_platform_fee_cents INT := 1500; -- $15 flat
  v_commission_rate NUMERIC := 0.12; -- 12%
  v_commission_cap_cents INT := 5000; -- $50 cap
  v_commission_cents INT;
  v_mechanic_payout_cents INT;
  v_total_customer_cents INT;
BEGIN
  -- Lock and fetch quote
  SELECT * INTO v_quote 
  FROM public.quotes 
  WHERE id = p_quote_id 
  FOR UPDATE;
  
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found: %', p_quote_id;
  END IF;
  
  IF v_quote.status <> 'pending' THEN
    RAISE EXCEPTION 'Quote is not pending. Current status: %', v_quote.status;
  END IF;
  
  -- Lock and fetch job
  SELECT * INTO v_job 
  FROM public.jobs 
  WHERE id = v_quote.job_id 
  FOR UPDATE;
  
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', v_quote.job_id;
  END IF;
  
  IF v_job.status NOT IN ('searching', 'quoted') THEN
    RAISE EXCEPTION 'Job is not available for quote acceptance. Status: %', v_job.status;
  END IF;
  
  -- Check no other accepted quote exists (belt + suspenders with unique index)
  IF EXISTS (SELECT 1 FROM public.quotes WHERE job_id = v_job.id AND status = 'accepted') THEN
    RAISE EXCEPTION 'Another quote has already been accepted for this job';
  END IF;
  
  -- Calculate fees
  v_commission_cents := LEAST(
    FLOOR(v_quote.price_cents * v_commission_rate)::INT,
    v_commission_cap_cents
  );
  v_mechanic_payout_cents := v_quote.price_cents - v_commission_cents;
  v_total_customer_cents := v_quote.price_cents + v_platform_fee_cents;
  
  -- Accept the quote (triggers on_quote_accepted)
  UPDATE public.quotes
  SET status = 'accepted', updated_at = NOW()
  WHERE id = p_quote_id;
  
  -- Create contract
  INSERT INTO public.job_contracts (
    job_id,
    quote_id,
    customer_id,
    mechanic_id,
    status,
    quoted_price_cents,
    platform_fee_cents,
    estimated_hours,
    subtotal_cents,
    total_customer_cents,
    mechanic_commission_cents,
    mechanic_payout_cents,
    stripe_payment_intent_id,
    payment_authorized_at
  ) VALUES (
    v_job.id,
    p_quote_id,
    v_job.customer_id,
    v_quote.mechanic_id,
    CASE WHEN p_stripe_payment_intent_id IS NOT NULL THEN 'active'::contract_status ELSE 'pending_payment'::contract_status END,
    v_quote.price_cents,
    v_platform_fee_cents,
    v_quote.estimated_hours,
    v_quote.price_cents,
    v_total_customer_cents,
    v_commission_cents,
    v_mechanic_payout_cents,
    p_stripe_payment_intent_id,
    CASE WHEN p_stripe_payment_intent_id IS NOT NULL THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_contract_id;
  
  -- Create initial line item for quoted labor
  INSERT INTO public.invoice_line_items (
    contract_id,
    item_type,
    description,
    quantity,
    unit_price_cents,
    total_cents,
    approval_status,
    requires_approval,
    added_by,
    added_by_role
  ) VALUES (
    v_contract_id,
    'base_labor',
    COALESCE(v_quote.description, 'Labor as quoted'),
    1,
    v_quote.price_cents,
    v_quote.price_cents,
    'approved',
    false, -- Original quote doesn't need approval
    v_quote.mechanic_id,
    'mechanic'
  );
  
  -- Create job_progress record
  INSERT INTO public.job_progress (job_id, contract_id)
  VALUES (v_job.id, v_contract_id)
  ON CONFLICT (job_id) DO UPDATE SET contract_id = v_contract_id;
  
  -- Log event
  INSERT INTO public.job_events (
    job_id, contract_id, event_type, actor_id, actor_role,
    title, description, amount_cents
  ) VALUES (
    v_job.id, v_contract_id, 'quote_accepted', v_job.customer_id, 'customer',
    'Quote accepted',
    format('Customer accepted quote from mechanic for $%s', (v_quote.price_cents / 100.0)::TEXT),
    v_quote.price_cents
  );
  
  RETURN v_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.accept_quote_and_create_contract(UUID, TEXT) TO authenticated;

-- =====================================================
-- 5. FUNCTION: Authorize payment on contract
-- =====================================================
-- Called after Stripe PaymentIntent is created/confirmed

CREATE OR REPLACE FUNCTION public.authorize_contract_payment(
  p_contract_id UUID,
  p_stripe_payment_intent_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_contract RECORD;
BEGIN
  SELECT * INTO v_contract 
  FROM public.job_contracts 
  WHERE id = p_contract_id 
  FOR UPDATE;
  
  IF v_contract IS NULL THEN
    RAISE EXCEPTION 'Contract not found: %', p_contract_id;
  END IF;
  
  IF v_contract.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Contract is not pending payment. Status: %', v_contract.status;
  END IF;
  
  UPDATE public.job_contracts
  SET 
    status = 'active',
    stripe_payment_intent_id = p_stripe_payment_intent_id,
    payment_authorized_at = NOW(),
    updated_at = NOW()
  WHERE id = p_contract_id;
  
  -- Log event
  INSERT INTO public.job_events (
    job_id, contract_id, event_type, actor_id, actor_role,
    title, description, amount_cents
  ) VALUES (
    v_contract.job_id, p_contract_id, 'payment_authorized', v_contract.customer_id, 'customer',
    'Payment authorized',
    format('Card authorized for $%s (not charged yet)', (v_contract.total_customer_cents / 100.0)::TEXT),
    v_contract.total_customer_cents
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.authorize_contract_payment(UUID, TEXT) TO authenticated;

-- =====================================================
-- 6. FUNCTION: Check if mechanic can depart
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_mechanic_depart(p_contract_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_contract RECORD;
BEGIN
  SELECT * INTO v_contract FROM public.job_contracts WHERE id = p_contract_id;
  
  IF v_contract IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Must have payment authorized
  RETURN v_contract.payment_authorized_at IS NOT NULL 
     AND v_contract.status = 'active';
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.can_mechanic_depart(UUID) TO authenticated;

-- =====================================================
-- 7. FUNCTION: Recalculate contract totals
-- =====================================================
-- Only includes approved line items

CREATE OR REPLACE FUNCTION public.recalculate_contract_totals(p_contract_id UUID)
RETURNS VOID AS $$
DECLARE
  v_subtotal_cents INT;
  v_commission_cents INT;
  v_commission_rate NUMERIC := 0.12;
  v_commission_cap_cents INT := 5000;
  v_contract RECORD;
BEGIN
  SELECT * INTO v_contract FROM public.job_contracts WHERE id = p_contract_id;
  
  IF v_contract IS NULL THEN
    RAISE EXCEPTION 'Contract not found: %', p_contract_id;
  END IF;
  
  -- Sum only approved items (excluding platform_fee type)
  SELECT COALESCE(SUM(total_cents), 0) INTO v_subtotal_cents
  FROM public.invoice_line_items
  WHERE contract_id = p_contract_id
    AND approval_status = 'approved'
    AND item_type <> 'platform_fee';
  
  -- Recalculate commission
  v_commission_cents := LEAST(
    FLOOR(v_subtotal_cents * v_commission_rate)::INT,
    v_commission_cap_cents
  );
  
  UPDATE public.job_contracts
  SET 
    subtotal_cents = v_subtotal_cents,
    total_customer_cents = v_subtotal_cents + platform_fee_cents,
    mechanic_commission_cents = v_commission_cents,
    mechanic_payout_cents = v_subtotal_cents - v_commission_cents,
    updated_at = NOW()
  WHERE id = p_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. TRIGGER: Recalculate on line item approval
-- =====================================================

CREATE OR REPLACE FUNCTION public.on_line_item_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approval_status = 'approved' AND OLD.approval_status <> 'approved' THEN
    PERFORM public.recalculate_contract_totals(NEW.contract_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_line_item_approved ON public.invoice_line_items;
CREATE TRIGGER trg_line_item_approved
  AFTER UPDATE ON public.invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.on_line_item_approved();

-- =====================================================
-- 9. FUNCTION: Complete job and capture payment
-- =====================================================

CREATE OR REPLACE FUNCTION public.finalize_job_completion(
  p_contract_id UUID,
  p_actor_id UUID,
  p_actor_role user_role
)
RETURNS BOOLEAN AS $$
DECLARE
  v_contract RECORD;
  v_progress RECORD;
BEGIN
  SELECT * INTO v_contract 
  FROM public.job_contracts 
  WHERE id = p_contract_id 
  FOR UPDATE;
  
  IF v_contract IS NULL THEN
    RAISE EXCEPTION 'Contract not found';
  END IF;
  
  IF v_contract.status <> 'active' THEN
    RAISE EXCEPTION 'Contract is not active. Status: %', v_contract.status;
  END IF;
  
  SELECT * INTO v_progress FROM public.job_progress WHERE contract_id = p_contract_id;
  
  -- Update completion timestamp based on role
  IF p_actor_role = 'mechanic' THEN
    UPDATE public.job_progress
    SET mechanic_completed_at = NOW(), updated_at = NOW()
    WHERE contract_id = p_contract_id;
    
    -- Refresh
    SELECT * INTO v_progress FROM public.job_progress WHERE contract_id = p_contract_id;
  ELSIF p_actor_role = 'customer' THEN
    UPDATE public.job_progress
    SET customer_completed_at = NOW(), updated_at = NOW()
    WHERE contract_id = p_contract_id;
    
    -- Refresh
    SELECT * INTO v_progress FROM public.job_progress WHERE contract_id = p_contract_id;
  END IF;
  
  -- Check if both parties have confirmed
  IF v_progress.mechanic_completed_at IS NOT NULL AND v_progress.customer_completed_at IS NOT NULL THEN
    -- Finalize
    UPDATE public.job_progress
    SET finalized_at = NOW(), updated_at = NOW()
    WHERE contract_id = p_contract_id;
    
    -- Mark contract completed (payment capture happens via Stripe webhook)
    UPDATE public.job_contracts
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_contract_id;
    
    -- Update job status
    UPDATE public.jobs
    SET status = 'completed', updated_at = NOW()
    WHERE id = v_contract.job_id;
    
    -- Create payout record (pending until Stripe processes)
    INSERT INTO public.payouts (
      contract_id,
      mechanic_id,
      gross_amount_cents,
      commission_cents,
      net_amount_cents,
      status
    ) VALUES (
      p_contract_id,
      v_contract.mechanic_id,
      v_contract.subtotal_cents,
      v_contract.mechanic_commission_cents,
      v_contract.mechanic_payout_cents,
      'pending'
    );
    
    -- Log finalization
    INSERT INTO public.job_events (
      job_id, contract_id, event_type, actor_id, actor_role,
      title, description, amount_cents
    ) VALUES (
      v_contract.job_id, p_contract_id, 'job_finalized', p_actor_id, p_actor_role,
      'Job completed',
      'Both parties confirmed completion. Payment will be captured.',
      v_contract.total_customer_cents
    );
    
    RETURN TRUE;
  END IF;
  
  -- Log partial completion
  INSERT INTO public.job_events (
    job_id, contract_id, event_type, actor_id, actor_role,
    title, description
  ) VALUES (
    v_contract.job_id, p_contract_id, 
    CASE WHEN p_actor_role = 'mechanic' THEN 'work_completed_mechanic' ELSE 'work_completed_customer' END,
    p_actor_id, p_actor_role,
    CASE WHEN p_actor_role = 'mechanic' THEN 'Mechanic marked complete' ELSE 'Customer confirmed completion' END,
    'Waiting for other party to confirm'
  );
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.finalize_job_completion(UUID, UUID, user_role) TO authenticated;

-- =====================================================
-- 10. DATA FIX: Convert any 'rejected' quotes to 'declined'
-- =====================================================
-- Safe no-op if no invalid data exists

DO $$
BEGIN
  -- This will fail silently if 'rejected' doesn't exist in enum
  -- which is expected - we're just being defensive
  UPDATE public.quotes
  SET status = 'declined'
  WHERE status::text = 'rejected';
EXCEPTION WHEN invalid_text_representation THEN
  -- 'rejected' is not a valid enum value, nothing to fix
  NULL;
END $$;

COMMIT;

-- =====================================================
-- CUSTOMER-FACING COPY (for UI implementation)
-- =====================================================
/*
QUOTE ACCEPTANCE SCREEN:
------------------------
Title: "Confirm Your Booking"

Body:
"By accepting this quote, you're authorizing a hold on your payment method.

✓ Your card will be AUTHORIZED, not charged
✓ The actual charge only happens after the job is completed
✓ You must approve any additional work before it affects your total
✓ You can cancel before the mechanic departs for a full refund

Authorization Amount: $[total_customer_cents / 100]
  - Service: $[subtotal_cents / 100]
  - Platform Fee: $[platform_fee_cents / 100]"

Button: "Authorize & Book"


PAYMENT AUTHORIZATION CONFIRMATION:
-----------------------------------
Title: "Booking Confirmed!"

Body:
"Your card has been authorized for $[amount].

What happens next:
1. Your mechanic will depart to your location
2. They'll complete the agreed work
3. You'll confirm the job is done
4. Only then will your card be charged

You're in control:
• Any additional work requires your approval
• You can message your mechanic anytime
• Cancel before departure for a full refund"


FINAL PAYMENT CAPTURE NOTIFICATION:
-----------------------------------
Title: "Payment Complete"

Body:
"Your job is complete! Here's your receipt:

Service Total: $[subtotal_cents / 100]
Platform Fee: $[platform_fee_cents / 100]
─────────────────
Total Charged: $[total_customer_cents / 100]

Thank you for using WrenchGo!"


ADDITIONAL WORK APPROVAL:
-------------------------
Title: "Additional Work Requested"

Body:
"[Mechanic Name] has identified additional work:

[item_description]
Cost: $[item_total_cents / 100]

This will increase your total from $[current_total] to $[new_total].

You can approve or decline this work. Declining won't affect your original service."

Buttons: "Approve" | "Decline"
*/
