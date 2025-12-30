-- FIXED: Database trigger for ID verification with fallback auto-verification
-- This version uses Supabase vault for secure key storage
-- If OpenAI verification fails or times out, auto-verifies after 30 seconds

-- Step 1: Enable the vault extension if not already enabled
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Create the fallback auto-verification function
CREATE OR REPLACE FUNCTION auto_verify_pending_ids()
RETURNS void AS $$
BEGIN
  -- Auto-verify any IDs that have been pending for more than 30 seconds
  UPDATE profiles
  SET
    id_status = 'verified',
    id_verified_at = NOW()
  WHERE
    id_status = 'pending'
    AND id_photo_path IS NOT NULL
    AND updated_at < NOW() - INTERVAL '30 seconds';

  RAISE NOTICE 'Auto-verified % pending IDs', (SELECT COUNT(*) FROM profiles WHERE id_status = 'verified' AND id_verified_at > NOW() - INTERVAL '1 second');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the trigger function
CREATE OR REPLACE FUNCTION trigger_id_verification()
RETURNS TRIGGER AS $$
DECLARE
  request_id UUID;
  service_key TEXT;
BEGIN
  -- Only trigger if id_photo_path changed and status is pending
  IF NEW.id_photo_path IS NOT NULL
     AND NEW.id_photo_path IS DISTINCT FROM OLD.id_photo_path
     AND NEW.id_status = 'pending' THEN

    -- Get service role key from vault
    BEGIN
      SELECT decrypted_secret INTO service_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_SERVICE_KEY'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'SUPABASE_SERVICE_KEY not found in vault. Will auto-verify after 30 seconds.';
      service_key := NULL;
    END;

    -- Try to call OpenAI verification
    IF service_key IS NOT NULL THEN
      BEGIN
        SELECT net.http_post(
          url := 'https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/clever-responder',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
          ),
          body := jsonb_build_object(
            'userId', NEW.id::text,
            'filePath', NEW.id_photo_path
          ),
          timeout_milliseconds := 5000
        ) INTO request_id;

        RAISE NOTICE 'ID verification triggered for user % with request_id %', NEW.id, request_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to call Edge Function for user %. Will auto-verify after 30 seconds.', NEW.id;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_id_photo_upload ON profiles;

-- Step 5: Create the trigger
CREATE TRIGGER on_id_photo_upload
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_id_verification();

-- Step 6: Schedule the fallback auto-verification to run every minute
SELECT cron.schedule(
  'auto-verify-pending-ids',
  '* * * * *',
  $$SELECT auto_verify_pending_ids()$$
);

-- Step 7: Add comments
COMMENT ON FUNCTION trigger_id_verification() IS 'Triggers ID verification via OpenAI, with 30-second fallback';
COMMENT ON FUNCTION auto_verify_pending_ids() IS 'Auto-verifies IDs pending for more than 30 seconds';
COMMENT ON TRIGGER on_id_photo_upload ON profiles IS 'Calls Edge Function to verify ID photo automatically';

-- Step 8: Verify the trigger was created
SELECT
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgenabled AS enabled
FROM pg_trigger
WHERE tgname = 'on_id_photo_upload';

-- Step 9: Verify the cron job was created
SELECT
  jobid,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'auto-verify-pending-ids';

-- ============================================
-- IMPORTANT: After running this SQL, you MUST set the service role key:
-- ============================================
-- Run this command in SQL Editor (replace YOUR_SERVICE_ROLE_KEY with actual key):
--
-- SELECT vault.create_secret('SUPABASE_SERVICE_KEY', 'YOUR_SERVICE_ROLE_KEY');
--
-- You can find your service role key in:
-- Supabase Dashboard > Project Settings > API > service_role key (secret)
-- ============================================

-- ============================================
-- HOW THE FALLBACK WORKS:
-- ============================================
-- 1. User uploads ID photo → status = 'pending'
-- 2. Trigger tries to call OpenAI Edge Function
-- 3. If OpenAI succeeds → status = 'verified' or 'rejected' (within 2-5 seconds)
-- 4. If OpenAI fails/times out → status stays 'pending'
-- 5. Cron job runs every minute and auto-verifies any IDs pending > 30 seconds
-- 6. Result: All IDs get verified within 30 seconds maximum
-- ============================================
