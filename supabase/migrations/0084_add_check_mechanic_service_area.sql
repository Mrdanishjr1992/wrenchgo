-- ============================================================================
-- Migration: 20250213000009_add_check_mechanic_service_area.sql
-- ============================================================================
-- Purpose: Add function to check if mechanic is within any active service hub
-- Dependencies: 20250213000001 (service_hubs), 20250111000001 (profiles)
-- Risk Level: Low (new function)
-- Rollback: DROP FUNCTION check_mechanic_service_area;
-- ============================================================================

-- Create check_mechanic_service_area function
-- Returns true if mechanic is within any active service hub's radius

CREATE OR REPLACE FUNCTION check_mechanic_service_area(p_mechanic_id uuid)
RETURNS boolean AS $$
DECLARE
  mechanic_lat double precision;
  mechanic_lng double precision;
  is_in_area boolean := false;
BEGIN
  SELECT home_lat, home_lng INTO mechanic_lat, mechanic_lng
  FROM profiles
  WHERE id = p_mechanic_id AND deleted_at IS NULL;

  IF mechanic_lat IS NULL OR mechanic_lng IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM service_hubs h
    WHERE h.is_active = true
      AND (3959 * acos(
        cos(radians(h.lat)) * cos(radians(mechanic_lat)) *
        cos(radians(mechanic_lng) - radians(h.lng)) +
        sin(radians(h.lat)) * sin(radians(mechanic_lat))
      )) <= h.active_radius_miles
  ) INTO is_in_area;

  RETURN is_in_area;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION check_mechanic_service_area(uuid) TO authenticated;
