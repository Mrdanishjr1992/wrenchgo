-- =====================================================
-- MIGRATION 0128: Admin Customer RPCs
-- =====================================================

BEGIN;

-- =====================================================
-- Admin List Customers RPC
-- =====================================================

CREATE OR REPLACE FUNCTION admin_list_customers(
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS customer_id,
    p.full_name,
    p.email,
    p.phone,
    p.city,
    p.state,
    p.hub_id,
    p.created_at,
    COUNT(j.id) AS total_jobs,
    COUNT(j.id) FILTER (WHERE j.status = 'completed') AS completed_jobs,
    COALESCE(SUM(pay.amount_cents) FILTER (WHERE pay.status = 'paid'), 0)::bigint AS total_spent_cents
  FROM profiles p
  LEFT JOIN jobs j ON j.customer_id = p.id
  LEFT JOIN payments pay ON pay.job_id = j.id
  WHERE p.role = 'customer'
    AND p.deleted_at IS NULL
    AND (
      p_query IS NULL 
      OR p.full_name ILIKE '%' || p_query || '%'
      OR p.email ILIKE '%' || p_query || '%'
      OR p.phone ILIKE '%' || p_query || '%'
    )
  GROUP BY p.id
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- Admin Get Customer Details RPC
-- =====================================================

CREATE OR REPLACE FUNCTION admin_get_customer_details(p_customer_id uuid)
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
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Access denied: admin only');
  END IF;

  -- Get profile
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'email', p.email,
    'phone', p.phone,
    'role', p.role::text,
    'city', p.city,
    'state', p.state,
    'hub_id', p.hub_id,
    'avatar_url', p.avatar_url,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) INTO v_profile
  FROM profiles p
  WHERE p.id = p_customer_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('error', 'Customer not found');
  END IF;

  -- Get jobs
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', j.id,
      'title', j.title,
      'status', j.status::text,
      'created_at', j.created_at,
      'accepted_mechanic_id', j.accepted_mechanic_id,
      'completed_at', j.completed_at
    ) ORDER BY j.created_at DESC
  ), '[]'::jsonb) INTO v_jobs
  FROM jobs j
  WHERE j.customer_id = p_customer_id;

  -- Get payments
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pay.id,
      'job_id', pay.job_id,
      'amount_cents', pay.amount_cents,
      'status', pay.status,
      'paid_at', pay.paid_at,
      'refunded_at', pay.refunded_at
    ) ORDER BY pay.created_at DESC
  ), '[]'::jsonb) INTO v_payments
  FROM payments pay
  JOIN jobs j ON j.id = pay.job_id
  WHERE j.customer_id = p_customer_id;

  -- Get support requests
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sr.id,
      'category', sr.category,
      'message', sr.message,
      'status', sr.status,
      'created_at', sr.created_at
    ) ORDER BY sr.created_at DESC
  ), '[]'::jsonb) INTO v_support
  FROM support_requests sr
  WHERE sr.user_id = p_customer_id;

  -- Get disputes
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'job_id', d.job_id,
      'category', d.category,
      'status', d.status,
      'created_at', d.created_at,
      'resolved_at', d.resolved_at
    ) ORDER BY d.created_at DESC
  ), '[]'::jsonb) INTO v_disputes
  FROM disputes d
  JOIN jobs j ON j.id = d.job_id
  WHERE j.customer_id = p_customer_id;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'jobs', v_jobs,
    'payments', v_payments,
    'support_requests', v_support,
    'disputes', v_disputes
  );
END;
$$;

-- =====================================================
-- Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION admin_list_customers TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_customer_details TO authenticated;

COMMIT;
