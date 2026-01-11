-- ============================================================================
-- Migration: 20250213000010_add_check_customer_service_area.sql
-- ============================================================================
-- Purpose: Add functions to check if customer/user/location is within service area
-- Dependencies: 20250213000001 (service_hubs), 20250111000001 (profiles)
-- Risk Level: Low (new functions)
-- Rollback: DROP FUNCTION check_customer_service_area, check_user_service_area, check_location_in_service_area;
-- ============================================================================

-- Create check_customer_service_area function
-- Returns true if customer location is within any active service hub's radius

CREATE OR REPLACE FUNCTION check_customer_service_area(p_customer_id uuid)
RETURNS boolean AS $$
DECLARE
  customer_lat double precision;
  customer_lng double precision;
  is_in_area boolean := false;
BEGIN
  SELECT home_lat, home_lng INTO customer_lat, customer_lng
  FROM profiles
  WHERE id = p_customer_id AND deleted_at IS NULL;

  IF customer_lat IS NULL OR customer_lng IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM service_hubs h
    WHERE h.is_active = true
      AND (3959 * acos(
        cos(radians(h.lat)) * cos(radians(customer_lat)) *
        cos(radians(customer_lng) - radians(h.lng)) +
        sin(radians(h.lat)) * sin(radians(customer_lat))
      )) <= h.active_radius_miles
  ) INTO is_in_area;

  RETURN is_in_area;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Generic function that works for any user (customer or mechanic)
CREATE OR REPLACE FUNCTION check_user_service_area(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  user_lat double precision;
  user_lng double precision;
  is_in_area boolean := false;
BEGIN
  SELECT home_lat, home_lng INTO user_lat, user_lng
  FROM profiles
  WHERE id = p_user_id AND deleted_at IS NULL;

  IF user_lat IS NULL OR user_lng IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM service_hubs h
    WHERE h.is_active = true
      AND (3959 * acos(
        cos(radians(h.lat)) * cos(radians(user_lat)) *
        cos(radians(user_lng) - radians(h.lng)) +
        sin(radians(h.lat)) * sin(radians(user_lat))
      )) <= h.active_radius_miles
  ) INTO is_in_area;

  RETURN is_in_area;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check by coordinates (for job location checks)
CREATE OR REPLACE FUNCTION check_location_in_service_area(p_lat double precision, p_lng double precision)
RETURNS boolean AS $$
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM service_hubs h
    WHERE h.is_active = true
      AND (3959 * acos(
        cos(radians(h.lat)) * cos(radians(p_lat)) *
        cos(radians(p_lng) - radians(h.lng)) +
        sin(radians(h.lat)) * sin(radians(p_lat))
      )) <= h.active_radius_miles
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION check_customer_service_area(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_service_area(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_location_in_service_area(double precision, double precision) TO authenticated;
