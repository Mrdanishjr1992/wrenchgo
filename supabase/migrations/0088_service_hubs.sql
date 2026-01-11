-- ============================================================================
-- Migration: 20250213000001_service_hubs.sql
-- ============================================================================
-- Purpose: Service hubs for geographic launch management and metrics tracking
-- Dependencies: 20250111000001 (profiles, mechanic_profiles tables)
-- Risk Level: Low (new tables, idempotent)
-- Rollback: DROP TABLE launch_metrics, service_hubs CASCADE;
--
-- TABLES: service_hubs, launch_metrics
-- VIEWS: hub_health_dashboard
-- FUNCTIONS: populate_daily_launch_metrics()
-- ============================================================================

-- Service hubs and launch metrics (no PostGIS)

-- Service hubs table
CREATE TABLE IF NOT EXISTS service_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  zip VARCHAR(10) NOT NULL,
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  max_radius_miles INTEGER DEFAULT 100,
  active_radius_miles INTEGER DEFAULT 25,
  is_active BOOLEAN DEFAULT true,
  invite_only BOOLEAN DEFAULT true,
  launch_date DATE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Launch metrics table
CREATE TABLE IF NOT EXISTS launch_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id UUID REFERENCES service_hubs(id) NOT NULL,
  date DATE NOT NULL,
  active_mechanics INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  new_mechanics INTEGER DEFAULT 0,
  jobs_requested INTEGER DEFAULT 0,
  jobs_completed INTEGER DEFAULT 0,
  median_response_minutes INTEGER,
  completion_rate DECIMAL(5,2),
  jobs_per_mechanic DECIMAL(5,2),
  complaints INTEGER DEFAULT 0,
  no_shows INTEGER DEFAULT 0,
  UNIQUE(hub_id, date)
);

ALTER TABLE launch_metrics ADD COLUMN IF NOT EXISTS active_customers INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_launch_metrics_hub_date ON launch_metrics(hub_id, date DESC);

-- Hub health dashboard view
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

-- Function to populate launch metrics
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
    -- Count mechanics within hub radius using Haversine
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

-- Grants
GRANT SELECT ON service_hubs TO authenticated;
GRANT SELECT ON launch_metrics TO authenticated;
GRANT SELECT ON hub_health_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION populate_daily_launch_metrics TO authenticated;

-- Insert Chicago hub
INSERT INTO service_hubs (name, slug, zip, lat, lng, active_radius_miles, is_active)
VALUES ('Chicago', 'chicago', '60453', 41.7200, -87.7400, 50, true)
ON CONFLICT (slug) DO NOTHING;

-- Populate initial metrics
SELECT populate_daily_launch_metrics();
