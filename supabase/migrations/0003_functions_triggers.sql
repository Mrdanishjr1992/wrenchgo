-- =====================================================
-- MIGRATION 0003: FUNCTIONS AND TRIGGERS
-- =====================================================
-- Purpose: All database functions and triggers
-- Depends on: 0001_baseline_schema.sql, 0002_rls_policies.sql
-- =====================================================

BEGIN;

-- =====================================================
-- TABLE OWNERSHIP (for SECURITY DEFINER functions)
-- =====================================================
ALTER TABLE public.profiles OWNER TO postgres;
ALTER TABLE public.mechanic_profiles OWNER TO postgres;

-- =====================================================
-- FUNCTION: handle_new_user
-- Auto-creates profile on auth signup (Google sign-in support)
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- FUNCTION: set_user_role
-- Allows one-time role setting per user
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_user_role(new_role public.user_role)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_role public.user_role;
BEGIN
  SELECT role INTO existing_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF existing_role IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Role already set to ' || existing_role::text
    );
  END IF;
  
  UPDATE public.profiles
  SET role = new_role, updated_at = NOW()
  WHERE id = auth.uid();
  
  IF new_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (auth.uid(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'role', new_role::text
  );
END;
$$;

-- =====================================================
-- FUNCTION: get_my_role
-- Returns current user's role (bypasses RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.user_role;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN user_role;
END;
$$;

-- =====================================================
-- FUNCTION: get_my_profile
-- Returns current user's full profile (bypasses RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_data json;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'display_name', p.display_name,
    'phone', p.phone,
    'avatar_url', p.avatar_url,
    'role', p.role,
    'theme_preference', p.theme_preference,
    'city', p.city,
    'state', p.state,
    'home_lat', p.home_lat,
    'home_lng', p.home_lng,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  ) INTO profile_data
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  RETURN profile_data;
END;
$$;

-- =====================================================
-- FUNCTION: get_profile_for_stripe
-- Returns profile for stripe operations (service_role)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_profile_for_stripe(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, p.full_name
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_for_stripe(uuid) TO service_role;

-- =====================================================
-- FUNCTION: update_updated_at_column
-- Generic trigger to update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================================================
-- FUNCTION: update_mechanic_rating
-- Recalculates mechanic rating after review
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_mechanic_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mechanic_profiles
  SET 
    rating_avg = (
      SELECT COALESCE(AVG(rating)::numeric(3,2), 0)
      FROM public.reviews
      WHERE reviewee_id = NEW.reviewee_id AND deleted_at IS NULL
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE reviewee_id = NEW.reviewee_id AND deleted_at IS NULL
    ),
    updated_at = NOW()
  WHERE id = NEW.reviewee_id;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- FUNCTION: increment_mechanic_job_count
-- Increments completed job count for mechanic
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_mechanic_job_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.mechanic_profiles
    SET jobs_completed = jobs_completed + 1, updated_at = NOW()
    WHERE id = NEW.accepted_mechanic_id;
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- FUNCTION: get_mechanic_leads
-- Returns job leads for mechanics based on location and filter
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_mechanic_leads(
  p_mechanic_id uuid,
  p_filter text,
  p_mechanic_lat numeric DEFAULT NULL,
  p_mechanic_lng numeric DEFAULT NULL,
  p_radius_miles numeric DEFAULT 25,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_sort_by text DEFAULT 'newest'
)
RETURNS TABLE (
  job_id uuid,
  title text,
  description text,
  status text,
  created_at timestamptz,
  preferred_time text,
  location_address text,
  latitude double precision,
  longitude double precision,
  distance_miles numeric,
  customer_id uuid,
  customer_name text,
  customer_photo_url text,
  customer_rating numeric,
  customer_review_count bigint,
  vehicle_id uuid,
  vehicle_year integer,
  vehicle_make text,
  vehicle_model text,
  has_quoted boolean,
  quote_id uuid,
  quote_amount integer,
  quote_status text,
  quote_created_at timestamptz,
  is_new boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_radius numeric;
BEGIN
  -- For 'nearby' filter, use 5 miles. For 'all', use mechanic's radius (p_radius_miles)
  IF p_filter = 'nearby' THEN
    effective_radius := 5;
  ELSE
    effective_radius := p_radius_miles;
  END IF;

  RETURN QUERY
  SELECT
    j.id AS job_id,
    j.title,
    j.description,
    j.status::text,
    j.created_at,
    j.preferred_time,
    j.location_address,
    j.location_lat AS latitude,
    j.location_lng AS longitude,
    CASE
      WHEN p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
      THEN (
        3959 * acos(
          cos(radians(p_mechanic_lat)) *
          cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
          sin(radians(p_mechanic_lat)) *
          sin(radians(j.location_lat))
        )
      )::numeric
      ELSE NULL
    END AS distance_miles,
    p.id AS customer_id,
    p.full_name AS customer_name,
    p.avatar_url AS customer_photo_url,
    0::numeric AS customer_rating,
    0::bigint AS customer_review_count,
    j.vehicle_id,
    v.year AS vehicle_year,
    v.make AS vehicle_make,
    v.model AS vehicle_model,
    EXISTS(SELECT 1 FROM quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id) AS has_quoted,
    (SELECT q.id FROM quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id LIMIT 1) AS quote_id,
    (SELECT q.price_cents FROM quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id LIMIT 1) AS quote_amount,
    (SELECT q.status::text FROM quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id LIMIT 1) AS quote_status,
    (SELECT q.created_at FROM quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id LIMIT 1) AS quote_created_at,
    (j.created_at > NOW() - INTERVAL '24 hours') AS is_new
  FROM jobs j
  INNER JOIN profiles p ON p.id = j.customer_id
  LEFT JOIN vehicles v ON v.id = j.vehicle_id
  WHERE
    j.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (
      (p_filter = 'all' AND j.status IN ('searching', 'quoted'))
      OR (p_filter = 'quoted' AND EXISTS(SELECT 1 FROM quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id))
      OR (p_filter = 'nearby' AND j.status IN ('searching', 'quoted'))
    )
    AND (
      p_mechanic_lat IS NULL
      OR p_mechanic_lng IS NULL
      OR j.location_lat IS NULL
      OR j.location_lng IS NULL
      OR (
        3959 * acos(
          cos(radians(p_mechanic_lat)) *
          cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
          sin(radians(p_mechanic_lat)) *
          sin(radians(j.location_lat))
        )
      ) <= effective_radius
    )
  ORDER BY
    CASE WHEN p_sort_by = 'newest' THEN j.created_at ELSE NULL END DESC,
    CASE WHEN p_sort_by = 'closest' THEN (
      CASE
        WHEN p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
        THEN 3959 * acos(
          cos(radians(p_mechanic_lat)) *
          cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
          sin(radians(p_mechanic_lat)) *
          sin(radians(j.location_lat))
        )
        ELSE 999999
      END
    ) ELSE NULL END ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_leads(uuid, text, numeric, numeric, numeric, integer, integer, text) TO authenticated;

-- =====================================================
-- FUNCTION: get_mechanic_leads_summary
-- Returns summary counts for mechanic leads
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_mechanic_leads_summary(
  p_mechanic_id uuid,
  p_mechanic_lat numeric DEFAULT NULL,
  p_mechanic_lng numeric DEFAULT NULL,
  p_radius_miles numeric DEFAULT 25
)
RETURNS TABLE (
  all_count bigint,
  nearby_count bigint,
  quoted_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- all_count: jobs within mechanic's service radius
    (SELECT COUNT(*) FROM jobs j
     INNER JOIN profiles p ON p.id = j.customer_id
     WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL
     AND j.status IN ('searching', 'quoted')
     AND (
       p_mechanic_lat IS NULL OR p_mechanic_lng IS NULL
       OR j.location_lat IS NULL OR j.location_lng IS NULL
       OR (3959 * acos(
         cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
         cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
         sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
       )) <= p_radius_miles
     )
    ) AS all_count,
    -- nearby_count: jobs within 5 miles
    (SELECT COUNT(*) FROM jobs j
     INNER JOIN profiles p ON p.id = j.customer_id
     WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL
     AND j.status IN ('searching', 'quoted')
     AND (
       p_mechanic_lat IS NULL OR p_mechanic_lng IS NULL
       OR j.location_lat IS NULL OR j.location_lng IS NULL
       OR (3959 * acos(
         cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
         cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
         sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
       )) <= 5
     )
    ) AS nearby_count,
    -- quoted_count: jobs mechanic has quoted on
    (SELECT COUNT(*) FROM jobs j
     INNER JOIN profiles p ON p.id = j.customer_id
     WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL
     AND EXISTS(SELECT 1 FROM quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id)
    ) AS quoted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_leads_summary(uuid, numeric, numeric, numeric) TO authenticated;

-- =====================================================
-- FUNCTION: get_public_profile_card
-- Returns public profile data for profile cards
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_public_profile_card(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  profile_record record;
  profile_ratings jsonb;
  profile_badges jsonb;
  profile_skills jsonb;
BEGIN
  -- Get the profile record
  SELECT p.id, p.role, p.full_name, p.avatar_url, p.created_at
  INTO profile_record
  FROM profiles p
  WHERE p.id = user_id
    AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get ratings from reviews
  SELECT jsonb_build_object(
    'overall_avg', COALESCE(AVG(r.overall_rating), 0),
    'performance_avg', COALESCE(AVG(r.performance_rating), 0),
    'timing_avg', COALESCE(AVG(r.timing_rating), 0),
    'cost_avg', COALESCE(AVG(r.cost_rating), 0),
    'review_count', COUNT(r.id)::integer
  )
  INTO profile_ratings
  FROM reviews r
  WHERE r.reviewee_id = profile_record.id
    AND r.is_hidden = false
    AND r.deleted_at IS NULL;

  -- Get badges
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ub.id,
      'badge_id', ub.badge_id,
      'awarded_at', ub.awarded_at,
      'badge', jsonb_build_object(
        'code', b.code,
        'title', b.title,
        'description', b.description,
        'icon', b.icon,
        'badge_type', b.badge_type
      )
    )
  ), '[]'::jsonb)
  INTO profile_badges
  FROM user_badges ub
  INNER JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = profile_record.id
    AND (ub.expires_at IS NULL OR ub.expires_at > NOW());

  -- Get skills (for mechanics only)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ms.id,
      'skill', jsonb_build_object(
        'key', s.key,
        'label', s.label,
        'category', s.category
      )
    )
  ), '[]'::jsonb)
  INTO profile_skills
  FROM mechanic_skills ms
  INNER JOIN skills s ON s.key = ms.skill_key
  WHERE ms.mechanic_id = profile_record.id;

  -- Build result
  result := jsonb_build_object(
    'id', profile_record.id,
    'role', profile_record.role,
    'display_name', COALESCE(profile_record.full_name, 'Unknown User'),
    'avatar_url', profile_record.avatar_url,
    'created_at', profile_record.created_at,
    'ratings', profile_ratings,
    'badges', profile_badges,
    'skills', profile_skills
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO anon;

-- =====================================================
-- FUNCTION: get_mechanic_profile_full
-- Returns complete mechanic profile with skills, tools, safety
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_mechanic_profile_full(p_mechanic_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mechanic_id uuid;
  result json;
BEGIN
  mechanic_id := COALESCE(p_mechanic_id, auth.uid());
  
  SELECT json_build_object(
    'profile', (
      SELECT json_build_object(
        'id', mp.id,
        'bio', mp.bio,
        'years_experience', mp.years_experience,
        'hourly_rate_cents', mp.hourly_rate_cents,
        'service_radius_km', mp.service_radius_km,
        'mobile_service', mp.mobile_service,
        'is_available', mp.is_available,
        'rating_avg', mp.rating_avg,
        'rating_count', mp.rating_count,
        'jobs_completed', mp.jobs_completed,
        'stripe_onboarding_complete', mp.stripe_onboarding_complete
      )
      FROM public.mechanic_profiles mp
      WHERE mp.id = mechanic_id
    ),
    'user', (
      SELECT json_build_object(
        'full_name', p.full_name,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'city', p.city,
        'state', p.state,
        'home_lat', p.home_lat,
        'home_lng', p.home_lng
      )
      FROM public.profiles p
      WHERE p.id = mechanic_id
    ),
    'skills', (
      SELECT COALESCE(json_agg(json_build_object(
        'key', s.key,
        'label', s.label,
        'category', s.category
      )), '[]'::json)
      FROM public.mechanic_skills ms
      JOIN public.skills s ON ms.skill_key = s.key
      WHERE ms.mechanic_id = mechanic_id
    ),
    'tools', (
      SELECT COALESCE(json_agg(json_build_object(
        'key', t.key,
        'label', t.label,
        'category', t.category
      )), '[]'::json)
      FROM public.mechanic_tools mt
      JOIN public.tools t ON mt.tool_key = t.key
      WHERE mt.mechanic_id = mechanic_id
    ),
    'safety', (
      SELECT COALESCE(json_agg(json_build_object(
        'key', sm.key,
        'label', sm.label
      )), '[]'::json)
      FROM public.mechanic_safety msa
      JOIN public.safety_measures sm ON msa.safety_key = sm.key
      WHERE msa.mechanic_id = mechanic_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- =====================================================
-- FUNCTION: save_theme_preference
-- Saves user's theme preference
-- =====================================================
CREATE OR REPLACE FUNCTION public.save_theme_preference(p_theme public.theme_mode)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET theme_preference = p_theme, updated_at = NOW()
  WHERE id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- =====================================================
-- TRIGGERS: updated_at
-- =====================================================
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.vehicles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.jobs;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.quote_requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.reviews;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.mechanic_profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.mechanic_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.messages;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.notifications;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.media_assets;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.mechanic_stripe_accounts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.mechanic_stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.customer_payment_methods;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.customer_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.payments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TRIGGER: update_mechanic_rating_trigger
-- =====================================================
DROP TRIGGER IF EXISTS update_mechanic_rating_trigger ON public.reviews;
CREATE TRIGGER update_mechanic_rating_trigger
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mechanic_rating();

-- =====================================================
-- TRIGGER: increment_mechanic_job_count_trigger
-- =====================================================
DROP TRIGGER IF EXISTS increment_mechanic_job_count_trigger ON public.jobs;
CREATE TRIGGER increment_mechanic_job_count_trigger
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_mechanic_job_count();

COMMIT;
