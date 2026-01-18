-- =====================================================
-- MIGRATION 0127: Mechanic Tier + Admin RPCs
-- =====================================================
-- Purpose: Add tier/verification columns to mechanic_profiles
--          Create admin RPCs for mechanics list/detail/tier update
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Add columns to mechanic_profiles
-- =====================================================

-- Add tier column with CHECK constraint
ALTER TABLE mechanic_profiles
ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'standard'
  CHECK (tier IN ('probation', 'standard', 'trusted'));

-- Add verification columns
ALTER TABLE mechanic_profiles
ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending_verification'
  CHECK (verification_status IN ('pending_verification', 'active', 'paused', 'removed'));

ALTER TABLE mechanic_profiles
ADD COLUMN IF NOT EXISTS verification_reason text;

ALTER TABLE mechanic_profiles
ADD COLUMN IF NOT EXISTS verification_updated_at timestamptz;

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_verification_status 
  ON mechanic_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_tier 
  ON mechanic_profiles(tier);

-- =====================================================
-- STEP 2: Admin Get Mechanics RPC
-- =====================================================

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
    h.id AS hub_id,
    h.name AS hub_name,
    mp.rating_avg,
    mp.rating_count,
    mp.jobs_completed,
    mp.is_available,
    p.created_at
  FROM profiles p
  JOIN mechanic_profiles mp ON mp.id = p.id
  LEFT JOIN hub_mechanics hm ON hm.mechanic_id = p.id AND hm.is_active = true
  LEFT JOIN hubs h ON h.id = hm.hub_id
  WHERE p.role = 'mechanic'
    AND p.deleted_at IS NULL
    AND mp.deleted_at IS NULL
    AND (p_status IS NULL OR mp.verification_status = p_status)
    AND (p_hub_id IS NULL OR h.id = p_hub_id)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- STEP 3: Admin Get Mechanic Detail RPC
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

  -- Get mechanic profile
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'email', p.email,
    'phone', p.phone,
    'role', p.role::text,
    'city', p.city,
    'state', p.state,
    'hub_id', h.id,
    'hub_name', h.name,
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
  LEFT JOIN hub_mechanics hm ON hm.mechanic_id = p.id AND hm.is_active = true
  LEFT JOIN hubs h ON h.id = hm.hub_id
  WHERE p.id = p_mechanic_id;

  IF v_mechanic IS NULL THEN
    RETURN jsonb_build_object('error', 'Mechanic not found');
  END IF;

  -- Get documents (if mechanic_documents table exists)
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

  -- Get vetting responses (if mechanic_vetting_responses table exists)
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
  JOIN profiles cp ON cp.id = j.customer_id
  WHERE j.accepted_mechanic_id = p_mechanic_id
  LIMIT 20;

  -- Get reviews received
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'overall_rating', r.overall_rating,
      'comment', r.comment,
      'reviewer_name', rp.full_name,
      'created_at', r.created_at
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb) INTO v_reviews
  FROM reviews r
  JOIN profiles rp ON rp.id = r.reviewer_id
  WHERE r.reviewee_id = p_mechanic_id
  LIMIT 20;

  -- Get disputes
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'job_id', d.job_id,
      'status', d.status,
      'category', d.category,
      'created_at', d.created_at,
      'resolved_at', d.resolved_at
    ) ORDER BY d.created_at DESC
  ), '[]'::jsonb) INTO v_disputes
  FROM disputes d
  JOIN jobs j ON j.id = d.job_id
  WHERE j.accepted_mechanic_id = p_mechanic_id
  LIMIT 10;

  -- Get support requests
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sr.id,
      'job_id', sr.job_id,
      'category', sr.category,
      'status', sr.status,
      'message', sr.message,
      'created_at', sr.created_at
    ) ORDER BY sr.created_at DESC
  ), '[]'::jsonb) INTO v_support
  FROM support_requests sr
  WHERE sr.user_id = p_mechanic_id
  LIMIT 10;

  RETURN jsonb_build_object(
    'mechanic', v_mechanic,
    'documents', COALESCE(v_documents, '[]'::jsonb),
    'vetting', COALESCE(v_vetting, '[]'::jsonb),
    'jobs', COALESCE(v_jobs, '[]'::jsonb),
    'reviews', COALESCE(v_reviews, '[]'::jsonb),
    'disputes', COALESCE(v_disputes, '[]'::jsonb),
    'support_requests', COALESCE(v_support, '[]'::jsonb)
  );

EXCEPTION WHEN undefined_table THEN
  -- Handle missing tables gracefully
  RETURN jsonb_build_object(
    'mechanic', v_mechanic,
    'documents', '[]'::jsonb,
    'vetting', '[]'::jsonb,
    'jobs', '[]'::jsonb,
    'reviews', '[]'::jsonb,
    'disputes', '[]'::jsonb,
    'support_requests', '[]'::jsonb
  );
END;
$$;

-- =====================================================
-- STEP 4: Set Mechanic Tier RPC
-- =====================================================

CREATE OR REPLACE FUNCTION set_mechanic_tier(
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
  v_admin_id uuid := auth.uid();
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: admin only');
  END IF;

  -- Validate tier value
  IF p_tier NOT IN ('probation', 'standard', 'trusted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier value');
  END IF;

  -- Get current tier
  SELECT tier INTO v_old_tier
  FROM mechanic_profiles
  WHERE id = p_mechanic_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mechanic not found');
  END IF;

  -- Update tier
  UPDATE mechanic_profiles
  SET tier = p_tier,
      updated_at = now()
  WHERE id = p_mechanic_id;

  -- Log to audit_log
  INSERT INTO audit_log (actor_id, actor_type, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin_id,
    'admin',
    'ADMIN_SET_MECHANIC_TIER',
    'mechanic_profiles',
    p_mechanic_id,
    jsonb_build_object('old_tier', v_old_tier, 'new_tier', p_tier)
  );

  RETURN jsonb_build_object('success', true, 'old_tier', v_old_tier, 'new_tier', p_tier);
END;
$$;

-- =====================================================
-- STEP 5: Set Mechanic Verification Status RPC
-- =====================================================

CREATE OR REPLACE FUNCTION set_mechanic_verification_status(
  p_mechanic_id uuid,
  p_status text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_admin_id uuid := auth.uid();
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: admin only');
  END IF;

  -- Validate status value
  IF p_status NOT IN ('pending_verification', 'active', 'paused', 'removed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status value');
  END IF;

  -- Get current status
  SELECT verification_status INTO v_old_status
  FROM mechanic_profiles
  WHERE id = p_mechanic_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mechanic not found');
  END IF;

  -- Update status
  UPDATE mechanic_profiles
  SET verification_status = p_status,
      verification_reason = CASE 
        WHEN p_status = 'removed' THEN COALESCE(p_rejection_reason, verification_reason)
        ELSE verification_reason
      END,
      verification_updated_at = now(),
      updated_at = now()
  WHERE id = p_mechanic_id;

  -- Log to audit_log
  INSERT INTO audit_log (actor_id, actor_type, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin_id,
    'admin',
    'ADMIN_SET_VERIFICATION_STATUS',
    'mechanic_profiles',
    p_mechanic_id,
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_status,
      'reason', p_rejection_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_status);
END;
$$;

-- =====================================================
-- STEP 6: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION admin_get_mechanics TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_mechanic_detail TO authenticated;
GRANT EXECUTE ON FUNCTION set_mechanic_tier TO authenticated;
GRANT EXECUTE ON FUNCTION set_mechanic_verification_status TO authenticated;

COMMIT;
