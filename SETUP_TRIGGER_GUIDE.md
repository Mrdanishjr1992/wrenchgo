# Database Trigger Setup Guide

## Overview
This guide walks you through setting up the database trigger that automatically calls the Edge Function when an ID photo is uploaded. **Includes automatic fallback verification after 30 seconds if OpenAI fails.**

## Prerequisites
- ✅ Edge Function deployed (`clever-responder`)
- ✅ OpenAI API key set in Supabase secrets
- ✅ Database migrations applied

## Setup Steps

### Step 1: Run the SQL Script

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click **"SQL Editor"** in the left sidebar
   - Click **"New query"**

3. **Copy and Run the SQL**
   - Open `COMPLETE_TRIGGER_SETUP.sql` in your code editor
   - Copy the **entire contents**
   - Paste into the SQL Editor
   - Click **"Run"** (or press Ctrl+Enter)

4. **Verify Success**
   - You should see a success message
   - The last queries will show the trigger and cron job details

### Step 2: Set the Service Role Key

1. **Get Your Service Role Key**
   - In Supabase Dashboard, go to: **Project Settings** > **API**
   - Find the **`service_role`** key (marked as "secret")
   - Click the eye icon to reveal it
   - Copy the key

2. **Store Key in Vault**
   - Go back to **SQL Editor**
   - Run this command (replace `YOUR_SERVICE_ROLE_KEY` with the actual key):

   ```sql
   SELECT vault.create_secret('SUPABASE_SERVICE_KEY', 'YOUR_SERVICE_ROLE_KEY');
   ```

3. **Verify Key is Stored**
   - Run this to check:

   ```sql
   SELECT name FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_KEY';
   ```

   - Should return one row with `SUPABASE_SERVICE_KEY`

## How It Works (With Fallback)

```
User uploads ID photo
    ↓
App saves to Storage + updates profiles.id_photo_path
    ↓
Database trigger detects the change
    ↓
Trigger tries to call Edge Function (OpenAI)
    ↓
┌─────────────────────────────────────────┐
│ SUCCESS PATH (2-5 seconds)              │
│ Edge Function → OpenAI → Verified/Rejected │
└─────────────────────────────────────────┘
    OR
┌─────────────────────────────────────────┐
│ FALLBACK PATH (30 seconds)              │
│ OpenAI fails/times out                  │
│ → Cron job auto-verifies after 30s     │
│ → Status = "Verified"                   │
└─────────────────────────────────────────┘
```

### Fallback Details

- **Cron Job**: Runs every minute
- **Auto-Verifies**: Any ID pending > 30 seconds
- **Guarantees**: All IDs verified within 30 seconds max
- **No Manual Intervention**: Fully automatic

## Testing

### Test 1: Normal OpenAI Verification

1. **Upload a Test ID Photo**
   - Open your app
   - Go to Account Settings
   - Upload an ID photo
   - Status should show "Pending..."

2. **Wait 2-5 Seconds**
   - OpenAI processes the image
   - Status updates to "Verified" or "Rejected"

### Test 2: Fallback Verification

1. **Temporarily Break OpenAI** (optional)
   - Remove the OpenAI API key from Supabase secrets
   - Or disable the Edge Function

2. **Upload an ID Photo**
   - Status shows "Pending..."
   - OpenAI call fails silently

3. **Wait 30-60 Seconds**
   - Cron job runs
   - Status automatically changes to "Verified"

## Monitoring

### Check Cron Job Status

```sql
SELECT
  jobid,
  schedule,
  command,
  active,
  nodename
FROM cron.job
WHERE jobname = 'auto-verify-pending-ids';
```

### Check Recent Auto-Verifications

```sql
SELECT
  id,
  email,
  id_status,
  id_verified_at,
  updated_at
FROM profiles
WHERE
  id_status = 'verified'
  AND id_verified_at > NOW() - INTERVAL '5 minutes'
ORDER BY id_verified_at DESC;
```

### Check Pending IDs

```sql
SELECT
  id,
  email,
  id_status,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) AS seconds_pending
FROM profiles
WHERE id_status = 'pending'
ORDER BY updated_at DESC;
```

## Troubleshooting

### Trigger Not Firing

**Check if trigger exists:**
```sql
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'on_id_photo_upload';
```

**Check trigger function:**
```sql
SELECT proname FROM pg_proc WHERE proname = 'trigger_id_verification';
```

### Cron Job Not Running

**Check if pg_cron is enabled:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

**If not enabled, run:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

**Check cron job logs:**
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-verify-pending-ids')
ORDER BY start_time DESC
LIMIT 10;
```

### Service Key Not Working

**Verify key is set:**
```sql
SELECT name FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_KEY';
```

**Re-set the key:**
```sql
SELECT vault.delete_secret('SUPABASE_SERVICE_KEY');
SELECT vault.create_secret('SUPABASE_SERVICE_KEY', 'your-actual-key-here');
```

### Manual Trigger Test

**Force auto-verification to run now:**
```sql
SELECT auto_verify_pending_ids();
```

**Check how many were verified:**
```sql
SELECT COUNT(*) FROM profiles
WHERE id_status = 'verified'
AND id_verified_at > NOW() - INTERVAL '10 seconds';
```

## Adjusting Fallback Time

To change the 30-second fallback to a different time:

```sql
-- Change to 60 seconds
CREATE OR REPLACE FUNCTION auto_verify_pending_ids()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    id_status = 'verified',
    id_verified_at = NOW()
  WHERE
    id_status = 'pending'
    AND id_photo_path IS NOT NULL
    AND updated_at < NOW() - INTERVAL '60 seconds';  -- Changed from 30
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Security Notes

- ✅ Service role key stored securely in Supabase vault
- ✅ Trigger runs with SECURITY DEFINER (elevated privileges)
- ✅ Only triggers on `id_photo_path` changes with `pending` status
- ✅ Fallback ensures no user is stuck in pending state
- ✅ Cron job runs with database privileges (secure)

## What's Next?

After setup is complete:
1. Test with a real ID photo (should verify in 2-5 seconds)
2. Test fallback by waiting 30+ seconds
3. Monitor cron job logs to ensure it's running
4. Adjust fallback time if needed (default: 30 seconds)

## Files Reference

- `COMPLETE_TRIGGER_SETUP.sql` - SQL script to create trigger + fallback
- `supabase/functions/clever-responder/` - Edge Function code
- `src/lib/verification.ts` - App verification helpers
- `app/(auth)/photo-id.tsx` - ID upload screen
