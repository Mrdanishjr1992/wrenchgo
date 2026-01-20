-- Fix get_hub_recommendations RPC to not use columns that don't exist in waitlist table

CREATE OR REPLACE FUNCTION public.get_hub_recommendations()
RETURNS TABLE (
  zip_prefix TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  customer_count BIGINT,
  mechanic_count BIGINT,
  avg_distance DOUBLE PRECISION,
  demand_score DOUBLE PRECISION,
  supply_score DOUBLE PRECISION,
  readiness_score DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    LEFT(w.zip, 3) AS zip_prefix,
    CONCAT('ZIP ', LEFT(w.zip, 3), 'xxx')::TEXT AS city,
    ''::TEXT AS state,
    'US'::TEXT AS country,
    AVG(w.lat)::DOUBLE PRECISION AS lat,
    AVG(w.lng)::DOUBLE PRECISION AS lng,
    COUNT(*) FILTER (WHERE w.user_type = 'customer') AS customer_count,
    COUNT(*) FILTER (WHERE w.user_type = 'mechanic') AS mechanic_count,
    AVG(w.distance_miles)::DOUBLE PRECISION AS avg_distance,
    LEAST(100, COUNT(*) FILTER (WHERE w.user_type = 'customer') * 10)::DOUBLE PRECISION AS demand_score,
    LEAST(100, COUNT(*) FILTER (WHERE w.user_type = 'mechanic') * 20)::DOUBLE PRECISION AS supply_score,
    LEAST(100, (
      COUNT(*) FILTER (WHERE w.user_type = 'customer') * 6 +
      COUNT(*) FILTER (WHERE w.user_type = 'mechanic') * 8
    ))::DOUBLE PRECISION AS readiness_score
  FROM public.waitlist w
  WHERE w.zip IS NOT NULL
    AND w.lat IS NOT NULL
    AND w.lng IS NOT NULL
    AND w.nearest_hub_id IS NULL
    AND w.converted_at IS NULL
    AND w.invited_at IS NULL
  GROUP BY LEFT(w.zip, 3)
  HAVING COUNT(*) >= 5
  ORDER BY readiness_score DESC, demand_score DESC
  LIMIT 20;
END;
$$;