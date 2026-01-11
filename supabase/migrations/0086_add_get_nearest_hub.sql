-- ============================================================================
-- Migration: 20250213000011_add_get_nearest_hub.sql
-- ============================================================================
-- Purpose: Add RPC function to find nearest service hub for a location
-- Dependencies: 20250213000001 (service_hubs table)
-- Risk Level: Low (new function)
-- Rollback: DROP FUNCTION get_nearest_hub;
-- ============================================================================

-- Create get_nearest_hub function for service area checks
-- Returns the nearest hub and distance info for a given location

-- Drop all existing versions to avoid overload conflicts
DROP FUNCTION IF EXISTS get_nearest_hub(double precision, double precision);
DROP FUNCTION IF EXISTS get_nearest_hub(numeric, numeric);
DROP FUNCTION IF EXISTS get_nearest_hub(decimal, decimal);

CREATE OR REPLACE FUNCTION get_nearest_hub(check_lat double precision, check_lng double precision)
RETURNS TABLE (
  hub_id uuid,
  hub_name varchar,
  hub_slug varchar,
  distance_miles numeric,
  radius_miles integer,
  active_radius_miles integer,
  is_within_area boolean,
  invite_only boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id AS hub_id,
    h.name AS hub_name,
    h.slug AS hub_slug,
    ROUND((3959 * acos(
      cos(radians(h.lat)) * cos(radians(check_lat)) *
      cos(radians(check_lng) - radians(h.lng)) +
      sin(radians(h.lat)) * sin(radians(check_lat))
    ))::numeric, 1) AS distance_miles,
    h.max_radius_miles AS radius_miles,
    h.active_radius_miles,
    (3959 * acos(
      cos(radians(h.lat)) * cos(radians(check_lat)) *
      cos(radians(check_lng) - radians(h.lng)) +
      sin(radians(h.lat)) * sin(radians(check_lat))
    )) <= h.active_radius_miles AS is_within_area,
    h.invite_only
  FROM service_hubs h
  WHERE h.is_active = true
  ORDER BY (3959 * acos(
    cos(radians(h.lat)) * cos(radians(check_lat)) *
    cos(radians(check_lng) - radians(h.lng)) +
    sin(radians(h.lat)) * sin(radians(check_lat))
  )) ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_nearest_hub(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearest_hub(double precision, double precision) TO anon;
