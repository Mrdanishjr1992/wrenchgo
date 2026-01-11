-- ============================================================================
-- Migration: 20250213000007_fix_launch_metrics_mechanic_count.sql
-- ============================================================================
-- Purpose: Fix mechanic counting in populate_daily_launch_metrics using LEFT JOIN
-- Dependencies: 20250213000001 (service_hubs, launch_metrics, populate_daily_launch_metrics)
-- Risk Level: Low (function replacement)
-- Rollback: Restore previous populate_daily_launch_metrics function
-- ============================================================================

-- Fix populate_daily_launch_metrics to count mechanics from profiles only
-- mechanic_profiles row is optional

CREATE OR REPLACE FUNCTION populate_daily_launch_metrics()
RETURNS void AS $$
DECLARE
  hub RECORD;
  mechanic_count INTEGER;
  jobs_req INTEGER;
  jobs_comp INTEGER;
BEGIN
  FOR hub IN SELECT id, lat, lng, active_radius_miles FROM service_hubs WHERE is_active = true
  LOOP
    -- Count mechanics within hub radius using Haversine
    -- Only requires profiles.role = 'mechanic', mechanic_profiles is optional
    SELECT COUNT(*) INTO mechanic_count
    FROM profiles p
    LEFT JOIN mechanic_profiles mp ON mp.id = p.id
    WHERE p.role = 'mechanic'
      AND p.deleted_at IS NULL
      AND (mp.id IS NULL OR (mp.deleted_at IS NULL AND mp.is_available = true))
      AND p.home_lat IS NOT NULL
      AND p.home_lng IS NOT NULL
      AND (3959 * acos(
        cos(radians(hub.lat)) * cos(radians(p.home_lat)) *
        cos(radians(p.home_lng) - radians(hub.lng)) +
        sin(radians(hub.lat)) * sin(radians(p.home_lat))
      )) <= hub.active_radius_miles;

    -- Count jobs today
    SELECT COUNT(*) INTO jobs_req
    FROM jobs j
    WHERE j.created_at::date = CURRENT_DATE
      AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
      AND (3959 * acos(
        cos(radians(hub.lat)) * cos(radians(j.location_lat)) *
        cos(radians(j.location_lng) - radians(hub.lng)) +
        sin(radians(hub.lat)) * sin(radians(j.location_lat))
      )) <= hub.active_radius_miles;

    SELECT COUNT(*) INTO jobs_comp
    FROM jobs j
    WHERE j.status = 'completed'
      AND j.updated_at::date = CURRENT_DATE
      AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
      AND (3959 * acos(
        cos(radians(hub.lat)) * cos(radians(j.location_lat)) *
        cos(radians(j.location_lng) - radians(hub.lng)) +
        sin(radians(hub.lat)) * sin(radians(j.location_lat))
      )) <= hub.active_radius_miles;

    INSERT INTO launch_metrics (hub_id, date, active_mechanics, jobs_requested, jobs_completed)
    VALUES (hub.id, CURRENT_DATE, mechanic_count, jobs_req, jobs_comp)
    ON CONFLICT (hub_id, date) DO UPDATE SET
      active_mechanics = EXCLUDED.active_mechanics,
      jobs_requested = EXCLUDED.jobs_requested,
      jobs_completed = EXCLUDED.jobs_completed;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-run to update metrics
SELECT populate_daily_launch_metrics();
