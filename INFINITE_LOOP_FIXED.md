# ✅ FIXED: Infinite Loop Issue

## Problem Identified

**Root Cause:** Infinite recursion loop
- App was calling Edge Function manually
- Database trigger was also calling Edge Function
- Edge Function updates database → Trigger fires again → Infinite loop!

## Solutions Applied

### 1. ✅ Removed Manual Function Call from App

**File:** `src/lib/verification.ts`

Removed the manual call to `triggerAutoVerification()` at line 121. Now the database trigger handles everything automatically.

### 2. ⚠️ Fix Database Trigger URL

The trigger is calling `/functions/v1/verify-id-photo` but the actual slug is `clever-responder`.

**Quick Fix - Run this SQL in Supabase Dashboard:**

1. Go to: https://supabase.com/dashboard → SQL Editor
2. Copy and paste the content from `FIX_TRIGGER_NOW.sql`
3. Click **"Run"**

**Or manually:**
```sql
CREATE OR REPLACE FUNCTION trigger_id_verification()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
  request_id UUID;
BEGIN
  IF NEW.id_photo_path IS NOT NULL 
     AND NEW.id_photo_path IS DISTINCT FROM OLD.id_photo_path 
     AND NEW.id_status = 'pending' THEN
    
    function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/clever-responder';
    service_role_key := current_setting('app.settings.service_role_key', true);
    
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
```

## How It Works Now

1. ✅ User uploads ID photo
2. ✅ App updates `profiles` table with `id_status = 'pending'`
3. ✅ Database trigger detects the change
4. ✅ Trigger calls Edge Function (clever-responder)
5. ✅ Edge Function verifies the ID
6. ✅ Edge Function updates `profiles` with `id_status = 'verified'` or `'rejected'`
7. ✅ Trigger does NOT fire again (because status is no longer 'pending')

## Test After Fixing

1. **Run the SQL** in Supabase Dashboard (from `FIX_TRIGGER_NOW.sql`)
2. **Reload your app**
3. **Delete the pending ID**
4. **Upload a new ID photo**
5. **Wait 2-5 seconds**
6. **Status should change** to "Verified" or "Rejected"

## Check Logs

After uploading, check:
- **App logs:** Should see "Upload complete, database trigger will handle verification"
- **Edge Function logs:** Should see "[VERIFY-ID] Starting verification..." and completion

## Why This Happened

The original design had TWO ways to trigger verification:
1. App calling the function directly (line 121 in verification.ts)
2. Database trigger calling the function

This created a race condition and potential infinite loop. Now we only use the database trigger method.

## Files Changed

1. ✅ `src/lib/verification.ts` - Removed manual function call
2. ⚠️ `FIX_TRIGGER_NOW.sql` - SQL to fix trigger URL (needs to be run)
3. ✅ `supabase/migrations/20240120000004_fix_trigger_url.sql` - Migration file (for future deployments)

## Next Steps

1. **Run the SQL fix** (1 minute)
2. **Test upload** (1 minute)
3. **Verify it works** (check logs)

**Once the SQL is run, the infinite loop will be fixed!** 🎉
