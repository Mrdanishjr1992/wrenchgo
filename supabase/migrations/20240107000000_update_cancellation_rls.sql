-- RLS Policies: Update security for cancellation fields
-- Purpose: Ensure customers can only cancel their own quotes, mechanics can read cancellation info

-- ============================================================================
-- 1. Update quote_requests RLS policies for cancellation
-- ============================================================================

-- Drop existing policies if they exist (to recreate with cancellation support)
DROP POLICY IF EXISTS "Customers can update their own quote requests" ON quote_requests;
DROP POLICY IF EXISTS "Mechanics can update their own quote requests" ON quote_requests;

-- Customers can update quotes for their own jobs (but NOT cancellation fields directly)
-- Cancellation must go through the RPC function
CREATE POLICY "Customers can update their own quote requests"
ON quote_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs
    WHERE jobs.id = quote_requests.job_id
    AND jobs.customer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM jobs
    WHERE jobs.id = quote_requests.job_id
    AND jobs.customer_id = auth.uid()
  )
  -- Prevent direct updates to cancellation fields (must use RPC)
  AND (
    canceled_at IS NULL OR canceled_at = (SELECT canceled_at FROM quote_requests WHERE id = quote_requests.id)
  )
);

-- Mechanics can update their own quotes (but NOT customer cancellation fields)
CREATE POLICY "Mechanics can update their own quote requests"
ON quote_requests
FOR UPDATE
TO authenticated
USING (mechanic_id = auth.uid())
WITH CHECK (
  mechanic_id = auth.uid()
  -- Mechanics cannot modify customer cancellation fields
  AND (
    canceled_by IS NULL 
    OR canceled_by != 'customer'
    OR canceled_by = (SELECT canceled_by FROM quote_requests WHERE id = quote_requests.id)
  )
);

-- ============================================================================
-- 2. Ensure customers and mechanics can READ cancellation info
-- ============================================================================

-- Customers can read quotes for their jobs (including cancellation info)
DROP POLICY IF EXISTS "Customers can view quotes for their jobs" ON quote_requests;
CREATE POLICY "Customers can view quotes for their jobs"
ON quote_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs
    WHERE jobs.id = quote_requests.job_id
    AND jobs.customer_id = auth.uid()
  )
);

-- Mechanics can read their own quotes (including cancellation info)
DROP POLICY IF EXISTS "Mechanics can view their own quotes" ON quote_requests;
CREATE POLICY "Mechanics can view their own quotes"
ON quote_requests
FOR SELECT
TO authenticated
USING (mechanic_id = auth.uid());

-- ============================================================================
-- 3. Update jobs RLS policies for cancellation
-- ============================================================================

-- Drop existing update policy
DROP POLICY IF EXISTS "Customers can update their own jobs" ON jobs;

-- Customers can update their own jobs (but NOT cancellation fields directly)
CREATE POLICY "Customers can update their own jobs"
ON jobs
FOR UPDATE
TO authenticated
USING (customer_id = auth.uid())
WITH CHECK (
  customer_id = auth.uid()
  -- Prevent direct updates to cancellation fields (must use RPC)
  AND (
    canceled_at IS NULL OR canceled_at = (SELECT canceled_at FROM jobs WHERE id = jobs.id)
  )
);

-- ============================================================================
-- 4. Add policy comments for documentation
-- ============================================================================

COMMENT ON POLICY "Customers can update their own quote requests" ON quote_requests IS
'Allows customers to update quotes for their jobs, but prevents direct modification of cancellation fields (must use cancel_quote_by_customer RPC)';

COMMENT ON POLICY "Mechanics can update their own quote requests" ON quote_requests IS
'Allows mechanics to update their quotes, but prevents modification of customer cancellation fields';

COMMENT ON POLICY "Customers can view quotes for their jobs" ON quote_requests IS
'Allows customers to view all quotes for their jobs, including cancellation information';

COMMENT ON POLICY "Mechanics can view their own quotes" ON quote_requests IS
'Allows mechanics to view their quotes, including cancellation information when canceled by customer';

COMMENT ON POLICY "Customers can update their own jobs" ON jobs IS
'Allows customers to update their jobs, but prevents direct modification of cancellation fields (must use cancel_quote_by_customer RPC)';
