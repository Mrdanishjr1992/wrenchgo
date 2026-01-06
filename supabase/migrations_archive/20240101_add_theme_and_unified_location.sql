-- Add theme preference column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark'));

-- Add unified location columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS home_lat numeric,
ADD COLUMN IF NOT EXISTS home_lng numeric,
ADD COLUMN IF NOT EXISTS home_city text,
ADD COLUMN IF NOT EXISTS home_state text;

-- Create index for location queries
CREATE INDEX IF NOT EXISTS idx_profiles_home_location ON public.profiles(home_lat, home_lng) WHERE home_lat IS NOT NULL AND home_lng IS NOT NULL;

-- Migrate coordinate data from city column to home_lat/home_lng
-- Pattern: "lat, lng" (two decimal numbers separated by comma and space)
DO $$
DECLARE
  rec RECORD;
  lat_val numeric;
  lng_val numeric;
BEGIN
  FOR rec IN 
    SELECT id, city 
    FROM public.profiles 
    WHERE city IS NOT NULL 
      AND city ~ '^-?[0-9]+\.?[0-9]*\s*,\s*-?[0-9]+\.?[0-9]*$'
  LOOP
    BEGIN
      lat_val := CAST(SPLIT_PART(rec.city, ',', 1) AS numeric);
      lng_val := CAST(SPLIT_PART(rec.city, ',', 2) AS numeric);
      
      UPDATE public.profiles
      SET 
        home_lat = lat_val,
        home_lng = lng_val,
        city = NULL
      WHERE id = rec.id;
      
      RAISE NOTICE 'Migrated coordinates for profile %: %, %', rec.id, lat_val, lng_val;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to migrate coordinates for profile %: %', rec.id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMENT ON COLUMN public.profiles.theme_preference IS 'User theme preference: light or dark';
COMMENT ON COLUMN public.profiles.home_lat IS 'Home location latitude';
COMMENT ON COLUMN public.profiles.home_lng IS 'Home location longitude';
COMMENT ON COLUMN public.profiles.home_city IS 'Home city name';
COMMENT ON COLUMN public.profiles.home_state IS 'Home state/province';
