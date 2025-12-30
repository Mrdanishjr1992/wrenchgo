-- Migration: Add distance calculation functions for nearby jobs
-- Purpose: Enable mechanics to find jobs near their location using public coordinates

-- 1. Create Haversine distance calculation function
CREATE OR REPLACE FUNCTION public.calculate_distance_miles(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius_miles constant double precision := 3959.0;
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlon/2) * sin(dlon/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN earth_radius_miles * c;
END;
$$;

-- 2. Create RPC function to get nearby jobs for mechanics
CREATE OR REPLACE FUNCTION public.get_nearby_jobs(
  mechanic_lat double precision,
  mechanic_lon double precision,
  max_distance_miles double precision DEFAULT 50,
  job_status_filter text[] DEFAULT ARRAY['searching', 'quoted']
)
RETURNS TABLE(
  id uuid,
  customer_id uuid,
  title text,
  description text,
  status text,
  preferred_time text,
  vehicle_id uuid,
  intake jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  accepted_mechanic_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  canceled_by text,
  public_latitude double precision,
  public_longitude double precision,
  public_area_label text,
  vehicle_year integer,
  vehicle_make text,
  vehicle_model text,
  customer_name text,
  customer_photo_url text,
  distance_miles double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jp.*,
    public.calculate_distance_miles(
      mechanic_lat,
      mechanic_lon,
      jp.public_latitude,
      jp.public_longitude
    ) AS distance_miles
  FROM public.jobs_public jp
  WHERE 
    jp.status = ANY(job_status_filter)
    AND jp.public_latitude IS NOT NULL
    AND jp.public_longitude IS NOT NULL
    AND public.calculate_distance_miles(
      mechanic_lat,
      mechanic_lon,
      jp.public_latitude,
      jp.public_longitude
    ) <= max_distance_miles
  ORDER BY distance_miles ASC;
END;
$$;

-- 3. Create RPC to get mechanic's current location
CREATE OR REPLACE FUNCTION public.get_mechanic_location()
RETURNS TABLE(
  latitude double precision,
  longitude double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.home_latitude,
    p.home_longitude
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

-- 4. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_distance_miles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mechanic_location TO authenticated;

-- 5. Create index for better performance on public location queries
CREATE INDEX IF NOT EXISTS idx_jobs_public_lat_lng_status 
  ON public.jobs(public_latitude, public_longitude, status) 
  WHERE deleted_at IS NULL AND public_latitude IS NOT NULL;

COMMENT ON FUNCTION public.calculate_distance_miles IS 'Calculate distance in miles between two lat/lng points using Haversine formula';
COMMENT ON FUNCTION public.get_nearby_jobs IS 'Get jobs near mechanic location using public coordinates only';
COMMENT ON FUNCTION public.get_mechanic_location IS 'Get current mechanic home location for distance calculations';
