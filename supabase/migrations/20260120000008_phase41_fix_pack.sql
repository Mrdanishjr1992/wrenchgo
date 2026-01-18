-- =====================================================
-- PHASE 4.1 FIX PACK
-- =====================================================
-- Fixes all admin RPCs that reference non-existent columns:
-- - h.city, h.state -> join zip_codes
-- - w.zip_code -> w.zip
-- - mp.specialties, mp.verified_at -> removed
-- - j.vehicle_year/make/model -> vehicles table
-- - r.rating -> r.overall_rating
-- =====================================================

-- =====================================================
-- 1) FIX admin_get_hubs (h.city/state don't exist, use lat/lng not latitude/longitude)
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_get_hubs();

CREATE OR REPLACE FUNCTION public.admin_get_hubs()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  zip text,
  city text,
  state text,
  lat numeric,
  lng numeric,
  active_radius_miles int,
  max_radius_miles int,
  invite_only boolean,
  auto_expand_enabled boolean,
  is_active boolean,
  launch_date date,
  created_at timestamptz,
  active_mechanics bigint,
  jobs_last_14d bigint
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
    h.id,
    h.name::text,
    h.slug::text,
    h.zip::text,
    zc.city::text,
    zc.state::text,
    h.lat::numeric,
    h.lng::numeric,
    h.active_radius_miles::int,
    h.max_radius_miles::int,
    h.invite_only,
    h.auto_expand_enabled,
    h.is_active,
    h.launch_date,
    h.created_at,
    (SELECT COUNT(DISTINCT p.id) 
     FROM public.profiles p
     JOIN public.mechanic_profiles mp ON mp.id = p.id
     WHERE p.hub_id = h.id AND mp.verification_status = 'active') as active_mechanics,
    (SELECT COUNT(*) 
     FROM public.jobs j 
     WHERE j.hub_id = h.id AND j.created_at >= CURRENT_DATE - 14) as jobs_last_14d
  FROM public.service_hubs h
  LEFT JOIN public.zip_codes zc ON zc.zip = h.zip
  ORDER BY h.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_hubs() TO authenticated;

-- =====================================================
-- 2) FIX admin_get_waitlist_heatmap (w.zip_code -> w.zip)
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_get_waitlist_heatmap(uuid, int);

CREATE OR REPLACE FUNCTION public.admin_get_waitlist_heatmap(
  p_hub_id uuid DEFAULT NULL,
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date timestamptz;
  v_by_zip jsonb;
  v_by_hub jsonb;
  v_by_user_type jsonb;
  v_total bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  v_start_date := now() - (p_days || ' days')::interval;

  SELECT COUNT(*) INTO v_total
  FROM public.waitlist w
  WHERE w.created_at >= v_start_date
    AND (p_hub_id IS NULL OR w.nearest_hub_id = p_hub_id);

  SELECT jsonb_agg(sub ORDER BY sub.count DESC)
  INTO v_by_zip
  FROM (
    SELECT 
      w.zip::text as zip,
      zc.city::text as city,
      zc.state::text as state,
      COUNT(*) as count,
      w.nearest_hub_id as hub_id
    FROM public.waitlist w
    LEFT JOIN public.zip_codes zc ON zc.zip = w.zip
    WHERE w.created_at >= v_start_date
      AND (p_hub_id IS NULL OR w.nearest_hub_id = p_hub_id)
    GROUP BY w.zip, zc.city, zc.state, w.nearest_hub_id
    ORDER BY COUNT(*) DESC
    LIMIT 20
  ) sub;

  SELECT jsonb_agg(sub ORDER BY sub.count DESC)
  INTO v_by_hub
  FROM (
    SELECT 
      w.nearest_hub_id as hub_id,
      h.name::text as hub_name,
      COUNT(*) as count
    FROM public.waitlist w
    LEFT JOIN public.service_hubs h ON h.id = w.nearest_hub_id
    WHERE w.created_at >= v_start_date
      AND (p_hub_id IS NULL OR w.nearest_hub_id = p_hub_id)
    GROUP BY w.nearest_hub_id, h.name
    ORDER BY COUNT(*) DESC
  ) sub;

  SELECT jsonb_agg(sub)
  INTO v_by_user_type
  FROM (
    SELECT 
      w.user_type::text,
      COUNT(*) as count
    FROM public.waitlist w
    WHERE w.created_at >= v_start_date
      AND (p_hub_id IS NULL OR w.nearest_hub_id = p_hub_id)
    GROUP BY w.user_type
  ) sub;

  RETURN jsonb_build_object(
    'period_days', p_days,
    'hub_id', p_hub_id,
    'total', v_total,
    'by_zip', COALESCE(v_by_zip, '[]'::jsonb),
    'by_hub', COALESCE(v_by_hub, '[]'::jsonb),
    'by_user_type', COALESCE(v_by_user_type, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_waitlist_heatmap(uuid, int) TO authenticated;

-- =====================================================
-- 3) FIX admin_get_mechanics (already has p.hub_id, add tier column if exists)
-- =====================================================
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
  hub_id uuid,
  hub_name text,
  rating_avg numeric,
  rating_count int,
  jobs_completed int,
  is_available boolean,
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
    COALESCE(mp.tier, 'bronze')::text as tier,
    p.hub_id,
    h.name::text as hub_name,
    mp.rating_avg,
    COALESCE(mp.rating_count, 0)::int,
    COALESCE(mp.jobs_completed, 0)::int,
    mp.is_available,
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

-- =====================================================
-- 4) FIX admin_get_mechanic_detail (remove mp.specialties, mp.verified_at)
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_get_mechanic_detail(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_mechanic_detail(p_mechanic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic jsonb;
  v_docs jsonb;
  v_vetting jsonb;
  v_jobs jsonb;
  v_reviews jsonb;
  v_disputes jsonb;
  v_support jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT jsonb_build_object(
    'id', mp.id,
    'full_name', p.full_name::text,
    'email', p.email::text,
    'phone', p.phone::text,
    'role', p.role::text,
    'city', p.city::text,
    'state', p.state::text,
    'hub_id', p.hub_id,
    'hub_name', h.name::text,
    'verification_status', mp.verification_status::text,
    'verification_reason', mp.verification_reason::text,
    'tier', COALESCE(mp.tier, 'bronze')::text,
    'bio', mp.bio::text,
    'years_experience', mp.years_experience,
    'hourly_rate_cents', mp.hourly_rate_cents,
    'service_radius_km', mp.service_radius_km,
    'mobile_service', mp.mobile_service,
    'is_available', mp.is_available,
    'rating_avg', mp.rating_avg,
    'rating_count', COALESCE(mp.rating_count, 0),
    'jobs_completed', COALESCE(mp.jobs_completed, 0),
    'stripe_account_id', mp.stripe_account_id::text,
    'stripe_onboarding_complete', mp.stripe_onboarding_complete,
    'created_at', mp.created_at,
    'updated_at', mp.updated_at
  ) INTO v_mechanic
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON p.id = mp.id
  LEFT JOIN public.service_hubs h ON h.id = p.hub_id
  WHERE mp.id = p_mechanic_id;

  IF v_mechanic IS NULL THEN
    RETURN jsonb_build_object('error', 'Mechanic not found');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'doc_type', d.doc_type::text,
    'status', d.status::text,
    'uploaded_at', d.uploaded_at,
    'reviewed_at', d.reviewed_at,
    'review_notes', d.review_notes::text
  ) ORDER BY d.uploaded_at DESC)
  INTO v_docs
  FROM public.mechanic_verification_documents d
  WHERE d.mechanic_id = p_mechanic_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id', v.id,
    'question_key', v.question_key::text,
    'answer', v.answer,
    'created_at', v.created_at
  ) ORDER BY v.created_at)
  INTO v_vetting
  FROM public.mechanic_vetting_responses v
  WHERE v.mechanic_id = p_mechanic_id;

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

  SELECT jsonb_agg(jsonb_build_object(
    'id', r.id,
    'overall_rating', r.overall_rating,
    'comment', r.comment::text,
    'reviewer_name', pr.full_name::text,
    'created_at', r.created_at
  ) ORDER BY r.created_at DESC)
  INTO v_reviews
  FROM public.reviews r
  JOIN public.profiles pr ON pr.id = r.reviewer_id
  WHERE r.reviewee_id = p_mechanic_id
  LIMIT 20;

  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'job_id', d.job_id,
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

  SELECT jsonb_agg(jsonb_build_object(
    'id', sr.id,
    'job_id', sr.job_id,
    'category', sr.category::text,
    'status', sr.status::text,
    'message', sr.message::text,
    'created_at', sr.created_at
  ) ORDER BY sr.created_at DESC)
  INTO v_support
  FROM public.support_requests sr
  WHERE sr.user_id = p_mechanic_id
  LIMIT 20;

  RETURN jsonb_build_object(
    'mechanic', v_mechanic,
    'documents', COALESCE(v_docs, '[]'::jsonb),
    'vetting', COALESCE(v_vetting, '[]'::jsonb),
    'jobs', COALESCE(v_jobs, '[]'::jsonb),
    'reviews', COALESCE(v_reviews, '[]'::jsonb),
    'disputes', COALESCE(v_disputes, '[]'::jsonb),
    'support_requests', COALESCE(v_support, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_mechanic_detail(uuid) TO authenticated;

-- =====================================================
-- 5) FIX admin_get_job_detail (vehicle info from vehicles table)
-- =====================================================
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

  SELECT jsonb_build_object(
    'id', j.id,
    'title', j.title::text,
    'description', j.description::text,
    'status', j.status::text,
    'symptom_key', j.symptom_key::text,
    'customer_id', j.customer_id,
    'customer_name', pc.full_name::text,
    'customer_email', pc.email::text,
    'customer_phone', pc.phone::text,
    'hub_id', j.hub_id,
    'hub_name', h.name::text,
    'location_lat', j.location_lat,
    'location_lng', j.location_lng,
    'location_address', j.location_address::text,
    'vehicle_id', j.vehicle_id,
    'vehicle_year', v.year,
    'vehicle_make', v.make::text,
    'vehicle_model', v.model::text,
    'vehicle_nickname', v.nickname::text,
    'preferred_time', j.preferred_time::text,
    'created_at', j.created_at,
    'scheduled_at', j.scheduled_at,
    'completed_at', j.completed_at,
    'cancelled_at', j.cancelled_at
  ) INTO v_job
  FROM public.jobs j
  JOIN public.profiles pc ON pc.id = j.customer_id
  LEFT JOIN public.vehicles v ON v.id = j.vehicle_id
  LEFT JOIN public.service_hubs h ON h.id = j.hub_id
  WHERE j.id = p_job_id;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', q.id,
    'mechanic_id', q.mechanic_id,
    'mechanic_name', pm.full_name::text,
    'status', q.status::text,
    'price_cents', COALESCE(q.price_cents, 0),
    'notes', q.notes::text,
    'created_at', q.created_at
  ) ORDER BY q.created_at DESC)
  INTO v_quotes
  FROM public.quotes q
  JOIN public.profiles pm ON pm.id = q.mechanic_id
  WHERE q.job_id = p_job_id;

  SELECT jsonb_build_object(
    'id', jc.id,
    'mechanic_id', jc.mechanic_id,
    'mechanic_name', pm.full_name::text,
    'status', jc.status::text,
    'quoted_price_cents', COALESCE(jc.quoted_price_cents, 0),
    'final_price_cents', COALESCE(jc.final_price_cents, 0),
    'accepted_at', jc.accepted_at,
    'started_at', jc.started_at,
    'completed_at', jc.completed_at
  ) INTO v_contract
  FROM public.job_contracts jc
  JOIN public.profiles pm ON pm.id = jc.mechanic_id
  WHERE jc.job_id = p_job_id
  LIMIT 1;

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

  SELECT jsonb_agg(jsonb_build_object(
    'id', sr.id,
    'status', sr.status::text,
    'category', sr.category::text,
    'message', sr.message::text,
    'created_at', sr.created_at
  ) ORDER BY sr.created_at DESC)
  INTO v_support
  FROM public.support_requests sr WHERE sr.job_id = p_job_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id', pay.id,
    'status', pay.status::text,
    'amount_cents', COALESCE(pay.amount_cents, 0),
    'created_at', pay.created_at,
    'paid_at', pay.paid_at,
    'refunded_at', pay.refunded_at
  ) ORDER BY pay.created_at DESC)
  INTO v_payments
  FROM public.payments pay WHERE pay.job_id = p_job_id;

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

-- =====================================================
-- 6) SUPPORT REQUESTS - admin_list_support_requests
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_list_support_requests(text, text, int, int);

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
  last_updated_at timestamptz,
  user_id uuid,
  user_name text,
  user_role text,
  user_email text,
  user_phone text,
  job_id uuid,
  hub_id uuid,
  has_screenshot boolean
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
    sr.updated_at as last_updated_at,
    sr.user_id,
    p.full_name::text as user_name,
    p.role::text as user_role,
    p.email::text as user_email,
    p.phone::text as user_phone,
    sr.job_id,
    j.hub_id,
    (sr.screenshot_url IS NOT NULL) as has_screenshot
  FROM public.support_requests sr
  JOIN public.profiles p ON p.id = sr.user_id
  LEFT JOIN public.jobs j ON j.id = sr.job_id
  WHERE (p_status IS NULL OR sr.status::text = p_status)
    AND (p_category IS NULL OR sr.category::text = p_category)
  ORDER BY sr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_support_requests(text, text, int, int) TO authenticated;

-- =====================================================
-- 7) SUPPORT REQUESTS - admin_get_support_request_details
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_get_support_request_details(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_support_request_details(p_support_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request jsonb;
  v_user jsonb;
  v_job jsonb;
  v_contract jsonb;
  v_payments jsonb;
  v_payouts jsonb;
  v_disputes jsonb;
  v_events jsonb;
  v_job_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT jsonb_build_object(
    'id', sr.id,
    'user_id', sr.user_id,
    'job_id', sr.job_id,
    'category', sr.category::text,
    'message', sr.message::text,
    'screenshot_url', sr.screenshot_url::text,
    'status', sr.status::text,
    'metadata', COALESCE(sr.metadata, '{}'::jsonb),
    'created_at', sr.created_at,
    'updated_at', sr.updated_at
  ), sr.job_id
  INTO v_request, v_job_id
  FROM public.support_requests sr
  WHERE sr.id = p_support_request_id;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('error', 'Support request not found');
  END IF;

  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name::text,
    'phone', p.phone::text,
    'email', p.email::text,
    'role', p.role::text,
    'city', p.city::text,
    'state', p.state::text,
    'hub_id', p.hub_id,
    'created_at', p.created_at
  ) INTO v_user
  FROM public.profiles p
  WHERE p.id = (v_request->>'user_id')::uuid;

  IF v_job_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', j.id,
      'title', j.title::text,
      'status', j.status::text,
      'created_at', j.created_at,
      'location_address', j.location_address::text,
      'symptom_key', j.symptom_key::text,
      'accepted_mechanic_id', j.accepted_mechanic_id,
      'customer_id', j.customer_id
    ) INTO v_job
    FROM public.jobs j WHERE j.id = v_job_id;

    SELECT jsonb_build_object(
      'id', jc.id,
      'mechanic_id', jc.mechanic_id,
      'mechanic_name', pm.full_name::text,
      'status', jc.status::text,
      'quoted_price_cents', COALESCE(jc.quoted_price_cents, 0),
      'accepted_at', jc.accepted_at,
      'completed_at', jc.completed_at
    ) INTO v_contract
    FROM public.job_contracts jc
    JOIN public.profiles pm ON pm.id = jc.mechanic_id
    WHERE jc.job_id = v_job_id
    LIMIT 1;

    SELECT jsonb_agg(jsonb_build_object(
      'id', pay.id,
      'status', pay.status::text,
      'amount_cents', COALESCE(pay.amount_cents, 0),
      'paid_at', pay.paid_at,
      'refunded_at', pay.refunded_at
    )) INTO v_payments
    FROM public.payments pay WHERE pay.job_id = v_job_id;

    SELECT jsonb_agg(jsonb_build_object(
      'id', po.id,
      'status', po.status::text,
      'net_amount_cents', COALESCE(po.net_amount_cents, 0),
      'held_at', po.held_at,
      'hold_reason', po.hold_reason::text
    )) INTO v_payouts
    FROM public.payouts po WHERE po.job_id = v_job_id;

    SELECT jsonb_agg(jsonb_build_object(
      'id', d.id,
      'status', d.status::text,
      'category', d.category::text,
      'created_at', d.created_at,
      'resolved_at', d.resolved_at
    )) INTO v_disputes
    FROM public.disputes d WHERE d.job_id = v_job_id;

    SELECT jsonb_agg(jsonb_build_object(
      'id', je.id,
      'event_type', je.event_type::text,
      'actor_role', je.actor_role::text,
      'created_at', je.created_at
    ) ORDER BY je.created_at DESC)
    INTO v_events
    FROM (SELECT * FROM public.job_events WHERE job_id = v_job_id ORDER BY created_at DESC LIMIT 20) je;
  END IF;

  RETURN jsonb_build_object(
    'support_request', v_request,
    'user', v_user,
    'job', v_job,
    'contract', v_contract,
    'payments', COALESCE(v_payments, '[]'::jsonb),
    'payouts', COALESCE(v_payouts, '[]'::jsonb),
    'disputes', COALESCE(v_disputes, '[]'::jsonb),
    'events', COALESCE(v_events, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_support_request_details(uuid) TO authenticated;

-- =====================================================
-- 8) SUPPORT REQUESTS - admin_update_support_request_status
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_update_support_request_status(uuid, text, text);

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
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT status INTO v_old_status FROM public.support_requests WHERE id = p_support_request_id;
  
  IF v_old_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Support request not found');
  END IF;

  UPDATE public.support_requests
  SET status = p_status, updated_at = now()
  WHERE id = p_support_request_id;

  INSERT INTO public.audit_log (actor_id, actor_type, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    'admin',
    'UPDATE_SUPPORT_REQUEST_STATUS',
    'support_request',
    p_support_request_id,
    jsonb_build_object('old_status', v_old_status, 'new_status', p_status, 'note', p_internal_note)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_support_request_status(uuid, text, text) TO authenticated;

-- =====================================================
-- 9) CUSTOMERS - admin_list_customers
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_list_customers(int, int, text);

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
    p.full_name::text,
    p.email::text,
    p.phone::text,
    p.city::text,
    p.state::text,
    p.hub_id,
    p.created_at,
    (SELECT COUNT(*) FROM public.jobs j WHERE j.customer_id = p.id) as total_jobs,
    (SELECT COUNT(*) FROM public.jobs j WHERE j.customer_id = p.id AND j.status = 'completed') as completed_jobs,
    COALESCE((SELECT SUM(pay.amount_cents) FROM public.payments pay 
              JOIN public.jobs j ON j.id = pay.job_id 
              WHERE j.customer_id = p.id AND pay.paid_at IS NOT NULL), 0) as total_spent_cents
  FROM public.profiles p
  WHERE p.role = 'customer'
    AND (p_query IS NULL OR 
         p.full_name ILIKE '%' || p_query || '%' OR 
         p.email ILIKE '%' || p_query || '%' OR
         p.phone ILIKE '%' || p_query || '%')
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_customers(int, int, text) TO authenticated;

-- =====================================================
-- 10) CUSTOMERS - admin_get_customer_details
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_get_customer_details(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_customer_details(p_customer_id uuid)
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

  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name::text,
    'email', p.email::text,
    'phone', p.phone::text,
    'role', p.role::text,
    'city', p.city::text,
    'state', p.state::text,
    'hub_id', p.hub_id,
    'avatar_url', p.avatar_url::text,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_customer_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('error', 'Customer not found');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', j.id,
    'title', j.title::text,
    'status', j.status::text,
    'created_at', j.created_at,
    'accepted_mechanic_id', j.accepted_mechanic_id,
    'completed_at', j.completed_at
  ) ORDER BY j.created_at DESC)
  INTO v_jobs
  FROM (SELECT * FROM public.jobs WHERE customer_id = p_customer_id ORDER BY created_at DESC LIMIT 20) j;

  SELECT jsonb_agg(jsonb_build_object(
    'id', pay.id,
    'job_id', pay.job_id,
    'amount_cents', COALESCE(pay.amount_cents, 0),
    'status', pay.status::text,
    'paid_at', pay.paid_at,
    'refunded_at', pay.refunded_at
  ) ORDER BY pay.created_at DESC)
  INTO v_payments
  FROM (SELECT * FROM public.payments WHERE job_id IN (SELECT id FROM public.jobs WHERE customer_id = p_customer_id) ORDER BY created_at DESC LIMIT 10) pay;

  SELECT jsonb_agg(jsonb_build_object(
    'id', sr.id,
    'category', sr.category::text,
    'message', sr.message::text,
    'status', sr.status::text,
    'created_at', sr.created_at
  ) ORDER BY sr.created_at DESC)
  INTO v_support
  FROM (SELECT * FROM public.support_requests WHERE user_id = p_customer_id ORDER BY created_at DESC LIMIT 10) sr;

  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'job_id', d.job_id,
    'category', d.category::text,
    'status', d.status::text,
    'created_at', d.created_at,
    'resolved_at', d.resolved_at
  ) ORDER BY d.created_at DESC)
  INTO v_disputes
  FROM (SELECT d.* FROM public.disputes d JOIN public.jobs j ON j.id = d.job_id WHERE j.customer_id = p_customer_id ORDER BY d.created_at DESC LIMIT 10) d;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'jobs', COALESCE(v_jobs, '[]'::jsonb),
    'payments', COALESCE(v_payments, '[]'::jsonb),
    'support_requests', COALESCE(v_support, '[]'::jsonb),
    'disputes', COALESCE(v_disputes, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_customer_details(uuid) TO authenticated;

-- =====================================================
-- 11) FIX admin_get_metrics (already has try/catch for lead_decisions)
-- No changes needed since it already handles missing table
-- =====================================================

-- =====================================================
-- 12) Ensure RLS policies allow admin access to support_requests
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_requests' AND policyname = 'support_requests_admin_all'
  ) THEN
    CREATE POLICY support_requests_admin_all ON public.support_requests
      FOR ALL TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;
