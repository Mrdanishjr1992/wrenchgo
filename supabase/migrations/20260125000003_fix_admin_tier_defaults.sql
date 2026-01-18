-- Fix admin RPCs to use correct tier values (probation/standard/trusted instead of bronze)
-- The mechanic_profiles.tier column uses CHECK constraint: tier IN ('probation', 'standard', 'trusted')

-- =====================================================
-- 1) Fix admin_get_mechanics - change default from 'bronze' to 'standard'
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
    COALESCE(mp.tier, 'standard')::text as tier,
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
-- 2) Fix admin_get_mechanic_detail - change default from 'bronze' to 'standard'
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
    'tier', COALESCE(mp.tier, 'standard')::text,
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
  WHERE d.mechanic_id = p_mechanic_id
  LIMIT 10;

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
  LIMIT 10;

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
-- 3) Update set_mechanic_tier to validate tier values
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_mechanic_tier(
  p_mechanic_id uuid,
  p_tier text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_tier text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Validate tier value
  IF p_tier NOT IN ('probation', 'standard', 'trusted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier. Must be: probation, standard, or trusted');
  END IF;

  SELECT tier INTO v_old_tier
  FROM public.mechanic_profiles
  WHERE id = p_mechanic_id;

  IF v_old_tier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mechanic not found');
  END IF;

  UPDATE public.mechanic_profiles
  SET tier = p_tier, updated_at = now()
  WHERE id = p_mechanic_id;

  -- Write to audit_log if function exists
  BEGIN
    PERFORM public.admin_audit_log(
      'ADMIN_SET_MECHANIC_TIER',
      'mechanic_profiles',
      p_mechanic_id,
      jsonb_build_object('old_tier', v_old_tier, 'new_tier', p_tier)
    );
  EXCEPTION WHEN undefined_function THEN
    -- admin_audit_log doesn't exist, skip
    NULL;
  END;

  RETURN jsonb_build_object('success', true, 'mechanic_id', p_mechanic_id, 'old_tier', v_old_tier, 'new_tier', p_tier);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_mechanic_tier(uuid, text) TO authenticated;
