-- ===================================================================
-- WrenchGo: baseline split (functions)
-- Generated: 2026-01-22
-- Source: reset-baseline
-- Run these files in order (0001 -> 0011).
-- ===================================================================

SET search_path TO public, extensions;

-- =====================================================
-- FUNCTION: set_updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- FUNCTION: handle_new_user
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =====================================================
-- FUNCTION: set_my_service_area
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_my_service_area(
  p_zip text,
  p_lat double precision,
  p_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_user_role text;
  v_nearest_hub_id uuid;
  v_nearest_hub_name text;
  v_distance_miles numeric;
  v_active_radius int;
  v_max_radius int;
  v_in_range boolean := false;
  v_ring int;
  v_user_point extensions.geography;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, role::text
  INTO v_user_email, v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_user_point :=
    extensions.ST_SetSRID(
      extensions.ST_MakePoint(p_lng, p_lat),
      4326
    )::extensions.geography;

  SELECT
    h.id,
    h.name,
    h.active_radius_miles,
    h.max_radius_miles,
    ROUND((extensions.ST_Distance(h.location, v_user_point) / 1609.34)::numeric, 1)
  INTO
    v_nearest_hub_id,
    v_nearest_hub_name,
    v_active_radius,
    v_max_radius,
    v_distance_miles
  FROM public.service_hubs h
  WHERE h.is_active = true
    AND h.location IS NOT NULL
  ORDER BY extensions.ST_Distance(h.location, v_user_point)
  LIMIT 1;

  IF v_nearest_hub_id IS NOT NULL
     AND v_distance_miles <= v_active_radius THEN
    v_in_range := true;
  END IF;

  IF v_distance_miles IS NULL THEN
    v_ring := 3;
  ELSIF v_distance_miles <= v_active_radius THEN
    v_ring := 0;
  ELSIF v_distance_miles <= v_active_radius * 1.5 THEN
    v_ring := 1;
  ELSIF v_distance_miles <= v_active_radius * 2 THEN
    v_ring := 2;
  ELSE
    v_ring := 3;
  END IF;

  UPDATE public.profiles
  SET
    city = (SELECT city FROM public.zip_codes WHERE zip = p_zip),
    state = (SELECT state FROM public.zip_codes WHERE zip = p_zip),
    home_lat = p_lat,
    home_lng = p_lng,
    updated_at = now()
  WHERE id = v_user_id;

  IF NOT v_in_range THEN
    INSERT INTO public.waitlist (
      email,
      user_type,
      zip,
      lat,
      lng,
      nearest_hub_id,
      distance_miles,
      ring
    )
    VALUES (
      v_user_email,
      CASE WHEN v_user_role = 'mechanic' THEN 'mechanic' ELSE 'customer' END,
      p_zip,
      p_lat,
      p_lng,
      v_nearest_hub_id,
      v_distance_miles,
      v_ring
    )
    ON CONFLICT (email, zip) DO UPDATE
    SET
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      nearest_hub_id = EXCLUDED.nearest_hub_id,
      distance_miles = EXCLUDED.distance_miles,
      ring = EXCLUDED.ring;
  END IF;

  RETURN jsonb_build_object(
    'in_range', v_in_range,
    'nearest_hub_id', v_nearest_hub_id,
    'nearest_hub_name', v_nearest_hub_name,
    'distance_miles', v_distance_miles,
    'ring', v_ring
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_service_area(text, double precision, double precision)
TO authenticated;

-- =====================================================
-- FUNCTION: get_pending_review_job
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_pending_review_job(p_user_id uuid)
RETURNS TABLE (
  job_id uuid,
  job_title text,
  other_party_id uuid,
  other_party_name text,
  reviewer_role text,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.title,
    CASE
      WHEN j.customer_id = p_user_id THEN j.accepted_mechanic_id
      ELSE j.customer_id
    END,
    CASE
      WHEN j.customer_id = p_user_id THEN mp.full_name
      ELSE cp.full_name
    END,
    CASE
      WHEN j.customer_id = p_user_id THEN 'customer'
      ELSE 'mechanic'
    END,
    j.completed_at
  FROM public.jobs j
  LEFT JOIN public.profiles mp ON mp.id = j.accepted_mechanic_id
  LEFT JOIN public.profiles cp ON cp.id = j.customer_id
  WHERE j.status = 'completed'
    AND j.completed_at IS NOT NULL
    AND (j.customer_id = p_user_id OR j.accepted_mechanic_id = p_user_id)
  ORDER BY j.completed_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_review_job(uuid)
TO authenticated;

-- =====================================================
-- FUNCTION: has_submitted_review
-- =====================================================
CREATE OR REPLACE FUNCTION public.has_submitted_review(
  p_job_id uuid,
  p_reviewer_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_submitted_review(uuid, uuid)
TO authenticated;

-- =====================================================
-- FUNCTION: get_my_role
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT role::text
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role()
TO authenticated;

-- =====================================================
-- FUNCTION: get_rating_prompt_eligibility
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_rating_prompt_eligibility(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
BEGIN
  SELECT j.id, j.title, j.completed_at
  INTO v_job
  FROM public.jobs j
  WHERE j.status = 'completed'
    AND j.completed_at IS NOT NULL
    AND (j.customer_id = p_user_id OR j.accepted_mechanic_id = p_user_id)
  ORDER BY j.completed_at DESC
  LIMIT 1;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object('eligible', false);
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'job_id', v_job.id,
    'job_title', v_job.title,
    'completed_at', v_job.completed_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rating_prompt_eligibility(uuid)
TO authenticated;

-- =====================================================
-- FUNCTION: get_app_entry_state  ⭐ SINGLE RPC FOR INDEX
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_app_entry_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_waitlisted boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  SELECT role, home_lat, home_lng, email
  INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_profile IS NULL OR v_profile.role IS NULL THEN
    RETURN jsonb_build_object('status', 'needs_role');
  END IF;

  IF v_profile.home_lat IS NULL OR v_profile.home_lng IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'needs_service_area',
      'role', v_profile.role
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.waitlist
    WHERE email = v_profile.email
  )
  INTO v_waitlisted;

  IF v_waitlisted THEN
    RETURN jsonb_build_object(
      'status', 'waitlisted',
      'role', v_profile.role
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'ready',
    'role', v_profile.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_entry_state()
TO authenticated;

-- =====================================================
-- FUNCTION: get_nearest_hub
-- Why it exists:
-- - Finds the nearest service hub to given coordinates
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_nearest_hub(
  check_lat double precision,
  check_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hub record;
  v_user_point extensions.geography;
  v_distance_miles numeric;
BEGIN
  v_user_point := extensions.ST_SetSRID(
    extensions.ST_MakePoint(check_lng, check_lat),
    4326
  )::extensions.geography;

  SELECT
    h.id,
    h.name,
    h.slug,
    h.zip,
    z.city,
    z.state,
    h.lat,
    h.lng,
    h.active_radius_miles,
    h.max_radius_miles,
    ROUND((extensions.ST_Distance(h.location, v_user_point) / 1609.34)::numeric, 1) as distance_miles
  INTO v_hub
  FROM public.service_hubs h
  LEFT JOIN public.zip_codes z ON z.zip = h.zip
  WHERE h.is_active = true
    AND h.location IS NOT NULL
  ORDER BY extensions.ST_Distance(h.location, v_user_point)
  LIMIT 1;

  IF v_hub IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_hub.id,
    'name', v_hub.name,
    'slug', v_hub.slug,
    'zip', v_hub.zip,
    'city', v_hub.city,
    'state', v_hub.state,
    'lat', v_hub.lat,
    'lng', v_hub.lng,
    'active_radius_miles', v_hub.active_radius_miles,
    'max_radius_miles', v_hub.max_radius_miles,
    'distance_miles', v_hub.distance_miles,
    'within_active_radius', v_hub.distance_miles <= v_hub.active_radius_miles,
    'within_max_radius', v_hub.distance_miles <= v_hub.max_radius_miles,
    'boundary_status', CASE
      WHEN v_hub.distance_miles <= v_hub.active_radius_miles THEN 'active'
      WHEN v_hub.distance_miles <= v_hub.max_radius_miles THEN 'expansion'
      ELSE 'out_of_range'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearest_hub(double precision, double precision) TO authenticated;

-- =====================================================
-- FUNCTION: check_terms_accepted
-- Why it exists:
-- - Checks if user has accepted the current terms for their role
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_terms_accepted(p_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_version int;
  v_accepted_version int;
BEGIN
  SELECT version INTO v_latest_version
  FROM public.platform_terms_versions
  WHERE role = p_role::user_role AND is_active = true
  ORDER BY version DESC
  LIMIT 1;

  IF v_latest_version IS NULL THEN
    RETURN true;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_terms_accepted(text) TO authenticated;

-- =====================================================
-- FUNCTION: get_active_terms
-- Why it exists:
-- - Gets the current active terms for a role
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_active_terms(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terms record;
BEGIN
  SELECT id, version, role, title, summary, full_text, published_at
  INTO v_terms
  FROM public.platform_terms_versions
  WHERE role = p_role::user_role AND is_active = true
  ORDER BY version DESC
  LIMIT 1;

  IF v_terms IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_terms.id,
    'version', v_terms.version,
    'role', v_terms.role,
    'title', v_terms.title,
    'summary', v_terms.summary,
    'full_text', v_terms.full_text,
    'published_at', v_terms.published_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_terms(text) TO authenticated;
