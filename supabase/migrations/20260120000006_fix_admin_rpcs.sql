-- Fix admin RPC type mismatches and column references

-- 1. Fix admin_get_jobs (varchar to text casting)
DROP FUNCTION IF EXISTS public.admin_get_jobs(text, uuid, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_jobs(
  p_status text DEFAULT NULL,
  p_hub_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  customer_id uuid,
  customer_name text,
  mechanic_id uuid,
  mechanic_name text,
  hub_id uuid,
  hub_name text,
  created_at timestamptz,
  completed_at timestamptz,
  quote_count bigint,
  has_dispute boolean,
  has_support_ticket boolean
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
    j.id,
    j.title::text,
    j.status::text,
    j.customer_id,
    pc.full_name::text as customer_name,
    jc.mechanic_id,
    pm.full_name::text as mechanic_name,
    j.hub_id,
    h.name::text as hub_name,
    j.created_at,
    j.completed_at,
    (SELECT COUNT(*) FROM public.quotes q WHERE q.job_id = j.id) as quote_count,
    EXISTS(SELECT 1 FROM public.disputes d WHERE d.job_id = j.id) as has_dispute,
    EXISTS(SELECT 1 FROM public.support_requests sr WHERE sr.job_id = j.id) as has_support_ticket
  FROM public.jobs j
  JOIN public.profiles pc ON pc.id = j.customer_id
  LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
  LEFT JOIN public.profiles pm ON pm.id = jc.mechanic_id
  LEFT JOIN public.service_hubs h ON h.id = j.hub_id
  WHERE (p_status IS NULL OR j.status::text = p_status)
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id)
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_jobs(text, uuid, int, int) TO authenticated;

-- 2. Fix admin_get_job_detail (remove non-existent columns)
DROP FUNCTION IF EXISTS public.admin_get_job_detail(uuid);

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
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  -- Job with customer info (removed service_type, urgency - may not exist)
  SELECT jsonb_build_object(
    'id', j.id,
    'title', j.title::text,
    'description', j.description::text,
    'status', j.status::text,
    'customer_id', j.customer_id,
    'customer_name', pc.full_name::text,
    'customer_email', pc.email::text,
    'hub_id', j.hub_id,
    'location_lat', j.location_lat,
    'location_lng', j.location_lng,
    'location_address', j.location_address::text,
    'vehicle_year', COALESCE(v.year, j.vehicle_year),
    'vehicle_make', COALESCE(v.make, j.vehicle_make)::text,
    'vehicle_model', COALESCE(v.model, j.vehicle_model)::text,
    'created_at', j.created_at,
    'scheduled_at', j.scheduled_at,
    'started_at', j.started_at,
    'completed_at', j.completed_at
  ) INTO v_job
  FROM public.jobs j
  JOIN public.profiles pc ON pc.id = j.customer_id
  LEFT JOIN public.vehicles v ON v.id = j.vehicle_id
  WHERE j.id = p_job_id;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Quotes
  SELECT jsonb_agg(jsonb_build_object(
    'id', q.id,
    'mechanic_id', q.mechanic_id,
    'mechanic_name', pm.full_name::text,
    'status', q.status::text,
    'total_cents', COALESCE(q.total_cents, 0),
    'eta_minutes', COALESCE(q.eta_minutes, 0),
    'created_at', q.created_at
  ) ORDER BY q.created_at DESC)
  INTO v_quotes
  FROM public.quotes q
  JOIN public.profiles pm ON pm.id = q.mechanic_id
  WHERE q.job_id = p_job_id;

  -- Contract
  SELECT jsonb_build_object(
    'id', jc.id,
    'mechanic_id', jc.mechanic_id,
    'mechanic_name', pm.full_name::text,
    'status', jc.status::text,
    'accepted_at', jc.accepted_at,
    'started_at', jc.started_at,
    'completed_at', jc.completed_at,
    'final_total_cents', COALESCE(jc.final_total_cents, 0)
  ) INTO v_contract
  FROM public.job_contracts jc
  JOIN public.profiles pm ON pm.id = jc.mechanic_id
  WHERE jc.job_id = p_job_id
  LIMIT 1;

  -- Events (last 50)
  SELECT jsonb_agg(jsonb_build_object(
    'id', je.id,
    'event_type', je.event_type::text,
    'actor_id', je.actor_id,
    'actor_role', je.actor_role::text,
    'metadata', je.metadata,
    'created_at', je.created_at
  ) ORDER BY je.created_at DESC)
  INTO v_events
  FROM (
    SELECT * FROM public.job_events WHERE job_id = p_job_id ORDER BY created_at DESC LIMIT 50
  ) je;

  -- Disputes
  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'status', d.status::text,
    'category', d.category::text,
    'priority', d.priority::text,
    'created_at', d.created_at,
    'resolved_at', d.resolved_at
  ) ORDER BY d.created_at DESC)
  INTO v_disputes
  FROM public.disputes d WHERE d.job_id = p_job_id;

  -- Support requests
  SELECT jsonb_agg(jsonb_build_object(
    'id', sr.id,
    'status', sr.status::text,
    'category', sr.category::text,
    'message', sr.message::text,
    'created_at', sr.created_at,
    'updated_at', sr.updated_at
  ) ORDER BY sr.created_at DESC)
  INTO v_support
  FROM public.support_requests sr WHERE sr.job_id = p_job_id;

  -- Payments
  SELECT jsonb_agg(jsonb_build_object(
    'id', p.id,
    'status', p.status::text,
    'amount_cents', COALESCE(p.amount_cents, 0),
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

-- 3. Fix admin_get_mechanics (remove non-existent strikes and hub_id columns)
DROP FUNCTION IF EXISTS public.admin_get_mechanics(text, uuid, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_mechanics(
  p_status text DEFAULT NULL,
  p_hub_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  verification_status text,
  tier text,
  strikes int,
  hub_id uuid,
  hub_name text,
  rating_avg numeric,
  completed_jobs bigint,
  created_at timestamptz
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
    mp.id,
    p.full_name::text,
    p.email::text,
    p.phone::text,
    mp.verification_status::text,
    mp.tier::text,
    0 as strikes,
    p.hub_id,
    h.name::text as hub_name,
    mp.rating_avg,
    (SELECT COUNT(*) FROM public.job_contracts jc
     JOIN public.jobs j ON j.id = jc.job_id
     WHERE jc.mechanic_id = mp.id AND j.status = 'completed') as completed_jobs,
    mp.created_at
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON p.id = mp.id
  LEFT JOIN public.service_hubs h ON h.id = p.hub_id
  WHERE (p_status IS NULL OR mp.verification_status::text = p_status)
    AND (p_hub_id IS NULL OR p.hub_id = p_hub_id)
  ORDER BY mp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_mechanics(text, uuid, int, int) TO authenticated;

-- 4. Fix admin_get_mechanic_detail (remove non-existent columns)
DROP FUNCTION IF EXISTS public.admin_get_mechanic_detail(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_mechanic_detail(p_mechanic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic jsonb;
  v_jobs jsonb;
  v_reviews jsonb;
  v_payouts jsonb;
  v_disputes jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  -- Mechanic profile with user info
  SELECT jsonb_build_object(
    'id', mp.id,
    'full_name', p.full_name::text,
    'email', p.email::text,
    'phone', p.phone::text,
    'verification_status', mp.verification_status::text,
    'tier', mp.tier::text,
    'strikes', 0,
    'hub_id', p.hub_id,
    'hub_name', h.name::text,
    'rating_avg', mp.rating_avg,
    'rating_count', COALESCE(mp.rating_count, 0),
    'bio', mp.bio::text,
    'specialties', mp.specialties,
    'created_at', mp.created_at,
    'verified_at', mp.verified_at
  ) INTO v_mechanic
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON p.id = mp.id
  LEFT JOIN public.service_hubs h ON h.id = p.hub_id
  WHERE mp.id = p_mechanic_id;

  IF v_mechanic IS NULL THEN
    RETURN jsonb_build_object('error', 'Mechanic not found');
  END IF;

  -- Recent jobs (last 20)
  SELECT jsonb_agg(jsonb_build_object(
    'id', j.id,
    'title', j.title::text,
    'status', j.status::text,
    'customer_name', pc.full_name::text,
    'created_at', j.created_at,
    'completed_at', j.completed_at
  ) ORDER BY j.created_at DESC)
  INTO v_jobs
  FROM (
    SELECT j.* FROM public.jobs j
    JOIN public.job_contracts jc ON jc.job_id = j.id
    WHERE jc.mechanic_id = p_mechanic_id
    ORDER BY j.created_at DESC
    LIMIT 20
  ) j
  JOIN public.profiles pc ON pc.id = j.customer_id;

  -- Reviews
  SELECT jsonb_agg(jsonb_build_object(
    'id', r.id,
    'rating', r.rating,
    'comment', r.comment::text,
    'reviewer_name', pr.full_name::text,
    'created_at', r.created_at
  ) ORDER BY r.created_at DESC)
  INTO v_reviews
  FROM public.reviews r
  JOIN public.profiles pr ON pr.id = r.reviewer_id
  WHERE r.reviewee_id = p_mechanic_id
  LIMIT 20;

  -- Payouts
  SELECT jsonb_agg(jsonb_build_object(
    'id', po.id,
    'status', po.status::text,
    'net_amount_cents', COALESCE(po.net_amount_cents, 0),
    'created_at', po.created_at
  ) ORDER BY po.created_at DESC)
  INTO v_payouts
  FROM public.payouts po
  WHERE po.mechanic_id = p_mechanic_id
  LIMIT 20;

  -- Disputes
  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'status', d.status::text,
    'category', d.category::text,
    'created_at', d.created_at,
    'resolved_at', d.resolved_at
  ) ORDER BY d.created_at DESC)
  INTO v_disputes
  FROM public.disputes d
  JOIN public.job_contracts jc ON jc.job_id = d.job_id
  WHERE jc.mechanic_id = p_mechanic_id
  LIMIT 20;

  RETURN jsonb_build_object(
    'mechanic', v_mechanic,
    'jobs', COALESCE(v_jobs, '[]'::jsonb),
    'reviews', COALESCE(v_reviews, '[]'::jsonb),
    'payouts', COALESCE(v_payouts, '[]'::jsonb),
    'disputes', COALESCE(v_disputes, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_mechanic_detail(uuid) TO authenticated;