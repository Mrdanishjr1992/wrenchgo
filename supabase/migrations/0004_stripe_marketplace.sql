-- =====================================================
-- MIGRATION 0004: STRIPE MARKETPLACE
-- =====================================================
-- Purpose: Stripe Connect functions for mechanic payouts
-- Depends on: 0003_functions_triggers.sql
-- =====================================================

BEGIN;

-- =====================================================
-- FUNCTION: create_stripe_connect_account
-- Creates or retrieves Stripe Connect account for mechanic
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_stripe_connect_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mechanic_profile_exists boolean;
  existing_account text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.mechanic_profiles WHERE id = auth.uid()
  ) INTO mechanic_profile_exists;
  
  IF NOT mechanic_profile_exists THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (auth.uid(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  SELECT stripe_account_id INTO existing_account
  FROM public.mechanic_stripe_accounts
  WHERE mechanic_id = auth.uid();
  
  IF existing_account IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'account_id', existing_account,
      'is_new', false
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'account_id', null,
    'is_new', true,
    'message', 'Ready to create new Stripe account'
  );
END;
$$;

-- =====================================================
-- FUNCTION: save_stripe_account
-- Saves Stripe account ID after creation
-- =====================================================
CREATE OR REPLACE FUNCTION public.save_stripe_account(
  p_stripe_account_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mechanic_stripe_accounts (
    mechanic_id,
    stripe_account_id,
    created_at,
    updated_at
  )
  VALUES (
    auth.uid(),
    p_stripe_account_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (mechanic_id) 
  DO UPDATE SET 
    stripe_account_id = p_stripe_account_id,
    updated_at = NOW();
  
  UPDATE public.mechanic_profiles
  SET stripe_account_id = p_stripe_account_id, updated_at = NOW()
  WHERE id = auth.uid();
  
  RETURN json_build_object('success', true);
END;
$$;

-- =====================================================
-- FUNCTION: update_stripe_account_status
-- Updates Stripe account status after webhook
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_stripe_account_status(
  p_stripe_account_id text,
  p_charges_enabled boolean,
  p_payouts_enabled boolean,
  p_onboarding_complete boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mechanic_stripe_accounts
  SET 
    charges_enabled = p_charges_enabled,
    payouts_enabled = p_payouts_enabled,
    onboarding_complete = p_onboarding_complete,
    updated_at = NOW()
  WHERE stripe_account_id = p_stripe_account_id;
  
  UPDATE public.mechanic_profiles
  SET 
    stripe_onboarding_complete = p_onboarding_complete,
    updated_at = NOW()
  WHERE stripe_account_id = p_stripe_account_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- =====================================================
-- FUNCTION: get_stripe_account_status
-- Gets current Stripe account status for mechanic
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_stripe_account_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'has_account', msa.stripe_account_id IS NOT NULL,
    'stripe_account_id', msa.stripe_account_id,
    'onboarding_complete', COALESCE(msa.onboarding_complete, false),
    'charges_enabled', COALESCE(msa.charges_enabled, false),
    'payouts_enabled', COALESCE(msa.payouts_enabled, false)
  ) INTO result
  FROM public.mechanic_profiles mp
  LEFT JOIN public.mechanic_stripe_accounts msa ON msa.mechanic_id = mp.id
  WHERE mp.id = auth.uid();
  
  IF result IS NULL THEN
    RETURN json_build_object(
      'has_account', false,
      'stripe_account_id', null,
      'onboarding_complete', false,
      'charges_enabled', false,
      'payouts_enabled', false
    );
  END IF;
  
  RETURN result;
END;
$$;

-- =====================================================
-- FUNCTION: create_payment_intent
-- Creates a payment record for a job
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_job_id uuid,
  p_amount_cents int,
  p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_payment_id uuid;
  v_platform_fee int;
BEGIN
  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id AND customer_id = auth.uid();
  
  IF v_job IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Job not found or not authorized');
  END IF;
  
  IF v_job.accepted_mechanic_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No mechanic assigned to job');
  END IF;
  
  v_platform_fee := (p_amount_cents * 0.15)::int;
  
  INSERT INTO public.payments (
    job_id,
    customer_id,
    mechanic_id,
    stripe_payment_intent_id,
    amount_cents,
    platform_fee_cents,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_job_id,
    auth.uid(),
    v_job.accepted_mechanic_id,
    p_stripe_payment_intent_id,
    p_amount_cents,
    v_platform_fee,
    'pending',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_payment_id;
  
  RETURN json_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'amount_cents', p_amount_cents,
    'platform_fee_cents', v_platform_fee
  );
END;
$$;

-- =====================================================
-- FUNCTION: update_payment_status
-- Updates payment status (called by webhook)
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_payment_status(
  p_stripe_payment_intent_id text,
  p_status public.payment_status,
  p_paid_at timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payments
  SET 
    status = p_status,
    paid_at = COALESCE(p_paid_at, paid_at),
    updated_at = NOW()
  WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;
  
  IF p_status = 'succeeded' THEN
    UPDATE public.jobs
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = (
      SELECT job_id FROM public.payments 
      WHERE stripe_payment_intent_id = p_stripe_payment_intent_id
    );
  END IF;
  
  RETURN json_build_object('success', true);
END;
$$;

COMMIT;
