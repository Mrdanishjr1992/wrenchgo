-- Fix FOR UPDATE on LEFT JOIN in cancel_job function

CREATE OR REPLACE FUNCTION cancel_job(
  p_job_id uuid,
  p_cancelled_by uuid,
  p_reason public.cancellation_reason,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
  v_progress RECORD;
  v_refund_amount int;
  v_is_customer boolean;
BEGIN
  -- Get contract (lock it)
  SELECT *
  INTO v_contract
  FROM public.job_contracts
  WHERE job_id = p_job_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  -- Get progress separately (may not exist)
  SELECT * INTO v_progress
  FROM public.job_progress
  WHERE contract_id = v_contract.id;
  
  IF v_contract.status NOT IN ('pending_payment', 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel - job is ' || v_contract.status);
  END IF;
  
  -- Determine if canceller is customer
  v_is_customer := (p_cancelled_by = v_contract.customer_id);
  
  -- Calculate refund based on reason
  CASE p_reason
    WHEN 'customer_before_departure', 'mechanic_before_departure', 'mechanic_no_show' THEN
      v_refund_amount := v_contract.total_customer_cents;
    WHEN 'customer_after_departure' THEN
      v_refund_amount := v_contract.total_customer_cents - 2500;
    WHEN 'customer_after_arrival', 'customer_no_show' THEN
      v_refund_amount := v_contract.total_customer_cents - 2500;
    WHEN 'customer_after_work_started' THEN
      v_refund_amount := 0;
    WHEN 'mutual_agreement', 'platform_intervention' THEN
      v_refund_amount := v_contract.total_customer_cents;
    ELSE
      v_refund_amount := v_contract.total_customer_cents;
  END CASE;
  
  v_refund_amount := GREATEST(v_refund_amount, 0);
  
  -- Update contract
  UPDATE public.job_contracts
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_cancelled_by,
    cancellation_reason = p_reason,
    cancellation_note = p_note,
    refund_amount_cents = v_refund_amount,
    updated_at = now()
  WHERE id = v_contract.id;
  
  -- Update job
  UPDATE public.jobs
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    canceled_by = p_cancelled_by,
    updated_at = now()
  WHERE id = p_job_id;
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'cancelled',
    p_cancelled_by, CASE WHEN v_is_customer THEN 'customer'::public.user_role ELSE 'mechanic'::public.user_role END,
    'Job cancelled',
    COALESCE(p_note, 'Job was cancelled: ' || p_reason::text),
    jsonb_build_object(
      'reason', p_reason,
      'refund_amount_cents', v_refund_amount,
      'cancelled_by_customer', v_is_customer
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'refund_amount_cents', v_refund_amount,
    'contract_id', v_contract.id
  );
END;
$$;