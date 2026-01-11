-- =====================================================
-- CONSOLIDATED BASELINE - PART 3: FUNCTIONS & TRIGGERS
-- =====================================================
-- Apply after 0000_baseline_rls_policies.sql
-- All SECURITY DEFINER functions include SET search_path = public
-- =====================================================

BEGIN;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =====================================================
-- AUTH/PROFILE FUNCTIONS
-- =====================================================

-- Handle new user signup (creates profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Set user role
CREATE OR REPLACE FUNCTION public.set_user_role(new_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = new_role, updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$;

-- Get current user's profile
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.profiles WHERE id = auth.uid();
END;
$$;

-- Get profile for Stripe integration
CREATE OR REPLACE FUNCTION public.get_profile_for_stripe(user_id uuid)
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  phone text,
  stripe_customer_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.phone,
    p.stripe_customer_id
  FROM public.profiles p
  WHERE p.id = user_id;
END;
$$;

-- =====================================================
-- MECHANIC FUNCTIONS
-- =====================================================

-- Update mechanic rating after review
CREATE OR REPLACE FUNCTION public.update_mechanic_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mechanic_profiles
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM public.reviews
      WHERE reviewee_id = NEW.reviewee_id AND deleted_at IS NULL
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE reviewee_id = NEW.reviewee_id AND deleted_at IS NULL
    ),
    updated_at = NOW()
  WHERE id = NEW.reviewee_id;
  RETURN NEW;
END;
$$;

-- Increment mechanic job count
CREATE OR REPLACE FUNCTION public.increment_mechanic_job_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.mechanic_profiles
    SET 
      total_jobs = total_jobs + 1,
      updated_at = NOW()
    WHERE id = NEW.accepted_mechanic_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Calculate distance between two points (km)
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  R constant double precision := 6371; -- Earth radius in km
  dlat double precision;
  dlng double precision;
  a double precision;
  c double precision;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2) * sin(dlng/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$$;

-- Get mechanic leads (jobs available for quoting)
CREATE OR REPLACE FUNCTION public.get_mechanic_leads(
  p_mechanic_lat double precision DEFAULT NULL,
  p_mechanic_lng double precision DEFAULT NULL,
  p_radius_km double precision DEFAULT 50,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  job_id uuid,
  customer_id uuid,
  vehicle_id uuid,
  title text,
  description text,
  status public.job_status,
  location_address text,
  location_lat double precision,
  location_lng double precision,
  distance_km double precision,
  created_at timestamptz,
  vehicle_year integer,
  vehicle_make text,
  vehicle_model text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id AS job_id,
    j.customer_id,
    j.vehicle_id,
    j.title,
    j.description,
    j.status,
    j.location_address,
    j.location_lat,
    j.location_lng,
    CASE 
      WHEN p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL 
           AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
      THEN public.calculate_distance_km(p_mechanic_lat, p_mechanic_lng, j.location_lat, j.location_lng)
      ELSE NULL
    END AS distance_km,
    j.created_at,
    v.year AS vehicle_year,
    v.make AS vehicle_make,
    v.model AS vehicle_model
  FROM public.jobs j
  LEFT JOIN public.vehicles v ON j.vehicle_id = v.id
  WHERE j.status IN ('searching', 'quoted')
    AND j.deleted_at IS NULL
    AND (
      p_mechanic_lat IS NULL 
      OR p_mechanic_lng IS NULL 
      OR j.location_lat IS NULL 
      OR j.location_lng IS NULL
      OR public.calculate_distance_km(p_mechanic_lat, p_mechanic_lng, j.location_lat, j.location_lng) <= p_radius_km
    )
  ORDER BY 
    CASE 
      WHEN p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL 
           AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
      THEN public.calculate_distance_km(p_mechanic_lat, p_mechanic_lng, j.location_lat, j.location_lng)
      ELSE 0
    END ASC,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Get mechanic leads summary
CREATE OR REPLACE FUNCTION public.get_mechanic_leads_summary(
  p_mechanic_lat double precision DEFAULT NULL,
  p_mechanic_lng double precision DEFAULT NULL,
  p_radius_km double precision DEFAULT 50
)
RETURNS TABLE(
  total_leads bigint,
  nearby_leads bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (
      WHERE p_mechanic_lat IS NOT NULL 
        AND p_mechanic_lng IS NOT NULL 
        AND j.location_lat IS NOT NULL 
        AND j.location_lng IS NOT NULL
        AND public.calculate_distance_km(p_mechanic_lat, p_mechanic_lng, j.location_lat, j.location_lng) <= p_radius_km
    ) AS nearby_leads
  FROM public.jobs j
  WHERE j.status IN ('searching', 'quoted')
    AND j.deleted_at IS NULL;
END;
$$;

-- Get public profile card
CREATE OR REPLACE FUNCTION public.get_public_profile_card(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text,
  role public.user_role,
  average_rating numeric,
  total_reviews integer,
  total_jobs integer,
  member_since timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    p.role,
    COALESCE(mp.average_rating, 0) AS average_rating,
    COALESCE(mp.total_reviews, 0) AS total_reviews,
    COALESCE(mp.total_jobs, 0) AS total_jobs,
    p.created_at AS member_since
  FROM public.profiles p
  LEFT JOIN public.mechanic_profiles mp ON p.id = mp.id
  WHERE p.id = p_user_id AND p.deleted_at IS NULL;
END;
$$;

-- =====================================================
-- PAYOUT STATUS SYNC
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_payout_method_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.profiles
    SET 
      payout_method_status = CASE
        WHEN NEW.payouts_enabled = true THEN 'active'::public.payout_method_status
        WHEN NEW.details_submitted = true THEN 'pending'::public.payout_method_status
        ELSE 'not_setup'::public.payout_method_status
      END,
      updated_at = NOW()
    WHERE id = NEW.mechanic_id;
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- SUPPORT FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_support_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_support_requests(p_user_id uuid)
RETURNS SETOF public.support_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  SELECT * FROM public.support_requests
  WHERE user_id = p_user_id
  ORDER BY created_at DESC;
END;
$$;

-- =====================================================
-- RATING PROMPT FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_rating_prompt_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_job_completed_rating_prompt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.user_rating_prompt_state (user_id, last_completed_job_id, prompt_eligible)
    VALUES (NEW.customer_id, NEW.id, true)
    ON CONFLICT (user_id) DO UPDATE SET
      last_completed_job_id = NEW.id,
      prompt_eligible = true,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_rating_prompt_eligibility(p_user_id uuid)
RETURNS TABLE(
  eligible boolean,
  job_id uuid,
  mechanic_id uuid,
  mechanic_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    rps.prompt_eligible AS eligible,
    rps.last_completed_job_id AS job_id,
    j.accepted_mechanic_id AS mechanic_id,
    p.full_name AS mechanic_name
  FROM public.user_rating_prompt_state rps
  JOIN public.jobs j ON rps.last_completed_job_id = j.id
  JOIN public.profiles p ON j.accepted_mechanic_id = p.id
  WHERE rps.user_id = p_user_id AND rps.prompt_eligible = true;
END;
$$;

-- =====================================================
-- POSTGIS LOCATION SYNC (conditional)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    -- Add location_geo column if PostGIS is available
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'location_geo'
    ) THEN
      ALTER TABLE public.jobs ADD COLUMN location_geo geometry(Point, 4326);
      CREATE INDEX IF NOT EXISTS idx_jobs_location_geo ON public.jobs USING GIST (location_geo);
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_job_location_geo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    IF NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL THEN
      NEW.location_geo := ST_SetSRID(ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326);
    ELSE
      NEW.location_geo := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Drop existing triggers first (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
DROP TRIGGER IF EXISTS update_quotes_updated_at ON public.quotes;
DROP TRIGGER IF EXISTS update_mechanic_profiles_updated_at ON public.mechanic_profiles;
DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
DROP TRIGGER IF EXISTS on_job_completed ON public.jobs;
DROP TRIGGER IF EXISTS sync_payout_status ON public.mechanic_stripe_accounts;
DROP TRIGGER IF EXISTS update_support_requests_timestamp ON public.support_requests;
DROP TRIGGER IF EXISTS update_rating_prompt_timestamp ON public.user_rating_prompt_state;
DROP TRIGGER IF EXISTS on_job_completed_rating ON public.jobs;
DROP TRIGGER IF EXISTS sync_job_location ON public.jobs;

-- Create triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mechanic_profiles_updated_at
  BEFORE UPDATE ON public.mechanic_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_mechanic_rating();

CREATE TRIGGER on_job_completed
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.increment_mechanic_job_count();

CREATE TRIGGER sync_payout_status
  AFTER INSERT OR UPDATE ON public.mechanic_stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_payout_method_status();

CREATE TRIGGER update_support_requests_timestamp
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_support_requests_updated_at();

CREATE TRIGGER update_rating_prompt_timestamp
  BEFORE UPDATE ON public.user_rating_prompt_state
  FOR EACH ROW EXECUTE FUNCTION public.update_rating_prompt_timestamp();

CREATE TRIGGER on_job_completed_rating
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.on_job_completed_rating_prompt();

CREATE TRIGGER sync_job_location
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.sync_job_location_geo();

-- =====================================================
-- FUNCTION GRANTS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_for_stripe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mechanic_leads(double precision, double precision, double precision, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mechanic_leads_summary(double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_support_requests(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rating_prompt_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_distance_km(double precision, double precision, double precision, double precision) TO authenticated;

COMMIT;
