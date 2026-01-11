-- ============================================================================
-- Migration: 20250213000008_add_customers_to_launch_metrics.sql
-- ============================================================================
-- Purpose: Add active_customers tracking to launch_metrics and hub_health_dashboard
-- Dependencies: 20250213000007 (launch_metrics, populate_daily_launch_metrics)
-- Risk Level: Low (additive column, function replacement)
-- Rollback: ALTER TABLE launch_metrics DROP COLUMN active_customers;
-- ============================================================================

-- Add active_customers column to launch_metrics and update function

ALTER TABLE launch_metrics ADD COLUMN IF NOT EXISTS active_customers INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION populate_daily_launch_metrics()
RETURNS void AS $$
DECLARE
  hub RECORD;
  mechanic_count INTEGER;
  customer_count INTEGER;
  jobs_req INTEGER;
  jobs_comp INTEGER;
BEGIN
  FOR hub IN SELECT id, lat, lng, active_radius_miles FROM service_hubs WHERE is_active = true
  LOOP
    -- Count mechanics within hub radius
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

    -- Count customers within hub radius
    SELECT COUNT(*) INTO customer_count
    FROM profiles p
    WHERE p.role = 'customer'
      AND p.deleted_at IS NULL
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

    INSERT INTO launch_metrics (hub_id, date, active_mechanics, active_customers, jobs_requested, jobs_completed)
    VALUES (hub.id, CURRENT_DATE, mechanic_count, customer_count, jobs_req, jobs_comp)
    ON CONFLICT (hub_id, date) DO UPDATE SET
      active_mechanics = EXCLUDED.active_mechanics,
      active_customers = EXCLUDED.active_customers,
      jobs_requested = EXCLUDED.jobs_requested,
      jobs_completed = EXCLUDED.jobs_completed;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate view to add new column
DROP VIEW IF EXISTS hub_health_dashboard;

CREATE VIEW hub_health_dashboard AS
SELECT 
  h.id,
  h.name,
  h.slug,
  h.zip,
  h.is_active as status,
  COALESCE(m.active_mechanics, 0) as active_mechanics,
  COALESCE(m.active_customers, 0) as active_customers,
  COALESCE(m.jobs_completed, 0) as jobs_completed,
  COALESCE(m.median_response_minutes, 0) as avg_response_time_minutes
FROM service_hubs h
LEFT JOIN LATERAL (
  SELECT * FROM launch_metrics lm 
  WHERE lm.hub_id = h.id 
  ORDER BY lm.date DESC 
  LIMIT 1
) m ON true;

GRANT SELECT ON hub_health_dashboard TO authenticated;

-- Re-run to update metrics
SELECT populate_daily_launch_metrics();