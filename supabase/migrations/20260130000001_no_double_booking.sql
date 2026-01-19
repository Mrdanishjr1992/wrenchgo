-- =====================================================
-- MIGRATION: No Double Booking System
-- =====================================================
-- Purpose: Prevent mechanics from being double-booked for overlapping time windows
-- When a quote is accepted, all overlapping pending quotes from that mechanic are expired
-- =====================================================

BEGIN;

-- =====================================================
-- A) Add estimated_duration_minutes to jobs
-- =====================================================
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS estimated_duration_minutes int NOT NULL DEFAULT 90;

COMMENT ON COLUMN public.jobs.estimated_duration_minutes IS 'Estimated job duration in minutes, used for scheduling conflict detection';

-- =====================================================
-- B) Add time window columns to quotes
-- =====================================================
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS proposed_start_at timestamptz,
ADD COLUMN IF NOT EXISTS proposed_end_at timestamptz,
ADD COLUMN IF NOT EXISTS conflict_status_reason text;

COMMENT ON COLUMN public.quotes.proposed_start_at IS 'Start time of the proposed service window (copied from job.scheduled_at)';
COMMENT ON COLUMN public.quotes.proposed_end_at IS 'End time of the proposed service window (scheduled_at + duration)';
COMMENT ON COLUMN public.quotes.conflict_status_reason IS 'Reason for conflict-based status change (e.g., time_conflict)';

-- =====================================================
-- C) Update quotes status CHECK constraint to include expired_conflict
-- =====================================================
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check 
  CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'withdrawn', 'expired_conflict'));

-- =====================================================
-- D) Add booking window columns to job_contracts
-- =====================================================
ALTER TABLE public.job_contracts 
ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

COMMENT ON COLUMN public.job_contracts.scheduled_start_at IS 'Booked start time for conflict detection';
COMMENT ON COLUMN public.job_contracts.scheduled_end_at IS 'Booked end time for conflict detection';

-- =====================================================
-- E) Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_quotes_mechanic_conflict_check
  ON public.quotes (mechanic_id, status, proposed_start_at, proposed_end_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_job_contracts_mechanic_schedule
  ON public.job_contracts (mechanic_id, scheduled_start_at, scheduled_end_at, status)
  WHERE status IN ('pending_payment', 'active');

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at
  ON public.jobs (scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- =====================================================
-- F) Add event types for conflict handling
-- =====================================================
DO $$ BEGIN
  ALTER TYPE public.job_event_type ADD VALUE IF NOT EXISTS 'quote_expired_conflict';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- G) Backfill existing quotes with time windows
-- =====================================================
UPDATE public.quotes q
SET 
  proposed_start_at = j.scheduled_at,
  proposed_end_at = j.scheduled_at + (COALESCE(j.estimated_duration_minutes, 90) * interval '1 minute')
FROM public.jobs j
WHERE q.job_id = j.id
  AND q.proposed_start_at IS NULL
  AND j.scheduled_at IS NOT NULL;

-- =====================================================
-- H) Backfill existing contracts with booking windows
-- =====================================================
UPDATE public.job_contracts jc
SET 
  scheduled_start_at = j.scheduled_at,
  scheduled_end_at = j.scheduled_at + (COALESCE(j.estimated_duration_minutes, 90) * interval '1 minute')
FROM public.jobs j
WHERE jc.job_id = j.id
  AND jc.scheduled_start_at IS NULL
  AND j.scheduled_at IS NOT NULL;

-- =====================================================
-- I) Trigger to auto-populate quote time windows on insert
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_quote_time_window()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT scheduled_at, estimated_duration_minutes
  INTO v_job
  FROM public.jobs
  WHERE id = NEW.job_id;
  
  IF v_job.scheduled_at IS NOT NULL THEN
    NEW.proposed_start_at := v_job.scheduled_at;
    NEW.proposed_end_at := v_job.scheduled_at + (COALESCE(v_job.estimated_duration_minutes, 90) * interval '1 minute');
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_quote_time_window ON public.quotes;
CREATE TRIGGER trg_set_quote_time_window
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  WHEN (NEW.proposed_start_at IS NULL)
  EXECUTE FUNCTION public.set_quote_time_window();

-- =====================================================
-- J) CORE RPC: accept_quote_and_resolve_conflicts
-- =====================================================
-- This replaces accept_quote_and_create_contract with conflict detection
-- Uses SELECT FOR UPDATE for concurrency safety

CREATE OR REPLACE FUNCTION public.accept_quote_and_resolve_conflicts(
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
  v_booking_start timestamptz;
  v_booking_end timestamptz;
  v_conflict_contract_id uuid;
  v_expired_quote_ids uuid[];
  v_expired_count int := 0;
  v_mechanic_name text;
  v_job_title text;
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

  -- Get quote with lock (FOR UPDATE prevents concurrent acceptance)
  SELECT 
    q.*, 
    j.customer_id as job_customer_id, 
    j.status as job_status, 
    j.id as actual_job_id,
    j.scheduled_at,
    j.estimated_duration_minutes,
    j.title as job_title
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
  
  IF v_quote.status NOT IN ('pending', 'accepted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote is no longer available');
  END IF;
  
  IF v_quote.job_status NOT IN ('searching', 'quoted', 'accepted') THEN
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
  
  -- Calculate booking window
  v_booking_start := COALESCE(v_quote.proposed_start_at, v_quote.scheduled_at);
  v_booking_end := COALESCE(
    v_quote.proposed_end_at, 
    v_quote.scheduled_at + (COALESCE(v_quote.estimated_duration_minutes, 90) * interval '1 minute')
  );
  
  -- If no scheduled time, we can't do conflict checking
  IF v_booking_start IS NULL THEN
    v_booking_start := now();
    v_booking_end := now() + interval '90 minutes';
  END IF;
  
  -- =====================================================
  -- CONFLICT CHECK: Ensure mechanic isn't already booked
  -- =====================================================
  SELECT jc.id INTO v_conflict_contract_id
  FROM public.job_contracts jc
  WHERE jc.mechanic_id = v_quote.mechanic_id
    AND jc.status IN ('pending_payment', 'active')
    AND jc.scheduled_start_at < v_booking_end
    AND jc.scheduled_end_at > v_booking_start
  LIMIT 1
  FOR UPDATE;
  
  IF v_conflict_contract_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Mechanic is no longer available at that time.',
      'error_code', 'MECHANIC_UNAVAILABLE',
      'conflict_contract_id', v_conflict_contract_id
    );
  END IF;
  
  -- Check if contract already exists for this job (retry scenario)
  SELECT id INTO v_contract_id
  FROM public.job_contracts
  WHERE job_id = v_quote.job_id;
  
  IF v_contract_id IS NOT NULL THEN
    -- Contract exists, return it
    RETURN jsonb_build_object(
      'success', true,
      'contract_id', v_contract_id,
      'already_exists', true,
      'expired_quote_ids', ARRAY[]::uuid[],
      'expired_count', 0,
      'scheduled_start_at', v_booking_start,
      'scheduled_end_at', v_booking_end
    );
  END IF;
  
  -- Calculate fees
  v_commission_cents := calculate_mechanic_commission(v_quote.price_cents);
  v_total_customer_cents := v_quote.price_cents + v_platform_fee_cents;
  v_mechanic_payout_cents := v_quote.price_cents - v_commission_cents;
  
  -- Create contract with booking window
  INSERT INTO public.job_contracts (
    job_id, quote_id, customer_id, mechanic_id,
    status, quoted_price_cents, platform_fee_cents, estimated_hours,
    subtotal_cents, total_customer_cents, mechanic_commission_cents, mechanic_payout_cents,
    customer_acknowledged_at, scheduled_start_at, scheduled_end_at
  ) VALUES (
    v_quote.job_id, p_quote_id, p_customer_id, v_quote.mechanic_id,
    'active', v_quote.price_cents, v_platform_fee_cents, v_quote.estimated_hours,
    v_quote.price_cents, v_total_customer_cents, v_commission_cents, v_mechanic_payout_cents,
    now(), v_booking_start, v_booking_end
  )
  RETURNING id INTO v_contract_id;
  
  -- Auto-apply mechanic promo credit
  v_mechanic_promo_result := public.apply_mechanic_promo_to_contract(
    v_contract_id,
    v_quote.mechanic_id,
    v_commission_cents
  );
  
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
  WHERE job_id = v_quote.job_id AND id != p_quote_id AND status = 'pending';
  
  -- Update job status
  UPDATE public.jobs
  SET 
    status = 'accepted',
    accepted_mechanic_id = v_quote.mechanic_id,
    updated_at = now()
  WHERE id = v_quote.job_id;
  
  -- =====================================================
  -- EXPIRE OVERLAPPING PENDING QUOTES FROM SAME MECHANIC
  -- =====================================================
  WITH expired AS (
    UPDATE public.quotes
    SET 
      status = 'expired_conflict', 
      conflict_status_reason = 'time_conflict',
      updated_at = now()
    WHERE mechanic_id = v_quote.mechanic_id
      AND id != p_quote_id
      AND status = 'pending'
      AND proposed_start_at IS NOT NULL
      AND proposed_end_at IS NOT NULL
      AND proposed_start_at < v_booking_end
      AND proposed_end_at > v_booking_start
    RETURNING id, job_id
  )
  SELECT array_agg(id), count(*) INTO v_expired_quote_ids, v_expired_count FROM expired;
  
  -- Default to empty array if null
  v_expired_quote_ids := COALESCE(v_expired_quote_ids, ARRAY[]::uuid[]);
  v_expired_count := COALESCE(v_expired_count, 0);
  
  -- Log event for accepted quote
  PERFORM log_job_event(
    v_quote.job_id, v_contract_id, 'contract_created',
    p_customer_id, 'customer',
    'Contract created',
    'Quote accepted and contract created',
    jsonb_build_object(
      'quoted_price_cents', v_quote.price_cents,
      'platform_fee_cents', v_platform_fee_cents,
      'total_cents', v_total_customer_cents,
      'mechanic_promo_applied', COALESCE((v_mechanic_promo_result->>'has_credit')::boolean, false),
      'mechanic_promo_discount_cents', COALESCE((v_mechanic_promo_result->>'discount_cents')::int, 0),
      'expired_conflict_count', v_expired_count,
      'scheduled_start_at', v_booking_start,
      'scheduled_end_at', v_booking_end
    ),
    v_total_customer_cents
  );
  
  -- Log events for expired quotes
  IF v_expired_count > 0 THEN
    PERFORM log_job_event(
      v_quote.job_id, v_contract_id, 'quote_expired_conflict',
      v_quote.mechanic_id, 'mechanic',
      'Overlapping quotes expired',
      format('%s pending quote(s) expired due to time conflict', v_expired_count),
      jsonb_build_object(
        'expired_quote_ids', v_expired_quote_ids,
        'expired_count', v_expired_count,
        'booking_start', v_booking_start,
        'booking_end', v_booking_end
      ),
      NULL
    );
  END IF;
  
  -- =====================================================
  -- NOTIFICATION: Notify mechanic of acceptance + conflicts
  -- =====================================================
  SELECT p.full_name INTO v_mechanic_name
  FROM public.profiles p
  WHERE p.id = v_quote.mechanic_id;
  
  v_job_title := v_quote.job_title;
  
  INSERT INTO public.notifications (
    user_id, title, body, type, entity_type, entity_id, data
  ) VALUES (
    v_quote.mechanic_id,
    'Quote accepted — booking confirmed',
    CASE 
      WHEN v_expired_count > 0 THEN
        format('%s booked for %s. %s overlapping quote(s) expired.', 
          v_job_title, 
          to_char(v_booking_start AT TIME ZONE 'UTC', 'Mon DD, HH12:MI AM'),
          v_expired_count)
      ELSE
        format('%s booked for %s', 
          v_job_title, 
          to_char(v_booking_start AT TIME ZONE 'UTC', 'Mon DD, HH12:MI AM'))
    END,
    'quote_accepted',
    'job',
    v_quote.job_id,
    jsonb_build_object(
      'accepted_job_id', v_quote.job_id,
      'accepted_quote_id', p_quote_id,
      'contract_id', v_contract_id,
      'expired_quote_ids', v_expired_quote_ids,
      'expired_count', v_expired_count,
      'scheduled_start_at', v_booking_start,
      'scheduled_end_at', v_booking_end
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract_id,
    'total_cents', v_total_customer_cents,
    'mechanic_id', v_quote.mechanic_id,
    'mechanic_promo_applied', COALESCE((v_mechanic_promo_result->>'has_credit')::boolean, false),
    'mechanic_promo_discount_cents', COALESCE((v_mechanic_promo_result->>'discount_cents')::int, 0),
    'expired_quote_ids', v_expired_quote_ids,
    'expired_count', v_expired_count,
    'scheduled_start_at', v_booking_start,
    'scheduled_end_at', v_booking_end
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.accept_quote_and_resolve_conflicts(uuid, uuid) TO authenticated;

-- =====================================================
-- K) Update accept_quote_and_create_contract to call new function
-- =====================================================
-- Keep backward compatibility by making old function call new one
CREATE OR REPLACE FUNCTION public.accept_quote_and_create_contract(
  p_quote_id uuid,
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.accept_quote_and_resolve_conflicts(p_quote_id, p_customer_id);
END;
$$;

COMMIT;
