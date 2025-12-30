-- Migration: Add database trigger for automatic ID verification
-- This trigger calls the Edge Function when an ID photo is uploaded

-- Create function to trigger verification
CREATE OR REPLACE FUNCTION trigger_id_verification()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
  request_id UUID;
BEGIN
  -- Only trigger if id_photo_path changed and status is pending
  -- This prevents infinite loops by only triggering on new uploads
  IF NEW.id_photo_path IS NOT NULL
     AND NEW.id_photo_path IS DISTINCT FROM OLD.id_photo_path
     AND NEW.id_status = 'pending' THEN

    -- Get Supabase URL from environment
    function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/clever-responder';
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- Call the Edge Function asynchronously using pg_net
    -- Note: This requires pg_net extension to be enabled
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'userId', NEW.id::text,
        'filePath', NEW.id_photo_path
      )
    ) INTO request_id;
    
    RAISE NOTICE 'ID verification triggered for user % with request_id %', NEW.id, request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS on_id_photo_upload ON profiles;
CREATE TRIGGER on_id_photo_upload
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_id_verification();

-- Add comment
COMMENT ON FUNCTION trigger_id_verification() IS 'Automatically triggers ID verification when a photo is uploaded';
COMMENT ON TRIGGER on_id_photo_upload ON profiles IS 'Calls Edge Function to verify ID photo automatically';
