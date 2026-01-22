-- Mechanic Leads & Jobs Diagnostic Script
-- Run this in the Supabase SQL editor to diagnose issues

-- Replace with the actual mechanic's user ID
-- You can get this from: SELECT id FROM auth.users WHERE email = 'mechanic@example.com';
DO $$
DECLARE
  v_mechanic_id uuid := 'YOUR_MECHANIC_ID_HERE';  -- REPLACE THIS
  v_mechanic_lat numeric;
  v_mechanic_lng numeric;
  v_mechanic_geo geography;
  v_has_location boolean;
  v_in_service_area boolean;
  v_hub_count integer;
  v_lead_job_count integer;
  v_assigned_job_count integer;
BEGIN
  RAISE NOTICE '=== MECHANIC DIAGNOSTIC REPORT ===';
  RAISE NOTICE 'Mechanic ID: %', v_mechanic_id;
  
  -- 1. Check if mechanic profile exists and has location
  SELECT home_lat, home_lng
  INTO v_mechanic_lat, v_mechanic_lng
  FROM profiles
  WHERE id = v_mechanic_id AND role = 'mechanic' AND deleted_at IS NULL;
  
  v_has_location := v_mechanic_lat IS NOT NULL AND v_mechanic_lng IS NOT NULL;
  
  RAISE NOTICE '--- Profile Check ---';
  RAISE NOTICE 'Has location set: %', v_has_location;
  IF v_has_location THEN
    RAISE NOTICE 'Location: %, %', v_mechanic_lat, v_mechanic_lng;
    v_mechanic_geo := ST_SetSRID(ST_MakePoint(v_mechanic_lng, v_mechanic_lat), 4326)::extensions.geography;
    
    -- 2. Check service hubs
    SELECT COUNT(*) INTO v_hub_count FROM service_hubs WHERE is_active = true;
    RAISE NOTICE '--- Service Hub Check ---';
    RAISE NOTICE 'Active service hubs: %', v_hub_count;
    
    -- 3. Check if mechanic is in a service area
    SELECT EXISTS (
      SELECT 1 FROM service_hubs sh
      WHERE sh.is_active = true
        AND ST_DWithin(v_mechanic_geo, sh.location, sh.active_radius_miles * 1609.34)
    ) INTO v_in_service_area;
    RAISE NOTICE 'Mechanic in service area: %', v_in_service_area;
  ELSE
    RAISE NOTICE 'ISSUE: Mechanic has no location set. Set home_lat and home_lng in profiles.';
  END IF;
  
  -- 4. Check for lead jobs (searching/quoted status)
  SELECT COUNT(*) INTO v_lead_job_count
  FROM jobs
  WHERE status IN ('searching', 'quoted', 'open')
    AND deleted_at IS NULL
    AND location_geo IS NOT NULL;
  
  RAISE NOTICE '--- Job Check ---';
  RAISE NOTICE 'Lead jobs (searching/quoted with location_geo): %', v_lead_job_count;
  
  -- 5. Check for assigned jobs
  SELECT COUNT(*) INTO v_assigned_job_count
  FROM jobs
  WHERE accepted_mechanic_id = v_mechanic_id
    AND status IN ('accepted', 'scheduled', 'in_progress', 'work_in_progress', 'completed')
    AND deleted_at IS NULL;
  
  RAISE NOTICE 'Assigned jobs: %', v_assigned_job_count;
  
  RAISE NOTICE '=== END DIAGNOSTIC ===';
END $$;

-- Quick queries to run separately:

-- List active service hubs
SELECT id, name, city, is_active, active_radius_miles, lat, lng
FROM service_hubs
WHERE is_active = true;

-- Check a specific mechanic's profile
-- SELECT id, full_name, role, home_lat, home_lng, service_location FROM profiles WHERE id = 'YOUR_MECHANIC_ID';

-- Check jobs missing location_geo
SELECT COUNT(*) as jobs_missing_location_geo
FROM jobs 
WHERE location_geo IS NULL 
  AND status IN ('searching', 'quoted', 'open')
  AND deleted_at IS NULL;

-- List recent lead jobs
SELECT id, title, status, location_lat, location_lng, location_geo IS NOT NULL as has_geo, created_at
FROM jobs
WHERE status IN ('searching', 'quoted', 'open')
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
