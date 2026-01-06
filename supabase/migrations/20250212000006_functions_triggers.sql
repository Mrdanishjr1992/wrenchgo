-- =====================================================
-- MIGRATION 6: FUNCTIONS AND TRIGGERS
-- =====================================================
-- Purpose: Auto-create profile, updated_at triggers, rating updates, get_mechanic_leads RPC
-- =====================================================

BEGIN;

-- =====================================================
-- ENSURE TABLE OWNERSHIP FOR RLS BYPASS
-- =====================================================
ALTER TABLE IF EXISTS public.profiles OWNER TO postgres;
ALTER TABLE IF EXISTS public.mechanic_profiles OWNER TO postgres;

-- =====================================================
-- FUNCTION: handle_new_user
-- Auto-create profile row when auth.users row is created
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS 'Auto-creates profile row on auth.users insert. SECURITY DEFINER bypasses RLS.';

-- =====================================================
-- FUNCTION: set_user_role
-- Allow users to set their role (customer or mechanic) once
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_user_role(new_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_role public.user_role;
  uid uuid;
BEGIN
  uid := auth.uid();

  IF uid IS NULL THEN
    RAISE EXCEPTION 'No auth.uid() in context';
  END IF;

  SELECT role INTO current_role
  FROM public.profiles
  WHERE id = uid;

  IF current_role IS NOT NULL THEN
    RAISE EXCEPTION 'Role already set to %', current_role;
  END IF;

  UPDATE public.profiles
  SET role = new_role, updated_at = now()
  WHERE id = uid;

  IF new_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (uid, now(), now())
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

ALTER FUNCTION public.set_user_role(public.user_role) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_user_role(public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(public.user_role) TO authenticated;

COMMENT ON FUNCTION public.set_user_role IS 'Allows user to set their role once. SECURITY DEFINER bypasses RLS.';

-- =====================================================
-- FUNCTION: update_updated_at_column
-- Generic trigger function to set updated_at = now()
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to all relevant tables
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.vehicles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.jobs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.quote_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quote_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.reviews;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.mechanic_profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.mechanic_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.messages;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.notifications;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.media_assets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.mechanic_stripe_accounts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.mechanic_stripe_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.customer_payment_methods;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customer_payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.payments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.symptom_mappings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.symptom_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNCTION: update_mechanic_rating
-- Recalculate mechanic rating when review is added/updated
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_mechanic_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_id uuid;
  v_avg numeric;
  v_count int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_mechanic_id := OLD.reviewee_id;
  ELSE
    v_mechanic_id := NEW.reviewee_id;
  END IF;
  
  SELECT 
    COALESCE(AVG(rating), 0)::numeric(3,2),
    COUNT(*)::int
  INTO v_avg, v_count
  FROM public.reviews
  WHERE reviewee_id = v_mechanic_id
    AND deleted_at IS NULL;
  
  UPDATE public.mechanic_profiles
  SET 
    rating_avg = v_avg,
    rating_count = v_count,
    updated_at = now()
  WHERE id = v_mechanic_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS update_mechanic_rating_trigger ON public.reviews;
CREATE TRIGGER update_mechanic_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mechanic_rating();

-- =====================================================
-- FUNCTION: increment_mechanic_job_count
-- Increment jobs_completed when job status changes to completed
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_mechanic_job_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NEW.accepted_mechanic_id IS NOT NULL THEN
      UPDATE public.mechanic_profiles
      SET jobs_completed = jobs_completed + 1, updated_at = now()
      WHERE id = NEW.accepted_mechanic_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS increment_mechanic_job_count_trigger ON public.jobs;
CREATE TRIGGER increment_mechanic_job_count_trigger
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_mechanic_job_count();

-- =====================================================
-- FUNCTION: get_mechanic_leads
-- Get job leads for mechanics with filtering, sorting, and pagination
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
  preferred_time text,
  created_at timestamptz,
  customer_id uuid,
  customer_name text,
  customer_photo_url text,
  customer_city text,
  vehicle_year integer,
  vehicle_make text,
  vehicle_model text,
  distance_miles numeric,
  quote_count integer,
  has_quoted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id AS job_id,
    j.title,
    j.description,
    j.status::text,
    j.preferred_time,
    j.created_at,
    p.id AS customer_id,
    p.full_name AS customer_name,
    p.avatar_url AS customer_photo_url,
    p.city AS customer_city,
    v.year AS vehicle_year,
    v.make AS vehicle_make,
    v.model AS vehicle_model,
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
    (SELECT COUNT(*)::integer FROM quote_requests qr WHERE qr.job_id = j.id AND qr.deleted_at IS NULL) AS quote_count,
    EXISTS(SELECT 1 FROM quote_requests qr WHERE qr.job_id = j.id AND qr.mechanic_id = p_mechanic_id AND qr.deleted_at IS NULL) AS has_quoted
  FROM jobs j
  INNER JOIN profiles p ON p.id = j.customer_id
  LEFT JOIN vehicles v ON v.id = j.vehicle_id
  WHERE
    j.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (
      (p_filter = 'all' AND j.status IN ('searching', 'quoted'))
      OR (p_filter = 'new' AND j.status = 'searching' AND NOT EXISTS(SELECT 1 FROM quote_requests qr WHERE qr.job_id = j.id AND qr.mechanic_id = p_mechanic_id AND qr.deleted_at IS NULL))
      OR (p_filter = 'quoted' AND EXISTS(SELECT 1 FROM quote_requests qr WHERE qr.job_id = j.id AND qr.mechanic_id = p_mechanic_id AND qr.deleted_at IS NULL))
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
      ) <= p_radius_miles
    )
  ORDER BY
    CASE
      WHEN p_sort_by = 'newest' THEN j.created_at
      ELSE NULL
    END DESC,
    CASE
      WHEN p_sort_by = 'oldest' THEN j.created_at
      ELSE NULL
    END ASC,
    CASE
      WHEN p_sort_by = 'distance' AND p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
      THEN (
        3959 * acos(
          cos(radians(p_mechanic_lat)) *
          cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
          sin(radians(p_mechanic_lat)) *
          sin(radians(j.location_lat))
        )
      )
      ELSE NULL
    END ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

ALTER FUNCTION public.get_mechanic_leads(uuid, text, numeric, numeric, numeric, integer, integer, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_mechanic_leads(uuid, text, numeric, numeric, numeric, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mechanic_leads(uuid, text, numeric, numeric, numeric, integer, integer, text) TO authenticated;

COMMENT ON FUNCTION public.get_mechanic_leads IS 'Get job leads for mechanics with filtering, sorting, and distance calculation';

COMMIT;
