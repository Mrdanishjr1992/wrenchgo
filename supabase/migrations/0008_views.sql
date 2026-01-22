-- ===================================================================
-- 0008_views.sql
-- Views (guarded, no missing-table references)
-- ===================================================================

SET search_path TO public;

-- =====================================================
-- WAITLIST BY RING
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'waitlist'
  ) THEN
    CREATE OR REPLACE VIEW waitlist_by_ring AS
    SELECT
      w.nearest_hub_id,
      h.name AS hub_name,
      w.ring,
      w.user_type,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE w.invited_at IS NOT NULL) AS invited,
      COUNT(*) FILTER (WHERE w.converted_at IS NOT NULL) AS converted
    FROM waitlist w
    LEFT JOIN service_hubs h ON h.id = w.nearest_hub_id
    GROUP BY w.nearest_hub_id, h.name, w.ring, w.user_type;
  END IF;
END $$;

-- =====================================================
-- RING LAUNCH READINESS
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'waitlist'
  ) THEN
    CREATE OR REPLACE VIEW ring_launch_readiness AS
    SELECT
      h.id AS hub_id,
      h.name AS hub_name,
      r.ring,
      COUNT(*) FILTER (WHERE w.user_type = 'customer') AS customers,
      COUNT(*) FILTER (WHERE w.user_type = 'mechanic') AS mechanics
    FROM service_hubs h
    CROSS JOIN (SELECT generate_series(0,3) AS ring) r
    LEFT JOIN waitlist w
      ON w.nearest_hub_id = h.id AND w.ring = r.ring
    GROUP BY h.id, h.name, r.ring;
  END IF;
END $$;

-- =====================================================
-- HUB HEALTH DASHBOARD (NO launch_metrics dependency)
-- =====================================================
DROP VIEW IF EXISTS hub_health_dashboard;

CREATE VIEW hub_health_dashboard AS
SELECT
  h.id,
  h.name,
  h.slug,
  h.zip,
  h.is_active,
  COUNT(w.id) FILTER (WHERE w.user_type = 'mechanic') AS waitlisted_mechanics,
  COUNT(w.id) FILTER (WHERE w.user_type = 'customer') AS waitlisted_customers
FROM service_hubs h
LEFT JOIN waitlist w ON w.nearest_hub_id = h.id
GROUP BY h.id, h.name, h.slug, h.zip, h.is_active;
