-- Fix admin RPC schema mismatches

-- 1. Fix admin_get_payments (remove contract_id reference)
DROP FUNCTION IF EXISTS public.admin_get_payments(text, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_payments(
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  job_title text,
  customer_id uuid,
  customer_name text,
  mechanic_id uuid,
  mechanic_name text,
  amount_cents int,
  status text,
  created_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    pay.id,
    pay.job_id,
    j.title as job_title,
    pay.customer_id,
    pc.full_name as customer_name,
    pay.mechanic_id,
    pm.full_name as mechanic_name,
    pay.amount_cents,
    pay.status::text,
    pay.created_at,
    pay.paid_at,
    pay.refunded_at
  FROM public.payments pay
  JOIN public.jobs j ON j.id = pay.job_id
  JOIN public.profiles pc ON pc.id = pay.customer_id
  LEFT JOIN public.profiles pm ON pm.id = pay.mechanic_id
  WHERE (p_status IS NULL OR pay.status::text = p_status)
  ORDER BY pay.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_payments(text, int, int) TO authenticated;

-- 2. Fix admin_get_payouts (use net_amount_cents, remove payout_method)
DROP FUNCTION IF EXISTS public.admin_get_payouts(text, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_payouts(
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  mechanic_id uuid,
  mechanic_name text,
  gross_amount_cents int,
  net_amount_cents int,
  commission_cents int,
  status text,
  created_at timestamptz,
  processed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    po.id,
    po.mechanic_id,
    p.full_name as mechanic_name,
    po.gross_amount_cents,
    po.net_amount_cents,
    po.commission_cents,
    po.status::text,
    po.created_at,
    po.processed_at
  FROM public.payouts po
  JOIN public.profiles p ON p.id = po.mechanic_id
  WHERE (p_status IS NULL OR po.status::text = p_status)
  ORDER BY po.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_payouts(text, int, int) TO authenticated;

-- 3. Fix admin_get_job_detail (fix support_requests fields: message instead of subject, updated_at instead of resolved_at)
CREATE OR REPLACE FUNCTION public.admin_get_job_detail(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jsonb;
  v_quotes jsonb;
  v_contract jsonb;
  v_events jsonb;
  v_disputes jsonb;
  v_support jsonb;
  v_payments jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', j.id,
    'title', j.title,
    'description', j.description,
    'status', j.status,
    'customer_id', j.customer_id,
    'customer_name', pc.full_name,
    'customer_email', pc.email,
    'location_lat', j.location_lat,
    'location_lng', j.location_lng,
    'location_address', j.location_address,
    'vehicle_year', v.year,
    'vehicle_make', v.make,
    'vehicle_model', v.model,
    'created_at', j.created_at,
    'scheduled_at', j.scheduled_at,
    'completed_at', j.completed_at
  )
  INTO v_job
  FROM public.jobs j
  JOIN public.profiles pc ON pc.id = j.customer_id
  LEFT JOIN public.vehicles v ON v.id = j.vehicle_id
  WHERE j.id = p_job_id;

  IF v_job IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', q.id,
    'mechanic_id', q.mechanic_id,
    'mechanic_name', pm.full_name,
    'status', q.status,
    'labor_cents', COALESCE((q.line_items_json->0->>'labor_cents')::int, 0),
    'parts_cents', COALESCE((q.line_items_json->0->>'parts_cents')::int, 0),
    'total_cents', q.total_cents,
    'eta_minutes', q.eta_minutes,
    'created_at', q.created_at
  ) ORDER BY q.created_at DESC)
  INTO v_quotes
  FROM public.quotes q
  JOIN public.profiles pm ON pm.id = q.mechanic_id
  WHERE q.job_id = p_job_id;

  SELECT jsonb_build_object(
    'id', jc.id,
    'mechanic_id', jc.mechanic_id,
    'mechanic_name', pm.full_name,
    'status', jc.status,
    'accepted_at', jc.accepted_at,
    'started_at', jc.started_at,
    'completed_at', jc.completed_at,
    'final_labor_cents', jc.final_labor_cents,
    'final_parts_cents', jc.final_parts_cents,
    'final_total_cents', jc.final_total_cents
  )
  INTO v_contract
  FROM public.job_contracts jc
  JOIN public.profiles pm ON pm.id = jc.mechanic_id
  WHERE jc.job_id = p_job_id
  LIMIT 1;

  SELECT jsonb_agg(jsonb_build_object(
    'id', je.id,
    'event_type', je.event_type,
    'actor_id', je.actor_id,
    'actor_role', je.actor_role,
    'metadata', je.metadata,
    'created_at', je.created_at
  ) ORDER BY je.created_at DESC)
  INTO v_events
  FROM (
    SELECT * FROM public.job_events WHERE job_id = p_job_id ORDER BY created_at DESC LIMIT 50
  ) je;

  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'status', d.status,
    'category', d.category,
    'priority', d.priority,
    'created_at', d.created_at,
    'resolved_at', d.resolved_at
  ) ORDER BY d.created_at DESC)
  INTO v_disputes
  FROM public.disputes d WHERE d.job_id = p_job_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id', sr.id,
    'status', sr.status,
    'category', sr.category,
    'message', sr.message,
    'created_at', sr.created_at,
    'updated_at', sr.updated_at
  ) ORDER BY sr.created_at DESC)
  INTO v_support
  FROM public.support_requests sr WHERE sr.job_id = p_job_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id', p.id,
    'status', p.status,
    'amount_cents', p.amount_cents,
    'created_at', p.created_at,
    'paid_at', p.paid_at,
    'refunded_at', p.refunded_at
  ) ORDER BY p.created_at DESC)
  INTO v_payments
  FROM public.payments p WHERE p.job_id = p_job_id;

  RETURN jsonb_build_object(
    'job', v_job,
    'quotes', COALESCE(v_quotes, '[]'::jsonb),
    'contract', v_contract,
    'events', COALESCE(v_events, '[]'::jsonb),
    'disputes', COALESCE(v_disputes, '[]'::jsonb),
    'support_requests', COALESCE(v_support, '[]'::jsonb),
    'payments', COALESCE(v_payments, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_job_detail(uuid) TO authenticated;