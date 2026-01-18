-- Fix get_mechanic_leads_summary to match leads function - only count quotable jobs
BEGIN;

DROP FUNCTION IF EXISTS public.get_mechanic_leads_summary(uuid, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.get_mechanic_leads_summary(uuid, double precision, double precision, double precision);

CREATE OR REPLACE FUNCTION public.get_mechanic_leads_summary(
  p_mechanic_id uuid,
  p_mechanic_lat double precision DEFAULT NULL,
  p_mechanic_lng double precision DEFAULT NULL,
  p_radius_miles double precision DEFAULT 25
)
RETURNS TABLE (
  all_count bigint,
  nearby_count bigint,
  quoted_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- all_count: jobs within mechanic's service radius (searching or quoted status only)
    (SELECT COUNT(*) FROM jobs j
     INNER JOIN profiles p ON p.id = j.customer_id
     WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL
     AND j.status::text IN ('searching', 'quoted')
     AND (
       p_mechanic_lat IS NULL OR p_mechanic_lng IS NULL
       OR j.location_lat IS NULL OR j.location_lng IS NULL
       OR (3959 * acos(
         cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
         cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
         sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
       )) <= p_radius_miles
     )
    ) AS all_count,
    -- nearby_count: jobs within 5 miles (searching or quoted status only)
    (SELECT COUNT(*) FROM jobs j
     INNER JOIN profiles p ON p.id = j.customer_id
     WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL
     AND j.status::text IN ('searching', 'quoted')
     AND (
       p_mechanic_lat IS NULL OR p_mechanic_lng IS NULL
       OR j.location_lat IS NULL OR j.location_lng IS NULL
       OR (3959 * acos(
         cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
         cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
         sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
       )) <= 5
     )
    ) AS nearby_count,
    -- quoted_count: jobs mechanic has quoted on (that are still in searching/quoted status)
    (SELECT COUNT(*) FROM jobs j
     INNER JOIN profiles p ON p.id = j.customer_id
     WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL
     AND j.status::text IN ('searching', 'quoted')
     AND EXISTS(SELECT 1 FROM quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id)
    ) AS quoted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_leads_summary(uuid, double precision, double precision, double precision) TO authenticated;

COMMIT;
