-- Fix get_mechanic_leads to show quoted jobs properly - cast enum explicitly
BEGIN;

DROP FUNCTION IF EXISTS public.get_mechanic_leads(uuid, text, double precision, double precision, double precision, integer, integer, text);

CREATE OR REPLACE FUNCTION public.get_mechanic_leads(
  p_mechanic_id uuid,
  p_filter text,
  p_mechanic_lat double precision,
  p_mechanic_lng double precision,
  p_radius_miles double precision,
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
  vehicle_year int,
  vehicle_make text,
  vehicle_model text,
  vehicle_vin text,
  location_lat double precision,
  location_lng double precision,
  location_address text,
  customer_id uuid,
  customer_name text,
  customer_avatar text,
  created_at timestamptz,
  distance_miles numeric,
  quote_count bigint,
  has_quoted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verification_status text;
BEGIN
  SELECT mp.verification_status INTO v_verification_status
  FROM public.mechanic_profiles mp
  WHERE mp.id = p_mechanic_id;
  
  IF v_verification_status IS NULL OR v_verification_status != 'active' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    j.id as job_id,
    j.title,
    j.description,
    j.status::text,
    j.preferred_time,
    v.year as vehicle_year,
    v.make as vehicle_make,
    v.model as vehicle_model,
    v.vin as vehicle_vin,
    j.location_lat,
    j.location_lng,
    j.location_address,
    j.customer_id,
    p.full_name as customer_name,
    p.avatar_url as customer_avatar,
    j.created_at,
    CASE
      WHEN p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL
           AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
      THEN ROUND((
        3959 * acos(
          cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
          sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
        )
      )::numeric, 1)
      ELSE NULL
    END as distance_miles,
    (SELECT COUNT(*) FROM public.quotes q WHERE q.job_id = j.id) as quote_count,
    EXISTS(SELECT 1 FROM public.quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id) as has_quoted
  FROM public.jobs j
  JOIN public.profiles p ON p.id = j.customer_id
  LEFT JOIN public.vehicles v ON v.id = j.vehicle_id
  WHERE 
    -- All filters show jobs in searching or quoted status (cast to text for comparison)
    j.status::text IN ('searching', 'quoted')
    -- For 'quoted' filter, additionally require mechanic has quoted
    AND (
      p_filter IS NULL
      OR p_filter = 'all'
      OR p_filter = 'nearby'
      OR (p_filter = 'quoted' AND EXISTS(SELECT 1 FROM public.quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id))
    )
    AND (p_radius_miles IS NULL OR p_mechanic_lat IS NULL OR p_mechanic_lng IS NULL OR
         j.location_lat IS NULL OR j.location_lng IS NULL OR
         (3959 * acos(
           cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
           cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
           sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
         )) <= p_radius_miles)
  ORDER BY
    CASE WHEN p_sort_by = 'newest' THEN j.created_at END DESC,
    CASE WHEN p_sort_by = 'closest' AND p_mechanic_lat IS NOT NULL THEN
      3959 * acos(
        cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
        cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
        sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
      )
    END ASC NULLS LAST,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_leads(uuid, text, double precision, double precision, double precision, integer, integer, text) TO authenticated;

COMMIT;
