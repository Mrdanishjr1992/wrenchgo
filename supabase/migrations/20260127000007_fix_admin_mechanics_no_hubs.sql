-- Fix admin_get_mechanics and admin_get_mechanic_detail RPCs
-- Remove hub_mechanics and hubs references (tables don't exist yet)

-- =====================================================
-- FIX admin_get_mechanics
-- =====================================================

-- Drop all overloads to avoid signature conflicts
DROP FUNCTION IF EXISTS admin_get_mechanics(text, uuid, int, int);
DROP FUNCTION IF EXISTS admin_get_mechanics(text, uuid, text, text, timestamptz, timestamptz, int, int);

CREATE OR REPLACE FUNCTION admin_get_mechanics(
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.phone,
    mp.verification_status,
    mp.tier,
    NULL::uuid AS hub_id,
    NULL::text AS hub_name,
    mp.rating_avg,
    mp.rating_count,
    mp.jobs_completed,
    mp.is_available,
    p.created_at
  FROM profiles p
  JOIN mechanic_profiles mp ON mp.id = p.id
  WHERE p.role = 'mechanic'
    AND p.deleted_at IS NULL
    AND mp.deleted_at IS NULL
    AND (p_status IS NULL OR mp.verification_status = p_status)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- FIX admin_get_mechanic_detail
-- =====================================================

CREATE OR REPLACE FUNCTION admin_get_mechanic_detail(p_mechanic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_mechanic jsonb;
  v_documents jsonb;
  v_vetting jsonb;
  v_jobs jsonb;
  v_reviews jsonb;
  v_disputes jsonb;
  v_support jsonb;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Access denied: admin only');
  END IF;

  -- Get mechanic profile (without hub references)
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'email', p.email,
    'phone', p.phone,
    'role', p.role::text,
    'city', p.city,
    'state', p.state,
    'hub_id', NULL,
    'hub_name', NULL,
    'verification_status', mp.verification_status,
    'verification_reason', mp.verification_reason,
    'tier', mp.tier,
    'bio', mp.bio,
    'years_experience', mp.years_experience,
    'hourly_rate_cents', mp.hourly_rate_cents,
    'service_radius_km', mp.service_radius_km,
    'mobile_service', mp.mobile_service,
    'is_available', mp.is_available,
    'rating_avg', mp.rating_avg,
    'rating_count', mp.rating_count,
    'jobs_completed', mp.jobs_completed,
    'stripe_account_id', mp.stripe_account_id,
    'stripe_onboarding_complete', mp.stripe_onboarding_complete,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) INTO v_mechanic
  FROM profiles p
  JOIN mechanic_profiles mp ON mp.id = p.id
  WHERE p.id = p_mechanic_id;

  IF v_mechanic IS NULL THEN
    RETURN jsonb_build_object('error', 'Mechanic not found');
  END IF;

  -- Get documents (if table exists, otherwise empty)
  BEGIN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'doc_type', d.doc_type,
        'status', d.status,
        'uploaded_at', d.created_at,
        'reviewed_at', d.reviewed_at,
        'review_notes', d.review_notes
      ) ORDER BY d.created_at DESC
    ), '[]'::jsonb) INTO v_documents
    FROM mechanic_documents d
    WHERE d.mechanic_id = p_mechanic_id;
  EXCEPTION WHEN undefined_table THEN
    v_documents := '[]'::jsonb;
  END;

  -- Get vetting responses (if table exists, otherwise empty)
  BEGIN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', v.id,
        'prompt_key', v.prompt_key,
        'prompt_text', vp.prompt_text,
        'response_text', v.response_text,
        'created_at', v.created_at
      ) ORDER BY v.created_at
    ), '[]'::jsonb) INTO v_vetting
    FROM mechanic_vetting_responses v
    LEFT JOIN mechanic_vetting_prompts vp ON vp.prompt_key = v.prompt_key
    WHERE v.mechanic_id = p_mechanic_id;
  EXCEPTION WHEN undefined_table THEN
    v_vetting := '[]'::jsonb;
  END;

  -- Get recent jobs
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', j.id,
      'title', j.title,
      'status', j.status::text,
      'customer_name', cp.full_name,
      'created_at', j.created_at,
      'completed_at', j.completed_at
    ) ORDER BY j.created_at DESC
  ), '[]'::jsonb) INTO v_jobs
  FROM jobs j
  LEFT JOIN profiles cp ON cp.id = j.customer_id
  WHERE j.accepted_mechanic_id = p_mechanic_id
  LIMIT 20;

  -- Get recent reviews
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'reviewer_name', rp.full_name,
      'overall_rating', r.overall_rating,
      'comment', r.comment,
      'created_at', r.created_at
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb) INTO v_reviews
  FROM reviews r
  LEFT JOIN profiles rp ON rp.id = r.reviewer_id
  WHERE r.reviewee_id = p_mechanic_id
  LIMIT 10;

  -- Get disputes
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'job_id', d.job_id,
      'status', d.status,
      'category', d.category,
      'description', d.description,
      'created_at', d.created_at
    ) ORDER BY d.created_at DESC
  ), '[]'::jsonb) INTO v_disputes
  FROM disputes d
  JOIN jobs j ON j.id = d.job_id
  WHERE j.accepted_mechanic_id = p_mechanic_id
  LIMIT 10;

  -- Get support requests
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'category', s.category,
      'status', s.status,
      'created_at', s.created_at
    ) ORDER BY s.created_at DESC
  ), '[]'::jsonb) INTO v_support
  FROM support_requests s
  WHERE s.user_id = p_mechanic_id
  LIMIT 10;

  -- Build final result
  v_result := jsonb_build_object(
    'mechanic', v_mechanic,
    'documents', v_documents,
    'vetting', v_vetting,
    'recent_jobs', v_jobs,
    'reviews', v_reviews,
    'disputes', v_disputes,
    'support_requests', v_support
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_mechanics(text, uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_mechanic_detail(uuid) TO authenticated;