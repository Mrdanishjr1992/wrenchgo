-- Migration 0068: Fix job_status enum - remove 'open' which doesn't exist

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
SET search_path = public
STABLE
AS $$
DECLARE
  v_mechanic_lat numeric;
  v_mechanic_lng numeric;
  v_effective_radius_km numeric;
  v_max_radius_miles constant numeric := 50;
BEGIN
  SELECT prof.home_lat, prof.home_lng
  INTO v_mechanic_lat, v_mechanic_lng
  FROM profiles prof
  WHERE prof.id = p_mechanic_id
    AND prof.role = 'mechanic'
    AND prof.deleted_at IS NULL;

  IF v_mechanic_lat IS NULL OR v_mechanic_lng IS NULL THEN
    RETURN;
  END IF;

  CASE p_filter
    WHEN 'nearby' THEN
      v_effective_radius_km := 5 * 1.60934;
    ELSE
      v_effective_radius_km := LEAST(p_radius_miles, v_max_radius_miles) * 1.60934;
  END CASE;

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
    ROUND((calculate_distance_km(v_mechanic_lat, v_mechanic_lng, 
      COALESCE(j.location_lat, j.job_lat), COALESCE(j.location_lng, j.job_lng)) / 1.60934)::numeric, 1) AS distance_miles,
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
    j.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (j.location_lat IS NOT NULL OR j.job_lat IS NOT NULL)
    AND (j.location_lng IS NOT NULL OR j.job_lng IS NOT NULL)
    AND calculate_distance_km(v_mechanic_lat, v_mechanic_lng, 
        COALESCE(j.location_lat, j.job_lat), COALESCE(j.location_lng, j.job_lng)) <= v_effective_radius_km
    AND (
      CASE p_filter
        WHEN 'quoted' THEN mq.quote_id IS NOT NULL
        ELSE j.status IN ('searching', 'quoted')
      END
    )
  ORDER BY
    CASE WHEN p_sort_by = 'distance' THEN 
      calculate_distance_km(v_mechanic_lat, v_mechanic_lng, COALESCE(j.location_lat, j.job_lat), COALESCE(j.location_lng, j.job_lng))
    END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'newest' OR p_sort_by IS NULL THEN j.created_at END DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
