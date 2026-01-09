-- Migration: Hardened get_mechanic_leads with PostGIS and service area enforcement
-- Replaces client-trusted location with DB-enforced mechanic location

SET search_path TO public, extensions;

-- Drop and recreate the function with security hardening
DROP FUNCTION IF EXISTS public.get_mechanic_leads(uuid, text, numeric, numeric, numeric, integer, integer, text);

CREATE OR REPLACE FUNCTION public.get_mechanic_leads(
  p_mechanic_id uuid,
  p_filter text DEFAULT 'all',
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
AS $$
DECLARE
  v_mechanic_geo geography;
  v_effective_radius_meters numeric;
  v_has_active_hub boolean;
BEGIN
  -- ===========================================
  -- Build mechanic geography from provided lat/lng
  -- (In future: fetch from mechanic_profiles.location_geo)
  -- ===========================================
  IF p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL THEN
    v_mechanic_geo := ST_SetSRID(ST_MakePoint(p_mechanic_lng, p_mechanic_lat), 4326)::geography;
  ELSE
    RETURN;
  END IF;

  -- ===========================================
  -- SERVICE AREA CHECK: Mechanic must be in an active hub
  -- Uses service_hubs.location (geography) and active_radius_miles
  -- ===========================================
  SELECT EXISTS(
    SELECT 1 FROM service_hubs sh
    WHERE sh.is_active = true
      AND ST_DWithin(v_mechanic_geo, sh.location, sh.active_radius_miles * 1609.34)
  ) INTO v_has_active_hub;

  IF NOT v_has_active_hub THEN
    RETURN;
  END IF;

  -- ===========================================
  -- RADIUS CALCULATION
  -- ===========================================
  IF p_filter = 'nearby' THEN
    v_effective_radius_meters := 5 * 1609.34;
  ELSE
    v_effective_radius_meters := LEAST(p_radius_miles, 50) * 1609.34;
  END IF;

  -- ===========================================
  -- MAIN QUERY with PostGIS spatial filtering
  -- ===========================================
  RETURN QUERY
  WITH mechanic_quote AS (
    SELECT 
      q.job_id,
      q.id AS quote_id,
      q.price_cents,
      q.status::text AS quote_status,
      q.created_at AS quote_created_at
    FROM quotes q
    WHERE q.mechanic_id = p_mechanic_id
  )
  SELECT
    j.id AS job_id,
    j.title,
    j.description,
    j.status::text,
    j.created_at,
    j.preferred_time,
    j.location_address,
    j.location_lat::numeric AS latitude,
    j.location_lng::numeric AS longitude,
    (ST_Distance(v_mechanic_geo, j.location_geo) / 1609.34)::numeric AS distance_miles,
    p.id AS customer_id,
    p.full_name AS customer_name,
    p.avatar_url AS customer_photo_url,
    COALESCE(cr.avg_rating, 0)::numeric AS customer_rating,
    COALESCE(cr.review_count, 0)::bigint AS customer_review_count,
    j.vehicle_id,
    v.year AS vehicle_year,
    v.make AS vehicle_make,
    v.model AS vehicle_model,
    (mq.quote_id IS NOT NULL) AS has_quoted,
    mq.quote_id,
    mq.price_cents AS quote_amount,
    mq.quote_status,
    mq.quote_created_at,
    (j.created_at > NOW() - INTERVAL '24 hours') AS is_new
  FROM jobs j
  INNER JOIN profiles p ON p.id = j.customer_id
  LEFT JOIN vehicles v ON v.id = j.vehicle_id
  LEFT JOIN mechanic_quote mq ON mq.job_id = j.id
  LEFT JOIN LATERAL (
    SELECT 
      AVG(r.overall_rating) AS avg_rating,
      COUNT(*) AS review_count
    FROM reviews r
    WHERE r.reviewee_id = p.id
      AND r.is_hidden = false
      AND r.deleted_at IS NULL
  ) cr ON true
  WHERE
    j.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND j.location_geo IS NOT NULL
    -- SERVICE AREA: Job must be in an active hub
    AND EXISTS(
      SELECT 1 FROM service_hubs sh
      WHERE sh.is_active = true
        AND ST_DWithin(j.location_geo, sh.location, sh.active_radius_miles * 1609.34)
    )
    -- DISTANCE: Job within mechanic's effective radius
    AND ST_DWithin(v_mechanic_geo, j.location_geo, v_effective_radius_meters)
    -- FILTER LOGIC
    AND (
      CASE p_filter
        WHEN 'all' THEN j.status IN ('searching', 'quoted')
        WHEN 'nearby' THEN j.status IN ('searching', 'quoted')
        WHEN 'quoted' THEN mq.quote_id IS NOT NULL
        ELSE j.status IN ('searching', 'quoted')
      END
    )
  ORDER BY
    CASE WHEN p_sort_by = 'newest' THEN j.created_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'closest' THEN ST_Distance(v_mechanic_geo, j.location_geo) END ASC NULLS LAST,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_leads TO authenticated;

COMMENT ON FUNCTION public.get_mechanic_leads IS 
'Returns jobs visible to a mechanic within active service hubs. Uses PostGIS for performance.';
