-- Migration: Add cancellation fields to quotes and jobs tables
-- Purpose: Support customer quote cancellation with mechanic time-protection

-- ============================================================================
-- 1. Add cancellation fields to quote_requests table
-- ============================================================================

ALTER TABLE quote_requests
ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
ADD COLUMN IF NOT EXISTS canceled_by text CHECK (canceled_by IN ('customer', 'mechanic', 'system')),
ADD COLUMN IF NOT EXISTS cancel_reason text,
ADD COLUMN IF NOT EXISTS cancel_note text,
ADD COLUMN IF NOT EXISTS cancellation_fee_cents integer CHECK (cancellation_fee_cents >= 0),
ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- Create index for faster cancellation queries
CREATE INDEX IF NOT EXISTS idx_quote_requests_canceled_at ON quote_requests(canceled_at) WHERE canceled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_requests_accepted_at ON quote_requests(accepted_at) WHERE accepted_at IS NOT NULL;

-- Backfill accepted_at for existing accepted quotes (use updated_at as proxy)
UPDATE quote_requests
SET accepted_at = updated_at
WHERE status = 'accepted' AND accepted_at IS NULL;

-- ============================================================================
-- 2. Add cancellation fields to jobs table
-- ============================================================================

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
ADD COLUMN IF NOT EXISTS canceled_by text CHECK (canceled_by IN ('customer', 'mechanic', 'system'));

-- Create index for faster cancellation queries
CREATE INDEX IF NOT EXISTS idx_jobs_canceled_at ON jobs(canceled_at) WHERE canceled_at IS NOT NULL;

-- ============================================================================
-- 3. Update quote_requests status enum to include cancellation statuses
-- ============================================================================

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

-- ============================================================================
-- 3. Update quote_requests status enum to include cancellation statuses
-- ============================================================================

-- Drop existing check constraint if it exists
ALTER TABLE quote_requests DROP CONSTRAINT IF EXISTS quote_requests_status_check;

-- Note: We rely on the quote_status enum type, not a CHECK constraint
-- The enum already has the values we need from the DO blocks above

-- ============================================================================
-- 4. Update jobs status enum to include canceled
-- ============================================================================

-- Drop existing check constraint if it exists
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- Note: We rely on the job_status enum type, not a CHECK constraint
-- The enum already has the values we need

-- ============================================================================
-- 5. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN quote_requests.canceled_at IS 'Timestamp when the quote was canceled';
COMMENT ON COLUMN quote_requests.canceled_by IS 'Who canceled the quote: customer, mechanic, or system';
COMMENT ON COLUMN quote_requests.cancel_reason IS 'Reason code for cancellation (e.g., found_other_mechanic, issue_resolved)';
COMMENT ON COLUMN quote_requests.cancel_note IS 'Optional free-text note explaining cancellation';
COMMENT ON COLUMN quote_requests.cancellation_fee_cents IS 'Cancellation fee in cents (if applicable based on timing rules)';
COMMENT ON COLUMN quote_requests.accepted_at IS 'Timestamp when the quote was accepted (for time-protection calculations)';

COMMENT ON COLUMN jobs.canceled_at IS 'Timestamp when the job was canceled';
COMMENT ON COLUMN jobs.canceled_by IS 'Who canceled the job: customer, mechanic, or system';
