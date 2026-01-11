-- =====================================================
-- MIGRATION 0030: PAYMENT METHOD RLS ENFORCEMENT
-- =====================================================
-- Adds RLS policies to enforce payment method requirement
-- for restricted actions (job creation, quote submission)
-- =====================================================

BEGIN;

-- =====================================================
-- RLS POLICY: Jobs - Customers need payment to create
-- =====================================================
DROP POLICY IF EXISTS "jobs_insert_customer_with_payment" ON public.jobs;
CREATE POLICY "jobs_insert_customer_with_payment" ON public.jobs
  FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND payment_method_status = 'active'
    )
  );

-- Drop old insert policy if exists
DROP POLICY IF EXISTS "jobs_insert_customer" ON public.jobs;
DROP POLICY IF EXISTS "Customers can insert their own jobs" ON public.jobs;

-- =====================================================
-- RLS POLICY: Quotes - Mechanics need payment to submit
-- =====================================================
DROP POLICY IF EXISTS "quotes_insert_mechanic_with_payment" ON public.quotes;
CREATE POLICY "quotes_insert_mechanic_with_payment" ON public.quotes
  FOR INSERT
  WITH CHECK (
    auth.uid() = mechanic_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND payment_method_status = 'active'
    )
  );

-- Drop old insert policy if exists
DROP POLICY IF EXISTS "quotes_insert_mechanic" ON public.quotes;
DROP POLICY IF EXISTS "Mechanics can insert quotes" ON public.quotes;

-- =====================================================
-- RPC: submit_quote_with_payment_check
-- =====================================================
-- Server-side quote submission with payment enforcement
-- =====================================================
CREATE OR REPLACE FUNCTION public.submit_quote_with_payment_check(
  p_job_id uuid,
  p_price_cents int,
  p_estimated_hours numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_id uuid;
  v_payment_status payment_method_status;
  v_quote_id uuid;
BEGIN
  v_mechanic_id := auth.uid();
  
  IF v_mechanic_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHENTICATED');
  END IF;

  SELECT payment_method_status INTO v_payment_status
  FROM profiles WHERE id = v_mechanic_id;

  IF v_payment_status IS NULL OR v_payment_status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PAYMENT_METHOD_REQUIRED',
      'message', 'A valid payment method is required to submit quotes'
    );
  END IF;

  INSERT INTO quotes (job_id, mechanic_id, price_cents, estimated_hours, notes, status)
  VALUES (p_job_id, v_mechanic_id, p_price_cents, p_estimated_hours, p_notes, 'pending')
  RETURNING id INTO v_quote_id;

  RETURN jsonb_build_object('success', true, 'quote_id', v_quote_id);
END;
$$;

-- =====================================================
-- RPC: create_job_with_payment_check
-- =====================================================
-- Server-side job creation with payment enforcement
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_job_with_payment_check(
  p_title text,
  p_description text DEFAULT NULL,
  p_location_address text DEFAULT NULL,
  p_location_lat double precision DEFAULT NULL,
  p_location_lng double precision DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_payment_status payment_method_status;
  v_job_id uuid;
BEGIN
  v_customer_id := auth.uid();
  
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHENTICATED');
  END IF;

  SELECT payment_method_status INTO v_payment_status
  FROM profiles WHERE id = v_customer_id;

  IF v_payment_status IS NULL OR v_payment_status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PAYMENT_METHOD_REQUIRED',
      'message', 'A valid payment method is required to request service'
    );
  END IF;

  INSERT INTO jobs (customer_id, title, description, location_address, location_lat, location_lng, vehicle_id, status)
  VALUES (v_customer_id, p_title, p_description, p_location_address, p_location_lat, p_location_lng, p_vehicle_id, 'searching')
  RETURNING id INTO v_job_id;

  RETURN jsonb_build_object('success', true, 'job_id', v_job_id);
END;
$$;

-- =====================================================
-- GRANTS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.submit_quote_with_payment_check(uuid, int, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_job_with_payment_check(text, text, text, double precision, double precision, uuid) TO authenticated;

COMMIT;