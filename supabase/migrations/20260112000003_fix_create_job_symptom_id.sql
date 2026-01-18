-- Fix: symptoms table uses 'key' as PK, not 'id'
-- The symptom_id should come from symptom_mappings table which has 'id'

BEGIN;

CREATE OR REPLACE FUNCTION public.create_job_with_payment_check(
  p_title text,
  p_description text DEFAULT NULL,
  p_location_address text DEFAULT NULL,
  p_location_lat double precision DEFAULT NULL,
  p_location_lng double precision DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL,
  p_preferred_time text DEFAULT NULL,
  p_symptom_key text DEFAULT NULL,
  p_symptom_id uuid DEFAULT NULL
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
  v_symptom_id uuid;
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

  -- Look up symptom_id from symptom_mappings using symptom_key
  v_symptom_id := p_symptom_id;
  IF v_symptom_id IS NULL AND p_symptom_key IS NOT NULL THEN
    SELECT id INTO v_symptom_id FROM symptom_mappings WHERE symptom_key = p_symptom_key LIMIT 1;
  END IF;

  INSERT INTO jobs (customer_id, title, description, location_address, location_lat, location_lng, vehicle_id, preferred_time, symptom_key, symptom_id, status)
  VALUES (v_customer_id, p_title, p_description, p_location_address, p_location_lat, p_location_lng, p_vehicle_id, p_preferred_time, p_symptom_key, v_symptom_id, 'searching')
  RETURNING id INTO v_job_id;

  RETURN jsonb_build_object('success', true, 'job_id', v_job_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_job_with_payment_check(text, text, text, double precision, double precision, uuid, text, text, uuid) TO authenticated;

COMMIT;
