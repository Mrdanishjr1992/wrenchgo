-- =====================================================
-- FIX GET_MECHANIC_LEADS RPC - PHOTO_URL → AVATAR_URL
-- =====================================================
-- Purpose: Fix the get_mechanic_leads RPC to use avatar_url instead of photo_url
-- Issue: RPC was querying p.photo_url which doesn't exist in profiles table
-- =====================================================

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS public.get_mechanic_leads CASCADE;

-- Create or replace the get_mechanic_leads function with correct column names
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
    j.status,
    j.preferred_time,
    j.created_at,
    p.id AS customer_id,
    p.full_name AS customer_name,
    p.avatar_url AS customer_photo_url,  -- FIXED: was p.photo_url
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
      )
      ELSE NULL
    END AS distance_miles,
    (SELECT COUNT(*)::integer FROM quote_requests WHERE job_id = j.id) AS quote_count,
    EXISTS(SELECT 1 FROM quote_requests WHERE job_id = j.id AND mechanic_id = p_mechanic_id) AS has_quoted
  FROM jobs j
  INNER JOIN profiles p ON p.auth_id = j.customer_id
  LEFT JOIN vehicles v ON v.id = j.vehicle_id
  WHERE
    j.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (
      (p_filter = 'all' AND j.status IN ('pending', 'quoted'))
      OR (p_filter = 'new' AND j.status = 'pending' AND NOT EXISTS(SELECT 1 FROM quote_requests WHERE job_id = j.id AND mechanic_id = p_mechanic_id))
      OR (p_filter = 'quoted' AND EXISTS(SELECT 1 FROM quote_requests WHERE job_id = j.id AND mechanic_id = p_mechanic_id))
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
    END ASC,
    j.location_lat,
    j.location_lng
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.get_mechanic_leads IS 'Returns job leads for mechanics with correct avatar_url column';

GRANT EXECUTE ON FUNCTION public.get_mechanic_leads TO authenticated;

-- =====================================================
-- FIX GET_MECHANIC_LEADS_SUMMARY RPC
-- =====================================================

DROP FUNCTION IF EXISTS public.get_mechanic_leads_summary CASCADE;

CREATE OR REPLACE FUNCTION public.get_mechanic_leads_summary(
  p_mechanic_id uuid,
  p_mechanic_lat numeric DEFAULT NULL,
  p_mechanic_lng numeric DEFAULT NULL,
  p_radius_miles numeric DEFAULT 25
)
RETURNS TABLE (
  total_leads integer,
  new_leads integer,
  quoted_leads integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::integer AS total_leads,
    COUNT(*) FILTER (WHERE j.status = 'pending' AND NOT EXISTS(SELECT 1 FROM quote_requests WHERE job_id = j.id AND mechanic_id = p_mechanic_id))::integer AS new_leads,
    COUNT(*) FILTER (WHERE EXISTS(SELECT 1 FROM quote_requests WHERE job_id = j.id AND mechanic_id = p_mechanic_id))::integer AS quoted_leads
  FROM jobs j
  INNER JOIN profiles p ON p.auth_id = j.customer_id
  WHERE
    j.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND j.status IN ('pending', 'quoted')
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
    );
END;
$$;

COMMENT ON FUNCTION public.get_mechanic_leads_summary IS 'Returns summary counts for mechanic leads';

GRANT EXECUTE ON FUNCTION public.get_mechanic_leads_summary TO authenticated;
