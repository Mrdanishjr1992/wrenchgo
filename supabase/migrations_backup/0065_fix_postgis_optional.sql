-- Migration: Make PostGIS features optional to prevent errors when extension not available
-- Fixes: "type 'geography' does not exist" error on job creation

-- Drop the trigger that requires PostGIS
DROP TRIGGER IF EXISTS trg_sync_job_location_geo ON public.jobs;

-- Drop the function that uses geography type
DROP FUNCTION IF EXISTS sync_job_location_geo();

-- Drop the geography column if it exists (will fail silently if PostGIS not installed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'location_geo'
  ) THEN
    ALTER TABLE public.jobs DROP COLUMN IF EXISTS location_geo;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if column doesn't exist or can't be dropped
  NULL;
END $$;

-- Drop the index that depends on the geography column
DROP INDEX IF EXISTS idx_jobs_location_geo;

-- Create a simpler distance calculation function using lat/lng directly (no PostGIS required)
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) RETURNS double precision AS $$
DECLARE
  R constant double precision := 6371; -- Earth's radius in km
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
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_distance_km IS 'Calculate distance between two points using Haversine formula (no PostGIS required)';
