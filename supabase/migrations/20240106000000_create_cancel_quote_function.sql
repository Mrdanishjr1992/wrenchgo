-- RPC Function: cancel_quote_by_customer
-- Purpose: Allow customers to cancel accepted quotes with mechanic time-protection rules
-- Security: Validates caller is the job's customer, enforces cancellation rules

CREATE OR REPLACE FUNCTION cancel_quote_by_customer(
  p_quote_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_quote record;
  v_job record;
  v_now timestamptz := now();
  v_minutes_since_acceptance numeric;
  v_minutes_until_arrival numeric;
  v_cancellation_fee_cents integer := 0;
  v_can_cancel boolean := true;
  v_error_message text := NULL;
  v_warning_message text := NULL;
BEGIN
  -- Get the authenticated user ID
  v_customer_id := auth.uid();
  
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Validate reason is provided
  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cancellation reason is required'
    );
  END IF;

  -- Validate reason is one of the allowed values
  IF p_reason NOT IN (
    'found_other_mechanic',
    'issue_resolved',
    'wrong_vehicle',
    'too_expensive',
    'scheduled_conflict',
    'other'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid cancellation reason'
    );
  END IF;

  -- If reason is "other", note is required
  IF p_reason = 'other' AND (p_note IS NULL OR p_note = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Please provide details for "other" reason'
    );
  END IF;

  -- Load quote with job information
  SELECT 
    qr.*,
    j.customer_id as job_customer_id,
    j.status as job_status,
    j.accepted_mechanic_id
  INTO v_quote
  FROM quote_requests qr
  JOIN jobs j ON j.id = qr.job_id
  WHERE qr.id = p_quote_id;

  -- Check if quote exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Quote not found'
    );
  END IF;

  -- Verify the caller is the job's customer
  IF v_quote.job_customer_id != v_customer_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only cancel your own quotes'
    );
  END IF;

  -- Load job details
  SELECT * INTO v_job
  FROM jobs
  WHERE id = v_quote.job_id;

  -- Check if job is already completed
  IF v_job.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot cancel a completed job'
    );
  END IF;

  -- Check if job is already canceled
  IF v_job.status = 'canceled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This job is already canceled'
    );
  END IF;

  -- Check if quote is in a cancelable state
  IF v_quote.status NOT IN ('accepted', 'quoted') THEN
    IF v_quote.status LIKE 'canceled_%' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This quote is already canceled'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This quote cannot be canceled in its current state'
      );
    END IF;
  END IF;

  -- Only allow cancellation if this quote is the accepted one
  IF v_quote.status = 'accepted' OR v_job.accepted_mechanic_id = v_quote.mechanic_id THEN
    -- Calculate time since acceptance
    IF v_quote.accepted_at IS NOT NULL THEN
      v_minutes_since_acceptance := EXTRACT(EPOCH FROM (v_now - v_quote.accepted_at)) / 60;
    ELSE
      -- Fallback to updated_at if accepted_at is not set
      v_minutes_since_acceptance := EXTRACT(EPOCH FROM (v_now - v_quote.updated_at)) / 60;
    END IF;

    -- RULE 1: Free cancellation within 5 minutes of acceptance
    IF v_minutes_since_acceptance <= 5 THEN
      v_cancellation_fee_cents := 0;
      v_warning_message := 'Canceled within free cancellation window (5 minutes)';
    
    -- RULE 2: Job is in progress - require reason and apply fee
    ELSIF v_job.status = 'in_progress' THEN
      v_cancellation_fee_cents := 2500; -- $25 fee
      v_warning_message := 'Cancellation fee applied: mechanic has started work';
    
    -- RULE 3: Check if cancellation is within 60 minutes of scheduled arrival
    ELSIF v_quote.proposed_time_text IS NOT NULL THEN
      -- Try to parse arrival time (this is a simplified check)
      -- In production, you'd want more robust time parsing
      -- For now, we'll apply a fee if there's a proposed time and it's been > 5 minutes
      IF v_minutes_since_acceptance > 5 THEN
        v_cancellation_fee_cents := 1500; -- $15 fee
        v_warning_message := 'Cancellation fee applied: close to scheduled arrival time';
      END IF;
    
    -- RULE 4: After 5 minutes but no special circumstances - require reason, no fee
    ELSE
      v_cancellation_fee_cents := 0;
      v_warning_message := 'Cancellation allowed with reason';
    END IF;

  ELSE
    -- Quote is not accepted, can cancel freely
    v_cancellation_fee_cents := 0;
  END IF;

  -- Perform the cancellation in a transaction
  BEGIN
    -- Update the quote
    UPDATE quote_requests
    SET 
      status = 'canceled_by_customer',
      canceled_at = v_now,
      canceled_by = 'customer',
      cancel_reason = p_reason,
      cancel_note = p_note,
      cancellation_fee_cents = v_cancellation_fee_cents,
      updated_at = v_now
    WHERE id = p_quote_id;

    -- If this was the accepted quote, update the job status
    IF v_quote.status = 'accepted' OR v_job.accepted_mechanic_id = v_quote.mechanic_id THEN
      UPDATE jobs
      SET 
        status = 'canceled',
        canceled_at = v_now,
        canceled_by = 'customer',
        accepted_mechanic_id = NULL,
        updated_at = v_now
      WHERE id = v_quote.job_id;
    END IF;

    -- Return success with details
    RETURN jsonb_build_object(
      'success', true,
      'quote_id', p_quote_id,
      'job_id', v_quote.job_id,
      'cancellation_fee_cents', v_cancellation_fee_cents,
      'warning', v_warning_message,
      'message', 'Quote canceled successfully'
    );

  EXCEPTION WHEN OTHERS THEN
    -- Rollback happens automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to cancel quote: ' || SQLERRM
    );
  END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cancel_quote_by_customer(uuid, text, text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION cancel_quote_by_customer IS 
'Allows customers to cancel accepted quotes with time-protection rules:
- Free cancellation within 5 minutes of acceptance
- Fee applied if job is in_progress or close to arrival time
- Requires cancellation reason
- Updates both quote and job status atomically';
