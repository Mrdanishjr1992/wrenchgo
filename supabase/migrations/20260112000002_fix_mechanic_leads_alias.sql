-- Fix get_mechanic_leads alias mismatch
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
  v_mechanic record;
  v_policy jsonb;
  v_effective_radius double precision;
  v_blocked_keys text[];
BEGIN
  SELECT mp.*, p.role
  INTO v_mechanic
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON p.id = mp.id
  WHERE mp.id = p_mechanic_id;
  
  IF v_mechanic IS NULL OR v_mechanic.verification_status IS NULL OR v_mechanic.verification_status != 'active' THEN
    RETURN;
  END IF;

  v_policy := get_effective_mechanic_policy(NULL);

  v_effective_radius := p_radius_miles;
  IF v_mechanic.tier = 'probation' THEN
    v_effective_radius := LEAST(
      p_radius_miles,
      COALESCE(
        v_mechanic.max_lead_radius_miles_override,
        (v_policy->>'probation.max_radius_miles')::numeric,
        15
      )
    );
  END IF;

  v_blocked_keys := CASE 
    WHEN v_mechanic.tier = 'probation' THEN
      COALESCE(
        v_mechanic.blocked_symptom_keys,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_policy->'probation.blocked_symptom_keys', '[]'::jsonb)))
      )
    ELSE
      ARRAY[]::text[]
  END;

  RETURN QUERY
  SELECT
    j.id as job_id,
    j.title,
    j.description,
    j.status::text,
    j.preferred_time,
    ve.year as vehicle_year,
    ve.make as vehicle_make,
    ve.model as vehicle_model,
    ve.vin as vehicle_vin,
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
  LEFT JOIN public.vehicles ve ON ve.id = j.vehicle_id
  WHERE j.status = 'searching'::job_status
    AND (array_length(v_blocked_keys, 1) IS NULL OR j.symptom_key IS NULL OR NOT (j.symptom_key = ANY(v_blocked_keys)))
    AND (p_filter = 'all' OR p_filter IS NULL OR
         (p_filter = 'nearby' AND p_mechanic_lat IS NOT NULL) OR
         (p_filter = 'quoted' AND EXISTS(SELECT 1 FROM public.quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id)))
    AND (v_effective_radius IS NULL OR p_mechanic_lat IS NULL OR p_mechanic_lng IS NULL OR
         j.location_lat IS NULL OR j.location_lng IS NULL OR
         (3959 * acos(
           cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
           cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
           sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
         )) <= v_effective_radius)
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
