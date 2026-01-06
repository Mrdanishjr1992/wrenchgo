-- Data migration: Move malformed city data (lat, lng strings) to proper columns
-- This handles cases where city column contains "latitude, longitude" format

DO $$
DECLARE
  rec RECORD;
  lat_val DOUBLE PRECISION;
  lng_val DOUBLE PRECISION;
BEGIN
  FOR rec IN 
    SELECT id, city 
    FROM profiles 
    WHERE city IS NOT NULL 
      AND city ~ '^-?[0-9]+\.?[0-9]*, -?[0-9]+\.?[0-9]*$'
  LOOP
    BEGIN
      lat_val := CAST(SPLIT_PART(rec.city, ',', 1) AS DOUBLE PRECISION);
      lng_val := CAST(SPLIT_PART(rec.city, ',', 2) AS DOUBLE PRECISION);
      
      UPDATE profiles
      SET 
        home_lat = lat_val,
        home_lng = lng_val,
        city = NULL
      WHERE id = rec.id;
      
      RAISE NOTICE 'Migrated coordinates for profile %: lat=%, lng=%', rec.id, lat_val, lng_val;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to migrate city data for profile %: %', rec.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'City data migration completed';
END $$;
