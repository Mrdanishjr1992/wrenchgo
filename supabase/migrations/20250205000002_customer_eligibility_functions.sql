-- =====================================================
-- CUSTOMER ELIGIBILITY CHECKS
-- =====================================================
-- Purpose: Enforce customer requirements before quote actions
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_customer_eligibility(customer_auth_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id uuid;
  v_id_verified boolean;
  v_has_payment_method boolean;
  v_result jsonb;
BEGIN
  SELECT id, COALESCE(id_verified, false)
  INTO v_profile_id, v_id_verified
  FROM public.profiles
  WHERE auth_id = customer_auth_id AND role = 'customer';

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'id_verified', false,
      'has_payment_method', false,
      'missing', jsonb_build_array('profile')
    );
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.customer_payment_methods
    WHERE customer_id = v_profile_id
    LIMIT 1
  ) INTO v_has_payment_method;

  v_result := jsonb_build_object(
    'eligible', v_id_verified AND v_has_payment_method,
    'id_verified', v_id_verified,
    'has_payment_method', v_has_payment_method,
    'missing', jsonb_build_array()
  );

  IF NOT v_id_verified THEN
    v_result := jsonb_set(
      v_result,
      '{missing}',
      (v_result->'missing')::jsonb || '["id_verification"]'::jsonb
    );
  END IF;

  IF NOT v_has_payment_method THEN
    v_result := jsonb_set(
      v_result,
      '{missing}',
      (v_result->'missing')::jsonb || '["payment_method"]'::jsonb
    );
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_id_verified()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE auth_id = auth.uid();

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  UPDATE public.profiles
  SET 
    id_verified = true,
    id_verified_at = now(),
    updated_at = now()
  WHERE id = v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_customer_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_id_verified() TO authenticated;
