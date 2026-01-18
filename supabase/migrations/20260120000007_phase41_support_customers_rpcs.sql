-- =====================================================
-- PHASE 4.1: Schema-aligned Admin Support & Customer RPCs
-- =====================================================

-- =====================================================
-- A) SUPPORT REQUESTS — DROP OLD, CREATE NEW
-- =====================================================

DROP FUNCTION IF EXISTS public.admin_get_support_requests(text, int, int);

-- A.1) admin_list_support_requests - enriched list with user info
CREATE OR REPLACE FUNCTION public.admin_list_support_requests(
  p_status text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  support_request_id uuid,
  status text,
  category text,
  message text,
  created_at timestamptz,
  user_id uuid,
  user_name text,
  user_role text,
  user_phone text,
  user_email text,
  job_id uuid,
  hub_id uuid,
  has_screenshot boolean,
  last_updated_at timestamptz
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
    sr.id as support_request_id,
    sr.status::text,
    sr.category::text,
    sr.message::text,
    sr.created_at,
    sr.user_id,
    COALESCE(p.full_name, p.display_name, 'Unknown')::text as user_name,
    COALESCE(p.role::text, 'customer') as user_role,
    COALESCE(p.phone, '')::text as user_phone,
    COALESCE(p.email, '')::text as user_email,
    sr.job_id,
    p.hub_id,
    (sr.screenshot_url IS NOT NULL) as has_screenshot,
    sr.updated_at as last_updated_at
  FROM public.support_requests sr
  LEFT JOIN public.profiles p ON p.id = sr.user_id
  WHERE (p_status IS NULL OR sr.status = p_status)
    AND (p_category IS NULL OR sr.category = p_category)
  ORDER BY sr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_support_requests(text, text, int, int) TO authenticated;

-- A.2) admin_get_support_request_details - full detail with job context
CREATE OR REPLACE FUNCTION public.admin_get_support_request_details(
  p_support_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sr record;
  v_user jsonb;
  v_job jsonb;
  v_contract jsonb;
  v_payments jsonb;
  v_payouts jsonb;
  v_disputes jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  -- Get support request
  SELECT * INTO v_sr FROM public.support_requests WHERE id = p_support_request_id;
  IF v_sr IS NULL THEN
    RETURN jsonb_build_object('error', 'Support request not found');
  END IF;

  -- Get user profile
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', COALESCE(p.full_name, p.display_name, 'Unknown'),
    'phone', COALESCE(p.phone, ''),
    'email', COALESCE(p.email, ''),
    'role', COALESCE(p.role::text, 'customer'),
    'city', COALESCE(p.city, ''),
    'state', COALESCE(p.state, ''),
    'hub_id', p.hub_id,
    'created_at', p.created_at
  ) INTO v_user
  FROM public.profiles p
  WHERE p.id = v_sr.user_id;

  -- Get job if exists
  IF v_sr.job_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', j.id,
      'title', COALESCE(j.title, 'Untitled Job'),
      'status', j.status::text,
      'created_at', j.created_at,
      'location_address', COALESCE(j.location_address, ''),
      'symptom_key', j.symptom_key,
      'accepted_mechanic_id', j.accepted_mechanic_id,
      'customer_id', j.customer_id
    ) INTO v_job
    FROM public.jobs j
    WHERE j.id = v_sr.job_id;

    -- Get contract if exists
    SELECT jsonb_build_object(
      'id', jc.id,
      'status', jc.status::text,
      'quoted_price_cents', COALESCE(jc.final_total_cents, 0),
      'stripe_payment_intent_id', jc.stripe_payment_intent_id,
      'accepted_at', jc.accepted_at,
      'completed_at', jc.completed_at
    ) INTO v_contract
    FROM public.job_contracts jc
    WHERE jc.job_id = v_sr.job_id
    LIMIT 1;

    -- Get payments
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', pay.id,
      'status', pay.status::text,
      'amount_cents', COALESCE(pay.amount_cents, 0),
      'paid_at', pay.paid_at,
      'refunded_at', pay.refunded_at
    )), '[]'::jsonb) INTO v_payments
    FROM public.payments pay
    WHERE pay.job_id = v_sr.job_id;

    -- Get payouts
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', po.id,
      'status', po.status::text,
      'net_amount_cents', COALESCE(po.net_amount_cents, 0),
      'held_at', po.held_at,
      'hold_reason', po.hold_reason
    )), '[]'::jsonb) INTO v_payouts
    FROM public.payouts po
    WHERE po.job_id = v_sr.job_id;

    -- Get disputes
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', d.id,
      'status', d.status::text,
      'category', d.category,
      'created_at', d.created_at,
      'resolved_at', d.resolved_at
    )), '[]'::jsonb) INTO v_disputes
    FROM public.disputes d
    WHERE d.job_id = v_sr.job_id;
  ELSE
    v_job := NULL;
    v_contract := NULL;
    v_payments := '[]'::jsonb;
    v_payouts := '[]'::jsonb;
    v_disputes := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'support_request', jsonb_build_object(
      'id', v_sr.id,
      'user_id', v_sr.user_id,
      'job_id', v_sr.job_id,
      'category', v_sr.category,
      'message', v_sr.message,
      'screenshot_url', v_sr.screenshot_url,
      'status', v_sr.status,
      'metadata', COALESCE(v_sr.metadata, '{}'::jsonb),
      'created_at', v_sr.created_at,
      'updated_at', v_sr.updated_at
    ),
    'user', COALESCE(v_user, '{}'::jsonb),
    'job', v_job,
    'contract', v_contract,
    'payments', v_payments,
    'payouts', v_payouts,
    'disputes', v_disputes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_support_request_details(uuid) TO authenticated;

-- A.3) admin_update_support_request_status - update with audit logging
CREATE OR REPLACE FUNCTION public.admin_update_support_request_status(
  p_support_request_id uuid,
  p_status text,
  p_internal_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_metadata jsonb;
  v_notes jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT status, COALESCE(metadata, '{}'::jsonb)
  INTO v_old_status, v_metadata
  FROM public.support_requests
  WHERE id = p_support_request_id;

  IF v_old_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Support request not found');
  END IF;

  -- Append note to metadata->admin_notes array if provided
  IF p_internal_note IS NOT NULL THEN
    v_notes := COALESCE(v_metadata->'admin_notes', '[]'::jsonb);
    v_notes := v_notes || jsonb_build_array(jsonb_build_object(
      'note', p_internal_note,
      'by', auth.uid(),
      'at', now()
    ));
    v_metadata := v_metadata || jsonb_build_object('admin_notes', v_notes);
  END IF;

  UPDATE public.support_requests
  SET 
    status = p_status,
    metadata = v_metadata,
    updated_at = now()
  WHERE id = p_support_request_id;

  -- Write to audit_log
  PERFORM public.admin_audit_log(
    'ADMIN_UPDATE_SUPPORT_STATUS',
    'support_requests',
    p_support_request_id,
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_status,
      'note', p_internal_note
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_support_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_support_request_status(uuid, text, text) TO authenticated;

-- =====================================================
-- B) CUSTOMERS — NEW RPCs
-- =====================================================

-- B.1) admin_list_customers - list with stats
CREATE OR REPLACE FUNCTION public.admin_list_customers(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_query text DEFAULT NULL
)
RETURNS TABLE (
  customer_id uuid,
  full_name text,
  email text,
  phone text,
  city text,
  state text,
  hub_id uuid,
  created_at timestamptz,
  total_jobs bigint,
  completed_jobs bigint,
  total_spent_cents bigint
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
    p.id as customer_id,
    COALESCE(p.full_name, p.display_name, 'Unknown')::text as full_name,
    COALESCE(p.email, '')::text as email,
    COALESCE(p.phone, '')::text as phone,
    COALESCE(p.city, '')::text as city,
    COALESCE(p.state, '')::text as state,
    p.hub_id,
    p.created_at,
    COALESCE((SELECT COUNT(*) FROM public.jobs j WHERE j.customer_id = p.id), 0) as total_jobs,
    COALESCE((SELECT COUNT(*) FROM public.jobs j WHERE j.customer_id = p.id AND j.status = 'completed'), 0) as completed_jobs,
    COALESCE((SELECT SUM(pay.amount_cents) FROM public.payments pay 
              JOIN public.jobs j ON j.id = pay.job_id 
              WHERE j.customer_id = p.id AND pay.paid_at IS NOT NULL), 0) as total_spent_cents
  FROM public.profiles p
  WHERE p.role = 'customer'
    AND (p_query IS NULL 
         OR p.full_name ILIKE '%' || p_query || '%'
         OR p.display_name ILIKE '%' || p_query || '%'
         OR p.email ILIKE '%' || p_query || '%'
         OR p.phone ILIKE '%' || p_query || '%')
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_customers(int, int, text) TO authenticated;

-- B.2) admin_get_customer_details - full customer details with history
CREATE OR REPLACE FUNCTION public.admin_get_customer_details(
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile jsonb;
  v_jobs jsonb;
  v_payments jsonb;
  v_support jsonb;
  v_disputes jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  -- Get profile
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', COALESCE(p.full_name, p.display_name, 'Unknown'),
    'email', COALESCE(p.email, ''),
    'phone', COALESCE(p.phone, ''),
    'role', COALESCE(p.role::text, 'customer'),
    'city', COALESCE(p.city, ''),
    'state', COALESCE(p.state, ''),
    'hub_id', p.hub_id,
    'avatar_url', p.avatar_url,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_customer_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('error', 'Customer not found');
  END IF;

  -- Get last 20 jobs
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', j.id,
    'title', COALESCE(j.title, 'Untitled Job'),
    'status', j.status::text,
    'created_at', j.created_at,
    'accepted_mechanic_id', j.accepted_mechanic_id,
    'completed_at', j.completed_at
  ) ORDER BY j.created_at DESC), '[]'::jsonb) INTO v_jobs
  FROM (
    SELECT * FROM public.jobs
    WHERE customer_id = p_customer_id
    ORDER BY created_at DESC
    LIMIT 20
  ) j;

  -- Get last 20 payments
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pay.id,
    'job_id', pay.job_id,
    'amount_cents', pay.amount_cents,
    'status', pay.status::text,
    'paid_at', pay.paid_at,
    'refunded_at', pay.refunded_at
  ) ORDER BY pay.created_at DESC), '[]'::jsonb) INTO v_payments
  FROM (
    SELECT pay.* FROM public.payments pay
    JOIN public.jobs j ON j.id = pay.job_id
    WHERE j.customer_id = p_customer_id
    ORDER BY pay.created_at DESC
    LIMIT 20
  ) pay;

  -- Get last 10 support requests
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', sr.id,
    'category', sr.category,
    'message', sr.message,
    'status', sr.status,
    'created_at', sr.created_at
  ) ORDER BY sr.created_at DESC), '[]'::jsonb) INTO v_support
  FROM (
    SELECT * FROM public.support_requests
    WHERE user_id = p_customer_id
    ORDER BY created_at DESC
    LIMIT 10
  ) sr;

  -- Get last 10 disputes involving this customer
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'job_id', d.job_id,
    'category', d.category,
    'status', d.status::text,
    'created_at', d.created_at,
    'resolved_at', d.resolved_at
  ) ORDER BY d.created_at DESC), '[]'::jsonb) INTO v_disputes
  FROM (
    SELECT d.* FROM public.disputes d
    JOIN public.jobs j ON j.id = d.job_id
    WHERE j.customer_id = p_customer_id
    ORDER BY d.created_at DESC
    LIMIT 10
  ) d;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'jobs', v_jobs,
    'payments', v_payments,
    'support_requests', v_support,
    'disputes', v_disputes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_customer_details(uuid) TO authenticated;

-- =====================================================
-- C) RLS for support_requests - ensure users can see own, admin can see all
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS support_requests_select_own ON public.support_requests;
DROP POLICY IF EXISTS support_requests_insert_own ON public.support_requests;
DROP POLICY IF EXISTS support_requests_update_admin ON public.support_requests;

-- Users can see their own support requests
CREATE POLICY support_requests_select_own ON public.support_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Users can insert their own support requests
CREATE POLICY support_requests_insert_own ON public.support_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only admin can update support requests
CREATE POLICY support_requests_update_admin ON public.support_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin());
