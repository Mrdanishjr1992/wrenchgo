-- =====================================================
-- MIGRATION 0008: JOB LIFECYCLE FUNCTIONS
-- =====================================================
-- Purpose: State machine functions for job lifecycle
-- =====================================================

BEGIN;

-- =====================================================
-- HELPER: Calculate mechanic commission
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_mechanic_commission(price_cents int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  commission int;
BEGIN
  -- 12% commission, capped at $50 (5000 cents)
  commission := LEAST(ROUND(price_cents * 0.12)::int, 5000);
  RETURN commission;
END;
$$;

-- =====================================================
-- HELPER: Log job event
-- =====================================================

CREATE OR REPLACE FUNCTION log_job_event(
  p_job_id uuid,
  p_contract_id uuid,
  p_event_type public.job_event_type,
  p_actor_id uuid,
  p_actor_role public.user_role,
  p_title text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_amount_cents int DEFAULT NULL,
  p_visible_to_customer boolean DEFAULT true,
  p_visible_to_mechanic boolean DEFAULT true,
  p_is_system_message boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_id uuid;
BEGIN
  INSERT INTO public.job_events (
    job_id, contract_id, event_type, actor_id, actor_role,
    title, description, metadata, amount_cents,
    visible_to_customer, visible_to_mechanic, is_system_message
  ) VALUES (
    p_job_id, p_contract_id, p_event_type, p_actor_id, p_actor_role,
    p_title, p_description, p_metadata, p_amount_cents,
    p_visible_to_customer, p_visible_to_mechanic, p_is_system_message
  )
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;

-- =====================================================
-- FUNCTION: Accept quote and create contract
-- =====================================================

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
  
  -- Validate quote is pending
  IF v_quote.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote is no longer available');
  END IF;
  
  -- Validate job is in correct state
  IF v_quote.job_status NOT IN ('searching', 'quoted') THEN
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

-- =====================================================
-- FUNCTION: Mechanic marks departure
-- =====================================================

CREATE OR REPLACE FUNCTION mechanic_mark_departed(
  p_job_id uuid,
  p_mechanic_id uuid,
  p_departure_lat double precision DEFAULT NULL,
  p_departure_lng double precision DEFAULT NULL,
  p_estimated_arrival_minutes int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
  v_estimated_arrival timestamptz;
BEGIN
  -- Get contract with lock
  SELECT c.*, jp.mechanic_departed_at
  INTO v_contract
  FROM public.job_contracts c
  JOIN public.job_progress jp ON jp.contract_id = c.id
  WHERE c.job_id = p_job_id AND c.mechanic_id = p_mechanic_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract is not active');
  END IF;
  
  IF v_contract.mechanic_departed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already marked as departed');
  END IF;
  
  -- Calculate estimated arrival
  IF p_estimated_arrival_minutes IS NOT NULL THEN
    v_estimated_arrival := now() + (p_estimated_arrival_minutes || ' minutes')::interval;
  END IF;
  
  -- Update progress
  UPDATE public.job_progress
  SET 
    mechanic_departed_at = now(),
    mechanic_departure_lat = p_departure_lat,
    mechanic_departure_lng = p_departure_lng,
    estimated_arrival_at = v_estimated_arrival,
    updated_at = now()
  WHERE contract_id = v_contract.id;
  
  -- Update job status
  UPDATE public.jobs
  SET status = 'scheduled', updated_at = now()
  WHERE id = p_job_id;
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'mechanic_departed',
    p_mechanic_id, 'mechanic',
    'Mechanic on the way',
    CASE WHEN p_estimated_arrival_minutes IS NOT NULL 
      THEN 'Estimated arrival in ' || p_estimated_arrival_minutes || ' minutes'
      ELSE 'Mechanic has departed for the job location'
    END,
    jsonb_build_object('estimated_minutes', p_estimated_arrival_minutes)
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- =====================================================
-- FUNCTION: Mechanic marks arrival
-- =====================================================

CREATE OR REPLACE FUNCTION mechanic_mark_arrived(
  p_job_id uuid,
  p_mechanic_id uuid,
  p_arrival_lat double precision DEFAULT NULL,
  p_arrival_lng double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
BEGIN
  -- Get contract with lock
  SELECT c.*, jp.mechanic_departed_at, jp.mechanic_arrived_at
  INTO v_contract
  FROM public.job_contracts c
  JOIN public.job_progress jp ON jp.contract_id = c.id
  WHERE c.job_id = p_job_id AND c.mechanic_id = p_mechanic_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract is not active');
  END IF;
  
  IF v_contract.mechanic_arrived_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already marked as arrived');
  END IF;
  
  -- Update progress
  UPDATE public.job_progress
  SET 
    mechanic_arrived_at = now(),
    mechanic_arrival_lat = p_arrival_lat,
    mechanic_arrival_lng = p_arrival_lng,
    updated_at = now()
  WHERE contract_id = v_contract.id;
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'mechanic_arrived',
    p_mechanic_id, 'mechanic',
    'Mechanic arrived',
    'Mechanic has arrived at the job location. Waiting for customer confirmation.',
    jsonb_build_object()
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- =====================================================
-- FUNCTION: Customer confirms mechanic arrival
-- =====================================================

CREATE OR REPLACE FUNCTION customer_confirm_arrival(
  p_job_id uuid,
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
BEGIN
  -- Get contract with lock
  SELECT c.*, jp.mechanic_arrived_at, jp.customer_confirmed_arrival_at
  INTO v_contract
  FROM public.job_contracts c
  JOIN public.job_progress jp ON jp.contract_id = c.id
  WHERE c.job_id = p_job_id AND c.customer_id = p_customer_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract is not active');
  END IF;
  
  IF v_contract.mechanic_arrived_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mechanic has not marked arrival yet');
  END IF;
  
  IF v_contract.customer_confirmed_arrival_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already confirmed');
  END IF;
  
  -- Update progress
  UPDATE public.job_progress
  SET 
    customer_confirmed_arrival_at = now(),
    updated_at = now()
  WHERE contract_id = v_contract.id;
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'customer_confirmed_arrival',
    p_customer_id, 'customer',
    'Arrival confirmed',
    'Customer confirmed mechanic arrival. Work can now begin.',
    jsonb_build_object()
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- =====================================================
-- FUNCTION: Mechanic starts work
-- =====================================================

CREATE OR REPLACE FUNCTION mechanic_start_work(
  p_job_id uuid,
  p_mechanic_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
BEGIN
  -- Get contract with lock
  SELECT c.*, jp.customer_confirmed_arrival_at, jp.work_started_at
  INTO v_contract
  FROM public.job_contracts c
  JOIN public.job_progress jp ON jp.contract_id = c.id
  WHERE c.job_id = p_job_id AND c.mechanic_id = p_mechanic_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract is not active');
  END IF;
  
  IF v_contract.customer_confirmed_arrival_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer must confirm arrival first');
  END IF;
  
  IF v_contract.work_started_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work already started');
  END IF;
  
  -- Update progress
  UPDATE public.job_progress
  SET 
    work_started_at = now(),
    updated_at = now()
  WHERE contract_id = v_contract.id;
  
  -- Update job status
  UPDATE public.jobs
  SET status = 'in_progress', updated_at = now()
  WHERE id = p_job_id;
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'work_started',
    p_mechanic_id, 'mechanic',
    'Work started',
    'Mechanic has started working on the job.',
    jsonb_build_object()
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- =====================================================
-- FUNCTION: Add invoice line item
-- =====================================================

CREATE OR REPLACE FUNCTION add_invoice_line_item(
  p_job_id uuid,
  p_mechanic_id uuid,
  p_item_type public.line_item_type,
  p_description text,
  p_quantity numeric,
  p_unit_price_cents int,
  p_notes text DEFAULT NULL,
  p_part_number text DEFAULT NULL,
  p_part_source text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
  v_line_item_id uuid;
  v_total_cents int;
  v_approval_deadline timestamptz;
  v_max_sort int;
BEGIN
  -- Get contract
  SELECT c.*, jp.work_started_at
  INTO v_contract
  FROM public.job_contracts c
  JOIN public.job_progress jp ON jp.contract_id = c.id
  WHERE c.job_id = p_job_id AND c.mechanic_id = p_mechanic_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract is not active');
  END IF;
  
  IF v_contract.work_started_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work must be started first');
  END IF;
  
  -- Calculate total
  v_total_cents := ROUND(p_quantity * p_unit_price_cents)::int;
  
  -- Set approval deadline (24 hours from now)
  v_approval_deadline := now() + interval '24 hours';
  
  -- Get max sort order
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_max_sort
  FROM public.invoice_line_items
  WHERE contract_id = v_contract.id;
  
  -- Insert line item
  INSERT INTO public.invoice_line_items (
    contract_id, item_type, description, quantity, unit_price_cents, total_cents,
    approval_status, requires_approval, approval_deadline,
    added_by, added_by_role, notes, part_number, part_source, sort_order
  ) VALUES (
    v_contract.id, p_item_type, p_description, p_quantity, p_unit_price_cents, v_total_cents,
    'pending', true, v_approval_deadline,
    p_mechanic_id, 'mechanic', p_notes, p_part_number, p_part_source, v_max_sort
  )
  RETURNING id INTO v_line_item_id;
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'line_item_added',
    p_mechanic_id, 'mechanic',
    'Additional item requested',
    p_description || ' - $' || ROUND(v_total_cents / 100.0, 2)::text,
    jsonb_build_object(
      'line_item_id', v_line_item_id,
      'item_type', p_item_type,
      'amount_cents', v_total_cents
    ),
    v_total_cents
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'line_item_id', v_line_item_id,
    'total_cents', v_total_cents,
    'approval_deadline', v_approval_deadline
  );
END;
$$;

-- =====================================================
-- FUNCTION: Customer approves/rejects line item
-- =====================================================

CREATE OR REPLACE FUNCTION customer_respond_to_line_item(
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
  v_contract RECORD;
  v_new_subtotal int;
  v_new_total int;
  v_new_commission int;
  v_new_payout int;
BEGIN
  -- Get line item with contract
  SELECT li.*, c.id as contract_id, c.customer_id, c.job_id, c.platform_fee_cents
  INTO v_item
  FROM public.invoice_line_items li
  JOIN public.job_contracts c ON c.id = li.contract_id
  WHERE li.id = p_line_item_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Line item not found');
  END IF;
  
  IF v_item.customer_id != p_customer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  IF v_item.approval_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item already processed');
  END IF;
  
  -- Update line item
  IF p_approved THEN
    UPDATE public.invoice_line_items
    SET 
      approval_status = 'approved',
      approved_at = now(),
      approved_by = p_customer_id,
      updated_at = now()
    WHERE id = p_line_item_id;
    
    -- Recalculate contract totals
    SELECT SUM(total_cents) INTO v_new_subtotal
    FROM public.invoice_line_items
    WHERE contract_id = v_item.contract_id
    AND approval_status = 'approved'
    AND item_type != 'platform_fee';
    
    v_new_commission := calculate_mechanic_commission(v_new_subtotal);
    v_new_total := v_new_subtotal + v_item.platform_fee_cents;
    v_new_payout := v_new_subtotal - v_new_commission;
    
    UPDATE public.job_contracts
    SET 
      subtotal_cents = v_new_subtotal,
      total_customer_cents = v_new_total,
      mechanic_commission_cents = v_new_commission,
      mechanic_payout_cents = v_new_payout,
      updated_at = now()
    WHERE id = v_item.contract_id;
    
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
-- FUNCTION: Mechanic marks work complete
-- =====================================================

CREATE OR REPLACE FUNCTION mechanic_mark_complete(
  p_job_id uuid,
  p_mechanic_id uuid,
  p_work_summary text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
  v_pending_items int;
BEGIN
  -- Get contract
  SELECT c.*, jp.work_started_at, jp.mechanic_completed_at, jp.customer_completed_at
  INTO v_contract
  FROM public.job_contracts c
  JOIN public.job_progress jp ON jp.contract_id = c.id
  WHERE c.job_id = p_job_id AND c.mechanic_id = p_mechanic_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract is not active');
  END IF;
  
  IF v_contract.work_started_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work has not been started');
  END IF;
  
  IF v_contract.mechanic_completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already marked as complete');
  END IF;
  
  -- Check for pending line items
  SELECT COUNT(*) INTO v_pending_items
  FROM public.invoice_line_items
  WHERE contract_id = v_contract.id AND approval_status = 'pending';
  
  IF v_pending_items > 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'There are ' || v_pending_items || ' pending line items awaiting customer approval'
    );
  END IF;
  
  -- Update progress
  UPDATE public.job_progress
  SET 
    mechanic_completed_at = now(),
    actual_work_duration_minutes = EXTRACT(EPOCH FROM (now() - work_started_at)) / 60,
    updated_at = now()
  WHERE contract_id = v_contract.id;
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'work_completed_mechanic',
    p_mechanic_id, 'mechanic',
    'Work completed',
    COALESCE(p_work_summary, 'Mechanic has marked the work as complete. Awaiting customer confirmation.'),
    jsonb_build_object('summary', p_work_summary)
  );
  
  -- Check if customer also completed (finalize if so)
  IF v_contract.customer_completed_at IS NOT NULL THEN
    PERFORM finalize_job(p_job_id);
  END IF;
  
  RETURN jsonb_build_object('success', true, 'awaiting_customer', v_contract.customer_completed_at IS NULL);
END;
$$;

-- =====================================================
-- FUNCTION: Customer confirms completion
-- =====================================================

CREATE OR REPLACE FUNCTION customer_confirm_complete(
  p_job_id uuid,
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
BEGIN
  -- Get contract
  SELECT c.*, jp.work_started_at, jp.mechanic_completed_at, jp.customer_completed_at
  INTO v_contract
  FROM public.job_contracts c
  JOIN public.job_progress jp ON jp.contract_id = c.id
  WHERE c.job_id = p_job_id AND c.customer_id = p_customer_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract is not active');
  END IF;
  
  IF v_contract.customer_completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already confirmed');
  END IF;
  
  -- Update progress
  UPDATE public.job_progress
  SET 
    customer_completed_at = now(),
    updated_at = now()
  WHERE contract_id = v_contract.id;
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'work_completed_customer',
    p_customer_id, 'customer',
    'Completion confirmed',
    'Customer has confirmed the work is complete.',
    jsonb_build_object()
  );
  
  -- Check if mechanic also completed (finalize if so)
  IF v_contract.mechanic_completed_at IS NOT NULL THEN
    PERFORM finalize_job(p_job_id);
  END IF;
  
  RETURN jsonb_build_object('success', true, 'awaiting_mechanic', v_contract.mechanic_completed_at IS NULL);
END;
$$;

-- =====================================================
-- FUNCTION: Finalize job (internal)
-- =====================================================

CREATE OR REPLACE FUNCTION finalize_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
BEGIN
  -- Get contract
  SELECT c.*
  INTO v_contract
  FROM public.job_contracts c
  WHERE c.job_id = p_job_id
  FOR UPDATE;
  
  IF NOT FOUND OR v_contract.status != 'active' THEN
    RETURN;
  END IF;
  
  -- Update progress
  UPDATE public.job_progress
  SET finalized_at = now(), updated_at = now()
  WHERE contract_id = v_contract.id;
  
  -- Update contract
  UPDATE public.job_contracts
  SET status = 'completed', updated_at = now()
  WHERE id = v_contract.id;
  
  -- Update job
  UPDATE public.jobs
  SET 
    status = 'completed',
    completed_at = now(),
    final_price_cents = v_contract.subtotal_cents,
    updated_at = now()
  WHERE id = p_job_id;
  
  -- Create payout record
  INSERT INTO public.payouts (
    contract_id, mechanic_id,
    gross_amount_cents, commission_cents, net_amount_cents,
    status, scheduled_for
  ) VALUES (
    v_contract.id, v_contract.mechanic_id,
    v_contract.subtotal_cents, v_contract.mechanic_commission_cents, v_contract.mechanic_payout_cents,
    'pending', now() + interval '2 days'
  );
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'job_finalized',
    NULL, NULL,
    'Job completed',
    'Both parties confirmed completion. Payment will be processed.',
    jsonb_build_object(
      'total_cents', v_contract.total_customer_cents,
      'mechanic_payout_cents', v_contract.mechanic_payout_cents
    ),
    v_contract.total_customer_cents,
    true, true, true
  );
END;
$$;

-- =====================================================
-- FUNCTION: Cancel job
-- =====================================================

CREATE OR REPLACE FUNCTION cancel_job(
  p_job_id uuid,
  p_cancelled_by uuid,
  p_reason public.cancellation_reason,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
  v_refund_amount int;
  v_is_customer boolean;
BEGIN
  -- Get contract
  SELECT c.*, jp.*
  INTO v_contract
  FROM public.job_contracts c
  LEFT JOIN public.job_progress jp ON jp.contract_id = c.id
  WHERE c.job_id = p_job_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status NOT IN ('pending_payment', 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel - job is ' || v_contract.status);
  END IF;
  
  -- Determine if canceller is customer
  v_is_customer := (p_cancelled_by = v_contract.customer_id);
  
  -- Calculate refund based on reason
  CASE p_reason
    WHEN 'customer_before_departure', 'mechanic_before_departure', 'mechanic_no_show' THEN
      v_refund_amount := v_contract.total_customer_cents;  -- Full refund
    WHEN 'customer_after_departure' THEN
      v_refund_amount := v_contract.total_customer_cents - 2500;  -- Minus $25 travel fee
    WHEN 'customer_after_arrival', 'customer_no_show' THEN
      v_refund_amount := v_contract.total_customer_cents - 2500;  -- Minus $25 travel fee
    WHEN 'customer_after_work_started' THEN
      v_refund_amount := 0;  -- No refund after work started
    WHEN 'mutual_agreement', 'platform_intervention' THEN
      v_refund_amount := v_contract.total_customer_cents;  -- Full refund (can be adjusted)
    ELSE
      v_refund_amount := v_contract.total_customer_cents;
  END CASE;
  
  -- Ensure refund is not negative
  v_refund_amount := GREATEST(v_refund_amount, 0);
  
  -- Update contract
  UPDATE public.job_contracts
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_cancelled_by,
    cancellation_reason = p_reason,
    cancellation_note = p_note,
    refund_amount_cents = v_refund_amount,
    updated_at = now()
  WHERE id = v_contract.id;
  
  -- Update job
  UPDATE public.jobs
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    canceled_by = p_cancelled_by,
    updated_at = now()
  WHERE id = p_job_id;
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'cancelled',
    p_cancelled_by, CASE WHEN v_is_customer THEN 'customer'::public.user_role ELSE 'mechanic'::public.user_role END,
    'Job cancelled',
    COALESCE(p_note, 'Job was cancelled: ' || p_reason::text),
    jsonb_build_object(
      'reason', p_reason,
      'refund_amount_cents', v_refund_amount,
      'cancelled_by_customer', v_is_customer
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'refund_amount_cents', v_refund_amount
  );
END;
$$;

-- =====================================================
-- FUNCTION: Make reviews visible (blind review reveal)
-- =====================================================

CREATE OR REPLACE FUNCTION reveal_reviews_for_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if both reviews exist
  IF (SELECT COUNT(*) FROM public.reviews WHERE job_id = p_job_id) >= 2 THEN
    UPDATE public.reviews
    SET 
      is_visible = true,
      made_visible_at = now(),
      visibility_reason = 'both_submitted'
    WHERE job_id = p_job_id AND is_visible = false;
  END IF;
END;
$$;

-- =====================================================
-- TRIGGER: Auto-reveal reviews when both submitted
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_check_review_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM reveal_reviews_for_job(NEW.job_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_review_visibility ON public.reviews;
CREATE TRIGGER trg_check_review_visibility
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_review_visibility();

COMMIT;
