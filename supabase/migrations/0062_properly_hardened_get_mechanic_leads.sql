-- Migration 0062: Properly Hardened get_mechanic_leads
--
-- SECURITY CHANGES:
-- 1. Mechanic location is ALWAYS fetched from profiles (home_lat/home_lng) - NOT client input
-- 2. Client-provided lat/lng is IGNORED for eligibility - only used for display fallback
-- 3. Mechanics without stored location get empty results (fail-secure)
-- 4. Jobs without valid location_geo are excluded
-- 5. Both mechanic AND job must be within an active service hub
--
-- PERFORMANCE CHANGES:
-- 1. Uses PostGIS ST_DWithin for indexed spatial queries
-- 2. Single EXISTS subquery for service hub validation
-- 3. CTE for customer ratings (avoids correlated subquery per row)
--
-- COLUMN MAPPING:
-- - App uses: profiles.home_lat, profiles.home_lng
-- - Jobs use: jobs.location_geo (from location_lat/location_lng via trigger)
-- - Service hubs use: service_hubs.location (generated from lat/lng)

SET search_path TO public, extensions;

-- Drop existing function to replace signature
DROP FUNCTION IF EXISTS public.get_mechanic_leads(uuid, text, numeric, numeric, numeric, integer, integer, text);

CREATE OR REPLACE FUNCTION public.get_mechanic_leads(
  p_mechanic_id uuid,
  p_filter text DEFAULT 'all',
  p_mechanic_lat numeric DEFAULT NULL,  -- IGNORED for eligibility, kept for API compat
  p_mechanic_lng numeric DEFAULT NULL,  -- IGNORED for eligibility, kept for API compat
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
  latitude numeric,
  longitude numeric,
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
SET search_path = public, extensions
STABLE
AS $$
DECLARE
  v_mechanic_geo geography;
  v_mechanic_lat numeric;
  v_mechanic_lng numeric;
  v_effective_radius_meters numeric;
  v_max_radius_miles constant numeric := 50; -- Hard cap prevents abuse
BEGIN
  -- ===========================================
  -- SECURITY: Fetch mechanic location from DATABASE (home_lat/home_lng)
  -- Client-provided lat/lng is NOT trusted for eligibility
  -- ===========================================
  SELECT
    prof.home_lat,
    prof.home_lng
  INTO v_mechanic_lat, v_mechanic_lng
  FROM profiles prof
  WHERE prof.id = p_mechanic_id
    AND prof.role = 'mechanic'
    AND prof.deleted_at IS NULL;

  -- FAIL-SECURE: No mechanic profile or no stored location = empty results
  IF v_mechanic_lat IS NULL OR v_mechanic_lng IS NULL THEN
    RETURN;
  END IF;

  -- Build geography from stored coordinates
  v_mechanic_geo := ST_SetSRID(ST_MakePoint(v_mechanic_lng, v_mechanic_lat), 4326)::geography;

  -- ===========================================
  -- SERVICE AREA CHECK: Mechanic must be within an active hub
  -- This prevents mechanics outside service areas from seeing any jobs
  -- ===========================================
  IF NOT EXISTS (
    SELECT 1 FROM service_hubs sh
    WHERE sh.is_active = true
      AND ST_DWithin(v_mechanic_geo, sh.location, sh.active_radius_miles * 1609.34)
  ) THEN
    RETURN;
  END IF;

  -- ===========================================
  -- RADIUS CALCULATION (capped for safety)
  -- ===========================================
  CASE p_filter
    WHEN 'nearby' THEN
      v_effective_radius_meters := 5 * 1609.34; -- 5 miles for "nearby"
    ELSE
      v_effective_radius_meters := LEAST(p_radius_miles, v_max_radius_miles) * 1609.34;
  END CASE;

  -- ===========================================
  -- MAIN QUERY with PostGIS spatial filtering
  -- ===========================================
  RETURN QUERY
  WITH mechanic_quotes AS (
    SELECT 
      q.job_id,
      q.id AS quote_id,
      q.price_cents,
      q.status::text AS quote_status,
      q.created_at AS quote_created_at
    FROM quotes q
    WHERE q.mechanic_id = p_mechanic_id
  ),
  customer_ratings AS (
    SELECT
      r.reviewee_id,
      AVG(r.overall_rating)::numeric AS avg_rating,
      COUNT(*)::bigint AS review_count
    FROM reviews r
    WHERE r.is_hidden = false
      AND r.deleted_at IS NULL
    GROUP BY r.reviewee_id
  )
  SELECT
    j.id AS job_id,
    j.title::text,
    j.description::text,
    j.status::text,
    j.created_at,
    j.preferred_time::text,
    j.location_address::text,
    COALESCE(j.location_lat, j.job_lat)::numeric AS latitude,
    COALESCE(j.location_lng, j.job_lng)::numeric AS longitude,
    -- Distance in miles using PostGIS (accurate, handles edge cases)
    ROUND((ST_Distance(v_mechanic_geo, j.location_geo) / 1609.34)::numeric, 1) AS distance_miles,
    p.id AS customer_id,
    p.full_name::text AS customer_name,
    p.avatar_url::text AS customer_photo_url,
    COALESCE(cr.avg_rating, 0)::numeric AS customer_rating,
    COALESCE(cr.review_count, 0)::bigint AS customer_review_count,
    j.vehicle_id,
    v.year AS vehicle_year,
    v.make::text AS vehicle_make,
    v.model::text AS vehicle_model,
    (mq.quote_id IS NOT NULL)::boolean AS has_quoted,
    mq.quote_id,
    mq.price_cents::integer AS quote_amount,
    mq.quote_status,
    mq.quote_created_at,
    (j.created_at > NOW() - INTERVAL '24 hours')::boolean AS is_new
  FROM jobs j
  INNER JOIN profiles p ON p.id = j.customer_id
  LEFT JOIN vehicles v ON v.id = j.vehicle_id
  LEFT JOIN mechanic_quotes mq ON mq.job_id = j.id
  LEFT JOIN customer_ratings cr ON cr.reviewee_id = p.id
  WHERE
    -- Soft delete checks
    j.deleted_at IS NULL
    AND p.deleted_at IS NULL
    
    -- NULL SAFETY: Job must have valid coordinates
    AND j.location_geo IS NOT NULL
    
    -- SERVICE AREA: Job must be within an active hub's radius
    -- This is the single enforcement point for service area compliance
    AND EXISTS (
      SELECT 1 FROM service_hubs sh
      WHERE sh.is_active = true
        AND ST_DWithin(j.location_geo, sh.location, sh.active_radius_miles * 1609.34)
    )
    
    -- DISTANCE: Job within mechanic's requested radius (capped)
    AND ST_DWithin(v_mechanic_geo, j.location_geo, v_effective_radius_meters)
    
    -- STATUS FILTER: Only show appropriate job statuses
    AND (
      CASE p_filter
        WHEN 'quoted' THEN 
          mq.quote_id IS NOT NULL  -- Jobs this mechanic has quoted
        ELSE 
          -- 'all' and 'nearby': show open jobs (searching/quoted status)
          j.status IN ('searching', 'quoted', 'open')
      END
    )
    
    -- FUTURE: Anti-disintermediation weighting could go here
    -- AND (p.risk_score IS NULL OR p.risk_score < 0.8)
    
  ORDER BY
    CASE WHEN p_sort_by = 'newest' THEN j.created_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'closest' THEN ST_Distance(v_mechanic_geo, j.location_geo) END ASC NULLS LAST,
    j.created_at DESC  -- Secondary sort for stability
  LIMIT LEAST(p_limit, 100)  -- Hard cap on results
  OFFSET p_offset;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_mechanic_leads TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_mechanic_leads IS
'Hardened job leads function for mechanics.
SECURITY: Uses DB-stored mechanic location (profiles.home_lat/home_lng), NOT client-provided coordinates.
REQUIREMENTS:
  - Mechanic must have home_lat and home_lng set in profiles
  - Mechanic must be within an active service hub
  - Jobs must be within an active service hub
  - Jobs must have valid location_geo
Client-provided p_mechanic_lat/p_mechanic_lng are IGNORED for eligibility (kept for API compatibility only).';

-- ===========================================
-- MIGRATION SAFETY: Ensure prerequisites exist
-- ===========================================

-- Ensure profiles has home_lat/home_lng columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'home_lat'
  ) THEN
    RAISE EXCEPTION 'Missing prerequisite: profiles.home_lat column.';
  END IF;
END $$;

-- Ensure jobs has location_geo column (from 0060)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'location_geo'
  ) THEN
    RAISE EXCEPTION 'Missing prerequisite: jobs.location_geo column. Run migration 0060 first.';
  END IF;
END $$;

-- Ensure service_hubs table exists (from 0031)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'service_hubs'
  ) THEN
    RAISE EXCEPTION 'Missing prerequisite: service_hubs table. Run migration 0031 first.';
  END IF;
END $$;
