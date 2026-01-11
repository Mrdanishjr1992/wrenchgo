-- =====================================================
-- MIGRATION: Promo Credit Tracking for Jobs
-- =====================================================
-- Adds fields to track promo credits applied to jobs
-- and ensures the discount persists throughout the job lifecycle

BEGIN;

-- Add promo tracking columns to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS applied_promo_credit_id uuid REFERENCES public.promo_credits(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS promo_discount_cents int DEFAULT 0,
ADD COLUMN IF NOT EXISTS promo_credit_type text;

COMMENT ON COLUMN public.jobs.applied_promo_credit_id IS 'Reference to the promo credit used for this job';
COMMENT ON COLUMN public.jobs.promo_discount_cents IS 'Amount of platform fee discount in cents';
COMMENT ON COLUMN public.jobs.promo_credit_type IS 'Type of promo credit applied (FEELESS, FEELESS3)';

-- Add promo tracking columns to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS promo_credit_id uuid REFERENCES public.promo_credits(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS promo_discount_cents int DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_platform_fee_cents int;

COMMENT ON COLUMN public.payments.promo_credit_id IS 'Reference to the promo credit used';
COMMENT ON COLUMN public.payments.promo_discount_cents IS 'Amount discounted from platform fee';
COMMENT ON COLUMN public.payments.original_platform_fee_cents IS 'Original platform fee before discount';

-- Create index for promo credit lookups
CREATE INDEX IF NOT EXISTS idx_jobs_promo_credit ON public.jobs(applied_promo_credit_id) WHERE applied_promo_credit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_promo_credit ON public.payments(promo_credit_id) WHERE promo_credit_id IS NOT NULL;

-- =====================================================
-- FUNCTION: apply_promo_credit_to_job
-- =====================================================
-- Applies a user's available promo credit to a job
-- Returns the discount amount and credit details
CREATE OR REPLACE FUNCTION public.apply_promo_credit_to_job(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_job_customer_id uuid;
  v_credit_id uuid;
  v_credit_type text;
  v_discount_cents int;
  v_platform_fee_cents int := 1500; -- $15 platform fee
BEGIN
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get job and verify ownership
  SELECT customer_id INTO v_job_customer_id
  FROM jobs WHERE id = p_job_id;
  
  IF v_job_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;
  
  IF v_job_customer_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  -- Check if job already has a promo applied
  IF EXISTS (SELECT 1 FROM jobs WHERE id = p_job_id AND applied_promo_credit_id IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job already has a promo credit applied');
  END IF;
  
  -- Find the oldest available promo credit (FIFO)
  -- FEELESS = full fee waiver, FEELESS3 = $3 off
  SELECT id, credit_type::text
  INTO v_credit_id, v_credit_type
  FROM promo_credits
  WHERE user_id = v_user_id
    AND remaining_uses > 0
  ORDER BY 
    CASE WHEN credit_type = 'FEELESS' THEN 0 ELSE 1 END, -- Prefer FEELESS first
    created_at ASC
  LIMIT 1;
  
  IF v_credit_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'has_credit', false,
      'message', 'No promo credits available'
    );
  END IF;
  
  -- Calculate discount based on credit type
  v_discount_cents := CASE 
    WHEN v_credit_type = 'FEELESS' THEN v_platform_fee_cents -- Full fee waiver
    WHEN v_credit_type = 'FEELESS3' THEN 300 -- $3 off
    ELSE 0
  END;
  
  -- Decrement the credit
  UPDATE promo_credits
  SET remaining_uses = remaining_uses - 1,
      updated_at = now()
  WHERE id = v_credit_id;
  
  -- Apply to job
  UPDATE jobs
  SET applied_promo_credit_id = v_credit_id,
      promo_discount_cents = v_discount_cents,
      promo_credit_type = v_credit_type,
      updated_at = now()
  WHERE id = p_job_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'has_credit', true,
    'credit_id', v_credit_id,
    'credit_type', v_credit_type,
    'discount_cents', v_discount_cents,
    'message', CASE 
      WHEN v_credit_type = 'FEELESS' THEN 'Platform fee waived!'
      ELSE '$3 discount applied!'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_promo_credit_to_job(uuid) TO authenticated;

-- =====================================================
-- FUNCTION: get_job_promo_info
-- =====================================================
-- Returns promo credit info for a job (for display on invoices)
CREATE OR REPLACE FUNCTION public.get_job_promo_info(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_job record;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT j.id, j.customer_id, j.accepted_mechanic_id,
         j.applied_promo_credit_id, j.promo_discount_cents, j.promo_credit_type
  INTO v_job
  FROM jobs j
  WHERE j.id = p_job_id;
  
  IF v_job IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;
  
  -- Only job participants can view
  IF v_job.customer_id != v_user_id AND v_job.accepted_mechanic_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'has_promo', v_job.applied_promo_credit_id IS NOT NULL,
    'promo_credit_id', v_job.applied_promo_credit_id,
    'discount_cents', COALESCE(v_job.promo_discount_cents, 0),
    'credit_type', v_job.promo_credit_type,
    'discount_description', CASE 
      WHEN v_job.promo_credit_type = 'FEELESS' THEN 'Platform fee waived (referral credit)'
      WHEN v_job.promo_credit_type = 'FEELESS3' THEN '$3 off platform fee (referral credit)'
      ELSE NULL
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_job_promo_info(uuid) TO authenticated;

-- =====================================================
-- FUNCTION: preview_promo_discount (updated)
-- =====================================================
-- Preview what discount would be applied (doesn't consume credit)
CREATE OR REPLACE FUNCTION public.preview_promo_discount(p_platform_fee_cents int DEFAULT 1500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_credit_id uuid;
  v_credit_type text;
  v_discount_cents int;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Find the best available promo credit
  SELECT id, credit_type::text
  INTO v_credit_id, v_credit_type
  FROM promo_credits
  WHERE user_id = v_user_id
    AND remaining_uses > 0
  ORDER BY 
    CASE WHEN credit_type = 'FEELESS' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;
  
  IF v_credit_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_discount', false,
      'credit_type', NULL,
      'discount_cents', 0,
      'fee_after_cents', p_platform_fee_cents,
      'reason', 'No promo credits available'
    );
  END IF;
  
  v_discount_cents := CASE 
    WHEN v_credit_type = 'FEELESS' THEN p_platform_fee_cents
    WHEN v_credit_type = 'FEELESS3' THEN LEAST(300, p_platform_fee_cents)
    ELSE 0
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'has_discount', true,
    'credit_type', v_credit_type,
    'discount_cents', v_discount_cents,
    'fee_after_cents', GREATEST(0, p_platform_fee_cents - v_discount_cents),
    'reason', CASE 
      WHEN v_credit_type = 'FEELESS' THEN 'Referral credit: Free platform fee'
      ELSE 'Referral credit: $3 off platform fee'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_promo_discount(int) TO authenticated;

COMMIT;
