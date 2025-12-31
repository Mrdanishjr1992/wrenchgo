CREATE OR REPLACE FUNCTION public.get_mechanic_leads(
  p_mechanic_id UUID,
  p_filter TEXT DEFAULT 'all', -- 'all', 'nearby', 'quoted'
  p_mechanic_lat DOUBLE PRECISION DEFAULT NULL,
  p_mechanic_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_miles INTEGER DEFAULT 25,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_sort_by TEXT DEFAULT 'newest' -- 'newest', 'closest', 'highest_value'
)
RETURNS TABLE(
  job_id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  preferred_time TIMESTAMPTZ,
  location_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_miles DOUBLE PRECISION,
  customer_id UUID,
  customer_name TEXT,
  customer_photo_url TEXT,
  customer_rating NUMERIC,
  customer_review_count INTEGER,
  vehicle_id UUID,
  vehicle_year INTEGER,
  vehicle_make TEXT,
  vehicle_model TEXT,
  has_quoted BOOLEAN,
  quote_id UUID,
  quote_amount NUMERIC,
  quote_status TEXT,
  quote_created_at TIMESTAMPTZ,
  is_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_lat DOUBLE PRECISION;
  v_mechanic_lng DOUBLE PRECISION;
  v_radius DOUBLE PRECISION;
BEGIN
  -- Get mechanic's location if not provided
  IF p_mechanic_lat IS NULL OR p_mechanic_lng IS NULL THEN
    SELECT home_latitude, home_longitude, COALESCE(service_radius_miles, 25)
    INTO v_mechanic_lat, v_mechanic_lng, v_radius
    FROM profiles
    WHERE id = p_mechanic_id;
  ELSE
    v_mechanic_lat := p_mechanic_lat;
    v_mechanic_lng := p_mechanic_lng;
    v_radius := p_radius_miles;
  END IF;

  -- Return leads based on filter type
  RETURN QUERY
  WITH job_quotes AS (
    SELECT DISTINCT ON (q.job_id)
      q.job_id,
      q.id AS quote_id,
      q.price_cents::NUMERIC AS quote_amount,
      q.status::TEXT AS quote_status,
      q.created_at AS quote_created_at
    FROM quotes q
    WHERE q.mechanic_id = p_mechanic_id
    ORDER BY q.job_id, q.created_at DESC
  ),
  customer_ratings AS (
    SELECT
      r.reviewee_id AS customer_id,
      AVG(r.overall_rating) AS avg_rating,
      COUNT(r.id)::INTEGER AS review_count
    FROM reviews r
    WHERE r.reviewee_role = 'customer'
      AND r.is_hidden = false
    GROUP BY r.reviewee_id
  ),
  job_data AS (
    SELECT
      j.id AS job_id,
      j.title,
      j.description,
      j.status::TEXT AS status,
      j.created_at,
      j.preferred_time::TIMESTAMPTZ AS preferred_time,
      j.location_address,
      ST_Y(j.location::geometry) AS latitude,
      ST_X(j.location::geometry) AS longitude,
      -- Calculate distance in miles using Haversine formula
      CASE
        WHEN j.location IS NOT NULL
             AND v_mechanic_lat IS NOT NULL AND v_mechanic_lng IS NOT NULL
        THEN (
          3959 * acos(
            cos(radians(v_mechanic_lat)) *
            cos(radians(ST_Y(j.location::geometry))) *
            cos(radians(ST_X(j.location::geometry)) - radians(v_mechanic_lng)) +
            sin(radians(v_mechanic_lat)) *
            sin(radians(ST_Y(j.location::geometry)))
          )
        )
        ELSE NULL
      END AS distance_miles,
      j.customer_id,
      p.full_name AS customer_name,
      p.photo_url AS customer_photo_url,
      COALESCE(cr.avg_rating, 0::NUMERIC) AS customer_rating,
      COALESCE(cr.review_count, 0) AS customer_review_count,
      j.vehicle_id,
      v.year::INTEGER AS vehicle_year,
      v.make AS vehicle_make,
      v.model AS vehicle_model,
      CASE WHEN jq.quote_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_quoted,
      jq.quote_id,
      jq.quote_amount,
      jq.quote_status,
      jq.quote_created_at,
      (j.created_at > NOW() - INTERVAL '2 hours') AS is_new
    FROM jobs j
    INNER JOIN profiles p ON j.customer_id = p.id
    LEFT JOIN vehicles v ON j.vehicle_id = v.id
    LEFT JOIN job_quotes jq ON j.id = jq.job_id
    LEFT JOIN customer_ratings cr ON j.customer_id = cr.customer_id
    WHERE
      j.status = 'searching'
      AND j.deleted_at IS NULL
      AND j.canceled_at IS NULL
      AND (
        (p_filter = 'all' AND jq.quote_id IS NULL)
        OR
        (p_filter = 'nearby'
         AND jq.quote_id IS NULL
         AND j.location IS NOT NULL
         AND v_mechanic_lat IS NOT NULL
         AND v_mechanic_lng IS NOT NULL
         AND (
           3959 * acos(
             cos(radians(v_mechanic_lat)) *
             cos(radians(ST_Y(j.location::geometry))) *
             cos(radians(ST_X(j.location::geometry)) - radians(v_mechanic_lng)) +
             sin(radians(v_mechanic_lat)) *
             sin(radians(ST_Y(j.location::geometry)))
           )
         ) <= v_radius
        )
        OR
        (p_filter = 'quoted' AND jq.quote_id IS NOT NULL)
      )
  )
  SELECT 
    jd.job_id,
    jd.title,
    jd.description,
    jd.status,
    jd.created_at,
    jd.preferred_time,
    jd.location_address,
    jd.latitude,
    jd.longitude,
    jd.distance_miles,
    jd.customer_id,
    jd.customer_name,
    jd.customer_photo_url,
    jd.customer_rating,
    jd.customer_review_count,
    jd.vehicle_id,
    jd.vehicle_year,
    jd.vehicle_make,
    jd.vehicle_model,
    jd.has_quoted,
    jd.quote_id,
    jd.quote_amount,
    jd.quote_status,
    jd.quote_created_at,
    jd.is_new
  FROM job_data jd
  ORDER BY
    CASE WHEN p_sort_by = 'newest' THEN jd.created_at END DESC,
    CASE WHEN p_sort_by = 'closest' THEN jd.distance_miles END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'highest_value' THEN jd.quote_amount END DESC NULLS LAST,
    jd.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- FUNCTION: get_mechanic_leads_summary
-- Returns count of leads for each filter type
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_mechanic_leads_summary(
  p_mechanic_id UUID,
  p_mechanic_lat DOUBLE PRECISION DEFAULT NULL,
  p_mechanic_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_miles INTEGER DEFAULT 25
)
RETURNS TABLE(
  all_count INTEGER,
  nearby_count INTEGER,
  quoted_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_lat DOUBLE PRECISION;
  v_mechanic_lng DOUBLE PRECISION;
  v_radius DOUBLE PRECISION;
BEGIN
  -- Get mechanic's location if not provided
  IF p_mechanic_lat IS NULL OR p_mechanic_lng IS NULL THEN
    SELECT home_latitude, home_longitude, COALESCE(service_radius_miles, 25)
    INTO v_mechanic_lat, v_mechanic_lng, v_radius
    FROM profiles
    WHERE id = p_mechanic_id;
  ELSE
    v_mechanic_lat := p_mechanic_lat;
    v_mechanic_lng := p_mechanic_lng;
    v_radius := p_radius_miles;
  END IF;

  RETURN QUERY
  WITH job_quotes AS (
    SELECT q.job_id
    FROM quotes q
    WHERE q.mechanic_id = p_mechanic_id
  )
  SELECT
    -- All: count all open jobs
    (SELECT COUNT(*)::INTEGER
     FROM jobs j
     WHERE j.status = 'searching'
       AND j.deleted_at IS NULL
       AND j.canceled_at IS NULL
    ) AS all_count,

    -- Nearby: count jobs within radius
    (SELECT COUNT(*)::INTEGER
     FROM jobs j
     WHERE j.status = 'searching'
       AND j.deleted_at IS NULL
       AND j.canceled_at IS NULL
       AND j.location IS NOT NULL
       AND v_mechanic_lat IS NOT NULL
       AND v_mechanic_lng IS NOT NULL
       AND (
         3959 * acos(
           cos(radians(v_mechanic_lat)) *
           cos(radians(ST_Y(j.location::geometry))) *
           cos(radians(ST_X(j.location::geometry)) - radians(v_mechanic_lng)) +
           sin(radians(v_mechanic_lat)) *
           sin(radians(ST_Y(j.location::geometry)))
         )
       ) <= v_radius
    ) AS nearby_count,

    -- Quoted: count jobs where this mechanic has quoted
    (SELECT COUNT(*)::INTEGER
     FROM jobs j
     INNER JOIN job_quotes jq ON j.id = jq.job_id
     WHERE j.status = 'searching'
       AND j.deleted_at IS NULL
       AND j.canceled_at IS NULL
    ) AS quoted_count;
END;
$$;