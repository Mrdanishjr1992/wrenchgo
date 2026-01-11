-- =====================================================
-- MIGRATION 0029: PAYMENT METHOD ENFORCEMENT
-- =====================================================
-- Adds payment_method_status to profiles and creates
-- server-side enforcement for restricted actions
-- =====================================================

BEGIN;

-- =====================================================
-- ENUM: payment_method_status
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.payment_method_status AS ENUM (
    'none',
    'pending',
    'active',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- ADD payment_method_status TO profiles
-- =====================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS payment_method_status public.payment_method_status DEFAULT 'none' NOT NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE;

-- =====================================================
-- FUNCTION: assert_payment_ready
-- =====================================================
-- Server-side check that user has active payment method
-- Returns error if not ready, otherwise returns success
-- =====================================================
CREATE OR REPLACE FUNCTION public.assert_payment_ready(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status payment_method_status;
BEGIN
  SELECT payment_method_status INTO v_status
  FROM profiles
  WHERE id = p_user_id;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'USER_NOT_FOUND',
      'message', 'User profile not found'
    );
  END IF;

  IF v_status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PAYMENT_METHOD_REQUIRED',
      'message', 'A valid payment method is required to perform this action',
      'current_status', v_status::text
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'PAYMENT_READY',
    'message', 'Payment method is active'
  );
END;
$$;

-- =====================================================
-- FUNCTION: check_payment_ready (for RLS policies)
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_payment_ready(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status payment_method_status;
BEGIN
  SELECT payment_method_status INTO v_status
  FROM profiles
  WHERE id = p_user_id;

  RETURN v_status = 'active';
END;
$$;

-- =====================================================
-- FUNCTION: set_payment_method_status
-- =====================================================
-- Called by webhook to update payment status
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_payment_method_status(
  p_user_id uuid,
  p_status text,
  p_stripe_customer_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET 
    payment_method_status = p_status::payment_method_status,
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

-- =====================================================
-- GRANTS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.assert_payment_ready(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_payment_ready(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_payment_ready(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_payment_ready(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_payment_method_status(uuid, text, text) TO service_role;

COMMIT;