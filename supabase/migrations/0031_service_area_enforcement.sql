-- MIGRATION 0031: SERVICE AREA ENFORCEMENT
-- Launch Hub: 60453 (Oak Lawn, IL) - 100 mile radius
-- Ring-based expansion with liquidity controls

-- 1. Enable PostGIS and set search path
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
SET search_path TO public, extensions;

-- 2. ZIP codes lookup table
CREATE TABLE IF NOT EXISTS zip_codes (
  zip VARCHAR(10) PRIMARY KEY,
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(2),
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_zip_location ON zip_codes USING GIST(location);

-- 3. Service hubs with ring-based expansion
CREATE TABLE IF NOT EXISTS service_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  zip VARCHAR(10) NOT NULL,
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  max_radius_miles INTEGER DEFAULT 100 CHECK (max_radius_miles <= 250),
  active_radius_miles INTEGER DEFAULT 25, -- Start with Ring 0 only
  is_active BOOLEAN DEFAULT true,
  invite_only BOOLEAN DEFAULT true, -- Soft launch gate
  auto_expand_enabled BOOLEAN DEFAULT false,
  launch_date DATE,
  graduated_at TIMESTAMPTZ, -- When hub went from soft to open launch
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) STORED,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_hubs_location_gix ON service_hubs USING GIST(location);

-- 4. Waitlist with ring segmentation
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  zip VARCHAR(10) NOT NULL,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    CASE WHEN lat IS NOT NULL AND lng IS NOT NULL
    THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    END
  ) STORED,
  nearest_hub_id UUID REFERENCES service_hubs(id),
  distance_miles DECIMAL(6,1),
  ring INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN distance_miles IS NULL THEN NULL
      WHEN distance_miles <= 25 THEN 0
      WHEN distance_miles <= 50 THEN 1
      WHEN distance_miles <= 75 THEN 2
      WHEN distance_miles <= 100 THEN 3
      ELSE 99  -- Future expansion
    END
  ) STORED,
  user_type VARCHAR(20) CHECK (user_type IN ('customer', 'mechanic')),
  -- Customer fields
  service_needed TEXT,
  -- Mechanic fields
  services_offered TEXT[],
  years_experience INTEGER,
  willing_travel_miles INTEGER,
  -- Status
  invited_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, zip)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_location ON waitlist USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_waitlist_zip ON waitlist(zip);
CREATE INDEX IF NOT EXISTS idx_waitlist_ring ON waitlist(ring);
CREATE INDEX IF NOT EXISTS idx_waitlist_hub_ring ON waitlist(nearest_hub_id, ring);

-- 5. Add location columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_lat DECIMAL(9,6);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_lng DECIMAL(9,6);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_zip VARCHAR(10);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES service_hubs(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_hash VARCHAR(64); -- For fraud detection

-- Add generated geography column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'service_location'
  ) THEN
    ALTER TABLE profiles ADD COLUMN service_location GEOGRAPHY(POINT, 4326) 
      GENERATED ALWAYS AS (
        CASE WHEN service_lat IS NOT NULL AND service_lng IS NOT NULL 
        THEN ST_SetSRID(ST_MakePoint(service_lng, service_lat), 4326)::geography 
        END
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_service_location ON profiles USING GIST(service_location);
CREATE INDEX IF NOT EXISTS idx_profiles_hub ON profiles(hub_id);

-- 6. Add location columns to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_lat DECIMAL(9,6);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_lng DECIMAL(9,6);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES service_hubs(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'job_location'
  ) THEN
    ALTER TABLE jobs ADD COLUMN job_location GEOGRAPHY(POINT, 4326)
      GENERATED ALWAYS AS (
        CASE WHEN job_lat IS NOT NULL AND job_lng IS NOT NULL 
        THEN ST_SetSRID(ST_MakePoint(job_lng, job_lat), 4326)::geography 
        END
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS jobs_location_gix ON jobs USING GIST(job_location);
CREATE INDEX IF NOT EXISTS idx_jobs_hub ON jobs(hub_id);

-- 7. Core function: Check if point is within any active service area
CREATE OR REPLACE FUNCTION is_within_service_area(
  check_lat DECIMAL,
  check_lng DECIMAL
) RETURNS BOOLEAN AS $$
BEGIN
  IF check_lat IS NULL OR check_lng IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM service_hubs
    WHERE is_active = true
    AND ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(check_lng, check_lat), 4326)::geography,
      radius_miles * 1609.34
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 8. Get nearest hub with distance
CREATE OR REPLACE FUNCTION get_nearest_hub(
  check_lat DECIMAL,
  check_lng DECIMAL
) RETURNS TABLE(
  hub_id UUID,
  hub_name VARCHAR,
  hub_slug VARCHAR,
  distance_miles DECIMAL,
  radius_miles INTEGER,
  is_within_area BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.name,
    h.slug,
    ROUND((ST_Distance(
      h.location,
      ST_SetSRID(ST_MakePoint(check_lng, check_lat), 4326)::geography
    ) / 1609.34)::DECIMAL, 1),
    h.radius_miles,
    ST_DWithin(
      h.location,
      ST_SetSRID(ST_MakePoint(check_lng, check_lat), 4326)::geography,
      h.radius_miles * 1609.34
    )
  FROM service_hubs h
  WHERE h.is_active = true
  ORDER BY ST_Distance(
    h.location,
    ST_SetSRID(ST_MakePoint(check_lng, check_lat), 4326)::geography
  )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 9. Get nearby jobs for mechanics (with safety limit)
CREATE OR REPLACE FUNCTION get_nearby_jobs(
  mechanic_lat DECIMAL,
  mechanic_lng DECIMAL,
  max_miles INTEGER DEFAULT 50,
  result_limit INTEGER DEFAULT 100
) RETURNS TABLE(
  job_id UUID,
  title VARCHAR,
  description TEXT,
  lat DECIMAL,
  lng DECIMAL,
  distance_miles DECIMAL,
  created_at TIMESTAMPTZ,
  status VARCHAR
) AS $$
BEGIN
  -- Cap results to prevent abuse
  IF result_limit > 100 THEN
    result_limit := 100;
  END IF;
  
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.description,
    j.job_lat,
    j.job_lng,
    ROUND((ST_Distance(
      j.job_location,
      ST_SetSRID(ST_MakePoint(mechanic_lng, mechanic_lat), 4326)::geography
    ) / 1609.34)::DECIMAL, 1),
    j.created_at,
    j.status
  FROM jobs j
  WHERE j.status = 'open'
  AND j.job_location IS NOT NULL
  AND ST_DWithin(
    j.job_location,
    ST_SetSRID(ST_MakePoint(mechanic_lng, mechanic_lat), 4326)::geography,
    max_miles * 1609.34
  )
  ORDER BY ST_Distance(
    j.job_location,
    ST_SetSRID(ST_MakePoint(mechanic_lng, mechanic_lat), 4326)::geography
  )
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 10. Assign job to nearest hub
CREATE OR REPLACE FUNCTION assign_job_to_hub()
RETURNS TRIGGER AS $$
DECLARE
  nearest UUID;
BEGIN
  IF NEW.job_lat IS NOT NULL AND NEW.job_lng IS NOT NULL THEN
    SELECT h.id INTO nearest
    FROM service_hubs h
    WHERE h.is_active = true
    ORDER BY ST_Distance(
      h.location,
      ST_SetSRID(ST_MakePoint(NEW.job_lng, NEW.job_lat), 4326)::geography
    )
    LIMIT 1;
    
    NEW.hub_id := nearest;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_job_hub ON jobs;
CREATE TRIGGER trg_assign_job_hub
  BEFORE INSERT OR UPDATE OF job_lat, job_lng ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION assign_job_to_hub();

-- 11. RLS Policies for service area enforcement

-- Jobs must be within ACTIVE radius (not max radius)
DROP POLICY IF EXISTS "Jobs must be in service area" ON jobs;
CREATE POLICY "Jobs must be in service area" ON jobs
  FOR INSERT WITH CHECK (
    job_lat IS NULL OR job_lng IS NULL OR
    EXISTS (
      SELECT 1 FROM service_hubs h
      WHERE h.is_active = true
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(job_lng, job_lat), 4326)::geography,
        h.location,
        h.active_radius_miles * 1609.34  -- Use active, not max
      )
    )
  );

-- 12. Ring-based expansion metrics
CREATE OR REPLACE VIEW waitlist_by_ring AS
SELECT
  w.nearest_hub_id,
  h.name as hub_name,
  w.ring,
  w.user_type,
  COUNT(*) as count,
  COUNT(CASE WHEN w.invited_at IS NOT NULL THEN 1 END) as invited,
  COUNT(CASE WHEN w.converted_at IS NOT NULL THEN 1 END) as converted
FROM waitlist w
LEFT JOIN service_hubs h ON w.nearest_hub_id = h.id
WHERE w.ring IS NOT NULL
GROUP BY w.nearest_hub_id, h.name, w.ring, w.user_type
ORDER BY w.nearest_hub_id, w.ring, w.user_type;

-- Launch readiness check per ring
CREATE OR REPLACE VIEW ring_launch_readiness AS
SELECT
  h.id as hub_id,
  h.name as hub_name,
  h.active_radius_miles,
  r.ring,
  COALESCE(SUM(CASE WHEN w.user_type = 'customer' THEN 1 ELSE 0 END), 0) as customers,
  COALESCE(SUM(CASE WHEN w.user_type = 'mechanic' THEN 1 ELSE 0 END), 0) as mechanics,
  CASE
    WHEN r.ring = 0 THEN 20  -- Ring 0 needs 20 customers
    WHEN r.ring = 1 THEN 15
    WHEN r.ring = 2 THEN 10
    ELSE 10
  END as customer_threshold,
  CASE
    WHEN r.ring = 0 THEN 5   -- Ring 0 needs 5 mechanics
    ELSE 3
  END as mechanic_threshold
FROM service_hubs h
CROSS JOIN (SELECT generate_series(0, 3) as ring) r
LEFT JOIN waitlist w ON w.nearest_hub_id = h.id AND w.ring = r.ring
GROUP BY h.id, h.name, h.active_radius_miles, r.ring;

-- 13. Hub health metrics (for expansion decisions)
CREATE TABLE IF NOT EXISTS hub_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id UUID REFERENCES service_hubs(id) NOT NULL,
  date DATE NOT NULL,
  jobs_created INTEGER DEFAULT 0,
  jobs_completed INTEGER DEFAULT 0,
  median_response_minutes INTEGER,
  avg_completion_rate DECIMAL(5,2),
  supply_shortage_reports INTEGER DEFAULT 0,
  active_mechanics INTEGER DEFAULT 0,
  UNIQUE(hub_id, date)
);

CREATE INDEX IF NOT EXISTS idx_hub_metrics_date ON hub_daily_metrics(hub_id, date DESC);

-- 14. Security audit table
CREATE TABLE IF NOT EXISTS location_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL,
  claimed_lat DECIMAL(9,6),
  claimed_lng DECIMAL(9,6),
  claimed_zip VARCHAR(10),
  ip_address INET,
  ip_lat DECIMAL(9,6),
  ip_lng DECIMAL(9,6),
  distance_delta_miles DECIMAL(8,1),
  flagged BOOLEAN DEFAULT false,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_audit_user ON location_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_location_audit_flagged ON location_audit(flagged) WHERE flagged = true;

-- 15. Insert Oak Lawn hub (60453)
INSERT INTO service_hubs (name, slug, zip, lat, lng, max_radius_miles, active_radius_miles, is_active, invite_only, launch_date)
VALUES ('Chicago', 'chicago', '60453', 41.7200, -87.7500, 100, 25, true, true, CURRENT_DATE)
ON CONFLICT (slug) DO UPDATE SET
  zip = EXCLUDED.zip,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- 16. Function to check expansion readiness
CREATE OR REPLACE FUNCTION check_ring_expansion_ready(
  p_hub_id UUID,
  p_ring INTEGER
) RETURNS TABLE(
  ready BOOLEAN,
  customers INTEGER,
  mechanics INTEGER,
  customer_threshold INTEGER,
  mechanic_threshold INTEGER,
  last_7d_response_median INTEGER,
  last_7d_completion_rate DECIMAL
) AS $$
DECLARE
  cust_count INTEGER;
  mech_count INTEGER;
  cust_thresh INTEGER;
  mech_thresh INTEGER;
  resp_median INTEGER;
  comp_rate DECIMAL;
BEGIN
  -- Get waitlist counts for this ring
  SELECT
    COUNT(CASE WHEN user_type = 'customer' THEN 1 END),
    COUNT(CASE WHEN user_type = 'mechanic' THEN 1 END)
  INTO cust_count, mech_count
  FROM waitlist
  WHERE nearest_hub_id = p_hub_id AND ring = p_ring;

  -- Thresholds
  cust_thresh := CASE WHEN p_ring = 0 THEN 20 WHEN p_ring = 1 THEN 15 ELSE 10 END;
  mech_thresh := CASE WHEN p_ring = 0 THEN 5 ELSE 3 END;

  -- Last 7 days metrics
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY median_response_minutes),
    AVG(avg_completion_rate)
  INTO resp_median, comp_rate
  FROM hub_daily_metrics
  WHERE hub_id = p_hub_id AND date >= CURRENT_DATE - 7;

  RETURN QUERY SELECT
    (cust_count >= cust_thresh AND mech_count >= mech_thresh AND
     (resp_median IS NULL OR resp_median <= 20) AND
     (comp_rate IS NULL OR comp_rate >= 75)),
    cust_count,
    mech_count,
    cust_thresh,
    mech_thresh,
    resp_median,
    comp_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 17. Grant permissions
GRANT SELECT ON zip_codes TO authenticated;
GRANT SELECT ON service_hubs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON waitlist TO authenticated, anon;
GRANT SELECT ON waitlist_by_ring TO authenticated;
GRANT SELECT ON ring_launch_readiness TO authenticated;
GRANT SELECT ON hub_daily_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION is_within_service_area TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_nearest_hub TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_nearby_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION check_ring_expansion_ready TO authenticated;

COMMENT ON TABLE service_hubs IS 'Geographic service areas with ring-based expansion';
COMMENT ON TABLE waitlist IS 'Users segmented by ring for controlled launch';
COMMENT ON TABLE hub_daily_metrics IS 'Daily health metrics for expansion decisions';
COMMENT ON FUNCTION check_ring_expansion_ready IS 'Check if a ring meets launch thresholds';
