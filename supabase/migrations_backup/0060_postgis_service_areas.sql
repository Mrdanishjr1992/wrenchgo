-- Migration: Add PostGIS geography columns for spatial queries
-- Purpose: Secure location enforcement, performant distance queries

-- 1. Enable PostGIS in extensions schema (Supabase requirement)
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Set search path to include extensions for PostGIS types
SET search_path TO public, extensions;

-- 2. Add geography columns to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS location_geo geography(Point, 4326);

-- 3. Backfill geography column from existing lat/lng on jobs
UPDATE public.jobs
SET location_geo = ST_SetSRID(ST_MakePoint(location_lng, location_lat), 4326)::geography
WHERE location_lat IS NOT NULL 
  AND location_lng IS NOT NULL 
  AND location_geo IS NULL;

-- 4. Create trigger to auto-populate geography on insert/update for jobs
CREATE OR REPLACE FUNCTION sync_job_location_geo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL THEN
    NEW.location_geo := ST_SetSRID(ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326)::geography;
  ELSE
    NEW.location_geo := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_job_location_geo ON public.jobs;
CREATE TRIGGER trg_sync_job_location_geo
  BEFORE INSERT OR UPDATE OF location_lat, location_lng ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION sync_job_location_geo();

-- 5. Create GIST index for fast spatial queries on jobs
CREATE INDEX IF NOT EXISTS idx_jobs_location_geo ON public.jobs USING GIST (location_geo);

-- 6. Composite index for jobs filtering
CREATE INDEX IF NOT EXISTS idx_jobs_status_deleted ON public.jobs (status, deleted_at) 
WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.jobs.location_geo IS 'PostGIS geography point for spatial queries';
