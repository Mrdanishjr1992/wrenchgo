-- Fix for get_mechanic_leads type mismatch error
-- Run this in Supabase SQL Editor

-- First drop ALL versions of the function
DROP FUNCTION IF EXISTS public.get_mechanic_leads(uuid, text, numeric, numeric, numeric, integer, integer, text);
DROP FUNCTION IF EXISTS public.get_mechanic_leads(uuid, text, double precision, double precision, numeric, integer, integer, text);
DROP FUNCTION IF EXISTS public.get_mechanic_leads;

-- Recreate with proper types and casts
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
AS $$
BEGIN
  RETURN QUERY
  WITH mechanic_quote AS (
    SELECT 
      q.job_id,
      q.id AS quote_id,
      q.price_cents,
      q.status AS quote_status,
      q.created_at AS quote_created_at
    FROM quotes q
    WHERE q.mechanic_id = p_mechanic_id
  ),
  customer_ratings AS (
    SELECT
      r.reviewee_id,
      AVG(r.rating)::numeric AS avg_rating,
      COUNT(*)::bigint AS review_count
    FROM reviews r
    GROUP BY r.reviewee_id
  )
  SELECT
    j.id AS job_id,
    j.title,
    j.description,
    j.status::text,
    j.created_at,
    j.preferred_time,
    j.location_address,
    CAST(j.location_lat AS numeric) AS latitude,
    CAST(j.location_lng AS numeric) AS longitude,
    CASE
      WHEN p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
      THEN CAST(
        3959 * acos(
          cos(radians(p_mechanic_lat::double precision)) *
          cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng::double precision)) +
          sin(radians(p_mechanic_lat::double precision)) *
          sin(radians(j.location_lat))
        ) AS numeric)
      ELSE NULL
    END AS distance_miles,
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
  LEFT JOIN customer_ratings cr ON cr.reviewee_id = p.id
  WHERE j.status = 'open'
    AND (p_filter = 'all' OR (p_filter = 'quoted' AND mq.quote_id IS NOT NULL) OR (p_filter = 'nearby'))
    AND (
      p_mechanic_lat IS NULL OR p_mechanic_lng IS NULL OR j.location_lat IS NULL OR j.location_lng IS NULL
      OR (
        3959 * acos(
          cos(radians(p_mechanic_lat::double precision)) *
          cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng::double precision)) +
          sin(radians(p_mechanic_lat::double precision)) *
          sin(radians(j.location_lat))
        )
      ) <= p_radius_miles
    )
  ORDER BY
    CASE WHEN p_sort_by = 'newest' THEN j.created_at END DESC,
    CASE WHEN p_sort_by = 'closest' THEN
      CASE
        WHEN p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
        THEN 3959 * acos(
          cos(radians(p_mechanic_lat::double precision)) *
          cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng::double precision)) +
          sin(radians(p_mechanic_lat::double precision)) *
          sin(radians(j.location_lat))
        )
        ELSE 999999
      END
    END ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;