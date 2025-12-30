-- Migration: Add location privacy fields to jobs table
-- Purpose: Protect exact customer addresses from mechanics until job acceptance

-- 1. Add new columns to jobs table
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS public_latitude double precision,
  ADD COLUMN IF NOT EXISTS public_longitude double precision,
  ADD COLUMN IF NOT EXISTS public_area_label text,
  ADD COLUMN IF NOT EXISTS private_location_notes text;

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_public_location ON public.jobs(public_latitude, public_longitude) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_exact_location ON public.jobs(latitude, longitude) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON public.jobs(status, created_at DESC) WHERE deleted_at IS NULL;

-- 3. Create function to calculate public location from exact coordinates
CREATE OR REPLACE FUNCTION public.calculate_public_location(
  exact_lat double precision,
  exact_lng double precision,
  address text DEFAULT NULL
)
RETURNS TABLE(
  public_lat double precision,
  public_lng double precision,
  area_label text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  jitter_amount double precision := 0.01;
  city_state text;
BEGIN
  public_lat := ROUND(exact_lat::numeric, 2) + (random() * jitter_amount - jitter_amount/2);
  public_lng := ROUND(exact_lng::numeric, 2) + (random() * jitter_amount - jitter_amount/2);
  
  IF address IS NOT NULL AND address != '' THEN
    city_state := regexp_replace(address, '^.*,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}.*$', '\1, \2');
    IF city_state = address THEN
      city_state := regexp_replace(address, '^.*,\s*([^,]+),\s*([A-Z]{2}).*$', '\1, \2');
    END IF;
    area_label := city_state;
  ELSE
    area_label := 'Location provided';
  END IF;
  
  RETURN QUERY SELECT public_lat, public_lng, area_label;
END;
$$;

-- 4. Create trigger function to auto-populate public location on insert/update
CREATE OR REPLACE FUNCTION public.set_job_public_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pub_location RECORD;
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    IF NEW.public_latitude IS NULL OR NEW.public_longitude IS NULL OR 
       OLD.latitude IS DISTINCT FROM NEW.latitude OR 
       OLD.longitude IS DISTINCT FROM NEW.longitude THEN
      
      SELECT * INTO pub_location 
      FROM public.calculate_public_location(
        NEW.latitude, 
        NEW.longitude, 
        NEW.location_address
      );
      
      NEW.public_latitude := pub_location.public_lat;
      NEW.public_longitude := pub_location.public_lng;
      NEW.public_area_label := pub_location.area_label;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Create trigger on jobs table
DROP TRIGGER IF EXISTS trigger_set_job_public_location ON public.jobs;
CREATE TRIGGER trigger_set_job_public_location
  BEFORE INSERT OR UPDATE OF latitude, longitude, location_address
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_job_public_location();

-- 6. Backfill existing jobs with public location data
UPDATE public.jobs
SET 
  public_latitude = (SELECT public_lat FROM public.calculate_public_location(latitude, longitude, location_address)),
  public_longitude = (SELECT public_lng FROM public.calculate_public_location(latitude, longitude, location_address)),
  public_area_label = (SELECT area_label FROM public.calculate_public_location(latitude, longitude, location_address))
WHERE 
  latitude IS NOT NULL 
  AND longitude IS NOT NULL 
  AND public_latitude IS NULL
  AND deleted_at IS NULL;

COMMENT ON COLUMN public.jobs.public_latitude IS 'Approximate latitude (rounded + jittered) shown to mechanics before acceptance';
COMMENT ON COLUMN public.jobs.public_longitude IS 'Approximate longitude (rounded + jittered) shown to mechanics before acceptance';
COMMENT ON COLUMN public.jobs.public_area_label IS 'City/state label shown to mechanics before acceptance';
COMMENT ON COLUMN public.jobs.private_location_notes IS 'Gate codes, parking instructions, etc. Only visible after acceptance';
