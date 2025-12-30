-- ============================================================================
-- COMBINED CANCELLATION MIGRATIONS
-- Run this script in Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Add Cancellation Fields
-- File: 20240105000000_add_cancellation_fields.sql
-- ============================================================================

-- Add cancellation fields to quote_requests table
ALTER TABLE quote_requests
ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
ADD COLUMN IF NOT EXISTS canceled_by text CHECK (canceled_by IN ('customer', 'mechanic', 'system')),
ADD COLUMN IF NOT EXISTS cancel_reason text,
ADD COLUMN IF NOT EXISTS cancel_note text,
ADD COLUMN IF NOT EXISTS cancellation_fee_cents integer DEFAULT 0;

-- Add cancellation fields to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
ADD COLUMN IF NOT EXISTS canceled_by text CHECK (canceled_by IN ('customer', 'mechanic', 'system'));

-- Update quote_requests status enum to include cancellation statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'quote_status'
    AND e.enumlabel = 'canceled_by_customer'
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'canceled_by_customer';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'quote_status'
    AND e.enumlabel = 'canceled_by_mechanic'
  ) THEN
    ALTER TYPE quote_status ADD VALUE 'canceled_by_mechanic';
  END IF;
END $$;

-- Update jobs status enum to include canceled status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'job_status' 
    AND e.enumlabel = 'canceled'
  ) THEN
    ALTER TYPE job_status ADD VALUE 'canceled';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quote_requests_canceled_at ON quote_requests(canceled_at);
CREATE INDEX IF NOT EXISTS idx_quote_requests_canceled_by ON quote_requests(canceled_by);
CREATE INDEX IF NOT EXISTS idx_jobs_canceled_at ON jobs(canceled_at);

-- Add comments for documentation
COMMENT ON COLUMN quote_requests.accepted_at IS 'Timestamp when quote was accepted by customer (for time-protection calculations)';
COMMENT ON COLUMN quote_requests.canceled_at IS 'Timestamp when quote was canceled';
COMMENT ON COLUMN quote_requests.canceled_by IS 'Who canceled: customer, mechanic, or system';
COMMENT ON COLUMN quote_requests.cancel_reason IS 'Reason for cancellation (predefined options)';
COMMENT ON COLUMN quote_requests.cancel_note IS 'Optional additional note from canceling party';
COMMENT ON COLUMN quote_requests.cancellation_fee_cents IS 'Fee charged for cancellation (in cents)';

-- ============================================================================
-- MIGRATION 2: Create Cancel Quote RPC Function
-- File: 20240106000000_create_cancel_quote_function.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_quote_by_customer(
  p_quote_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_job_id uuid;
  v_job_status text;
  v_quote_status text;
  v_accepted_at timestamptz;
  v_minutes_since_acceptance numeric;
  v_fee_cents integer := 0;
  v_now timestamptz := now();
BEGIN
  -- Get current user ID
  v_customer_id := auth.uid();
  
  IF v_customer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate reason
  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN json_build_object('success', false, 'error', 'Cancellation reason is required');
  END IF;

  IF p_reason NOT IN (
    'found_other_mechanic',
    'issue_resolved',
    'wrong_vehicle',
    'too_expensive',
    'scheduled_conflict',
    'other'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid cancellation reason');
  END IF;

  -- If reason is "other", note is required
  IF p_reason = 'other' AND (p_note IS NULL OR p_note = '') THEN
    RETURN json_build_object('success', false, 'error', 'Note is required when reason is "other"');
  END IF;

  -- Get quote and job details
  SELECT 
    qr.job_id,
    qr.status,
    qr.accepted_at,
    j.status,
    j.customer_id
  INTO
    v_job_id,
    v_quote_status,
    v_accepted_at,
    v_job_status,
    v_customer_id
  FROM quote_requests qr
  JOIN jobs j ON j.id = qr.job_id
  WHERE qr.id = p_quote_id;

  -- Check if quote exists
  IF v_job_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Quote not found');
  END IF;

  -- Verify caller is the job's customer
  IF v_customer_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'You can only cancel your own quotes');
  END IF;

  -- Check if quote is already canceled
  IF v_quote_status IN ('canceled_by_customer', 'canceled_by_mechanic') THEN
    RETURN json_build_object('success', false, 'error', 'This quote is already canceled');
  END IF;

  -- Check if job is completed
  IF v_job_status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot cancel a completed job');
  END IF;

  -- Check if job is already canceled
  IF v_job_status = 'canceled' THEN
    RETURN json_build_object('success', false, 'error', 'This job is already canceled');
  END IF;

  -- Calculate time since acceptance
  IF v_accepted_at IS NOT NULL THEN
    v_minutes_since_acceptance := EXTRACT(EPOCH FROM (v_now - v_accepted_at)) / 60;
  ELSE
    v_minutes_since_acceptance := 0;
  END IF;

  -- Apply time-protection rules
  IF v_minutes_since_acceptance <= 5 THEN
    -- Free cancellation within 5 minutes
    v_fee_cents := 0;
  ELSIF v_job_status = 'in_progress' THEN
    -- Higher fee if mechanic has started work
    v_fee_cents := 2500; -- $25
  ELSIF v_minutes_since_acceptance > 5 THEN
    -- Standard fee after 5 minutes
    v_fee_cents := 1500; -- $15
  ELSE
    -- Default: no fee
    v_fee_cents := 0;
  END IF;

  -- Update quote_requests table
  UPDATE quote_requests
  SET
    status = 'canceled_by_customer',
    canceled_at = v_now,
    canceled_by = 'customer',
    cancel_reason = p_reason,
    cancel_note = p_note,
    cancellation_fee_cents = v_fee_cents,
    updated_at = v_now
  WHERE id = p_quote_id;

  -- Update jobs table if this was the accepted quote
  IF v_quote_status = 'accepted' OR v_job_status IN ('accepted', 'in_progress') THEN
    UPDATE jobs
    SET
      status = 'canceled',
      canceled_at = v_now,
      canceled_by = 'customer',
      updated_at = v_now
    WHERE id = v_job_id;
  END IF;

  -- Return success with fee info
  RETURN json_build_object(
    'success', true,
    'fee_cents', v_fee_cents,
    'message', CASE
      WHEN v_fee_cents = 0 THEN 'Job canceled successfully (no fee)'
      ELSE 'Job canceled successfully (fee: $' || (v_fee_cents / 100.0)::text || ')'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'An error occurred: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cancel_quote_by_customer(uuid, text, text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION cancel_quote_by_customer IS 'Allows customers to cancel accepted quotes with time-protection rules';

-- ============================================================================
-- MIGRATION 3: Update RLS Policies for Cancellation
-- File: 20240107000000_update_cancellation_rls.sql
-- ============================================================================

-- Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Customers can cancel their own quotes via RPC" ON quote_requests;
DROP POLICY IF EXISTS "Customers cannot directly update cancellation fields" ON quote_requests;
DROP POLICY IF EXISTS "Mechanics can read cancellation info" ON quote_requests;

-- Policy: Customers can only cancel via RPC function (not direct updates)
-- This is enforced by the RPC function's SECURITY DEFINER
-- We just need to ensure SELECT access for the RPC to work

-- Policy: Allow customers to read their own quote cancellation info
CREATE POLICY "Customers can read cancellation info on their quotes"
ON quote_requests
FOR SELECT
TO authenticated
USING (
  job_id IN (
    SELECT id FROM jobs WHERE customer_id = auth.uid()
  )
);

-- Policy: Allow mechanics to read cancellation info on their quotes
CREATE POLICY "Mechanics can read cancellation info on their quotes"
ON quote_requests
FOR SELECT
TO authenticated
USING (
  mechanic_id = auth.uid()
);

-- Policy: Prevent direct updates to cancellation fields (must use RPC)
CREATE POLICY "Cancellation fields can only be updated via RPC"
ON quote_requests
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Policy: Allow customers to read their canceled jobs
CREATE POLICY "Customers can read their canceled jobs"
ON jobs
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
);

-- Policy: Allow mechanics to read canceled jobs they were assigned to
CREATE POLICY "Mechanics can read canceled jobs they were assigned to"
ON jobs
FOR SELECT
TO authenticated
USING (
  accepted_mechanic_id = auth.uid()
);

-- Add comments
COMMENT ON POLICY "Customers can read cancellation info on their quotes" ON quote_requests IS 'Allows customers to view cancellation details on their own quotes';
COMMENT ON POLICY "Mechanics can read cancellation info on their quotes" ON quote_requests IS 'Allows mechanics to view cancellation details on quotes they sent';
COMMENT ON POLICY "Cancellation fields can only be updated via RPC" ON quote_requests IS 'Prevents direct updates to cancellation fields - must use cancel_quote_by_customer function';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify columns were added
DO $$
BEGIN
  RAISE NOTICE 'Verifying quote_requests columns...';
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_requests' 
    AND column_name = 'accepted_at'
  ) THEN
    RAISE NOTICE '✓ accepted_at column exists';
  ELSE
    RAISE WARNING '✗ accepted_at column missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quote_requests' 
    AND column_name = 'canceled_at'
  ) THEN
    RAISE NOTICE '✓ canceled_at column exists';
  ELSE
    RAISE WARNING '✗ canceled_at column missing';
  END IF;

  RAISE NOTICE 'Verifying RPC function...';
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'cancel_quote_by_customer'
  ) THEN
    RAISE NOTICE '✓ cancel_quote_by_customer function exists';
  ELSE
    RAISE WARNING '✗ cancel_quote_by_customer function missing';
  END IF;

  RAISE NOTICE 'Migration complete!';
END $$;
