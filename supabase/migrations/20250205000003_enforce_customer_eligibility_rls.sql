-- =====================================================
-- ENFORCE CUSTOMER ELIGIBILITY IN RLS POLICIES
-- =====================================================
-- Purpose: Block job creation and quote acceptance unless customer is eligible
-- =====================================================

DROP POLICY IF EXISTS "Customers can insert their own jobs" ON public.jobs;
CREATE POLICY "Customers can insert their own jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND (
      SELECT (check_customer_eligibility(auth.uid())->>'eligible')::boolean
    )
  );

DROP POLICY IF EXISTS "Customers can update quotes for their jobs" ON public.quote_requests;
CREATE POLICY "Customers can update quotes for their jobs"
  ON public.quote_requests FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (
    customer_id = auth.uid()
    AND (
      status = 'pending'
      OR (
        status = 'accepted'
        AND (SELECT (check_customer_eligibility(auth.uid())->>'eligible')::boolean)
      )
    )
  );

COMMENT ON POLICY "Customers can insert their own jobs" ON public.jobs IS 'Customers must have ID verified and payment method on file to create jobs';
COMMENT ON POLICY "Customers can update quotes for their jobs" ON public.quote_requests IS 'Customers must have ID verified and payment method on file to accept quotes';
