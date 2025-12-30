# 🚨 Edge Function Deployment Required

## Current Status

✅ **Upload is working!** The ID photo was successfully uploaded to Supabase Storage.

⚠️ **Auto-verification is failing** because the Edge Function hasn't been deployed yet.

**Error Message:**
```
WARN [ID VERIFICATION] Auto-verification failed, will remain pending: 
[FunctionsHttpError: Edge Function returned a non-2xx status code]
```

## What This Means

1. ✅ The app code is working correctly
2. ✅ The database trigger is working
3. ✅ The storage upload is successful
4. ⚠️ The Edge Function `verify-id-photo` doesn't exist on the server yet

## Quick Fix: Deploy the Edge Function

### Option 1: Supabase Dashboard (Recommended for Windows)

**Step 1:** Go to https://supabase.com/dashboard

**Step 2:** Select your project → **Edge Functions** (left sidebar)

**Step 3:** Click **"Create a new function"**

**Step 4:** 
- **Name:** `verify-id-photo`
- **Code:** Copy ALL content from `supabase/functions/verify-id-photo/index.ts`

**Step 5:** Click **"Deploy"**

**Step 6:** Verify the OpenAI API key is set:
- Go to Edge Functions → verify-id-photo → Settings → Secrets
- Confirm `OPENAI_API_KEY` exists

### Option 2: WSL2 (If you have it installed)

```bash
cd /mnt/c/Users/mrdan/source/repos/Mechanic\ app/wrenchgo
supabase functions deploy verify-id-photo
```

## After Deployment

### Test It

1. **Delete the current pending ID** (in your app)
2. **Upload a new ID photo**
3. **Wait 2-5 seconds**
4. **Status should change** from "Pending" to "Verified" or "Rejected"

### Check Logs

Go to: Supabase Dashboard → Edge Functions → verify-id-photo → **Logs**

You should see:
```
[VERIFY-ID] Starting verification for user <user-id>
[VERIFY-ID] Analyzing image with AI...
[VERIFY-ID] Verification complete: verified/rejected
```

## Current Behavior (Without Edge Function)

- ✅ ID photo uploads successfully
- ✅ Status is set to "pending"
- ⚠️ Auto-verification fails (expected)
- ℹ️ ID remains in "pending" state

**This is safe!** The ID is stored securely, and you can manually verify it in the Supabase Dashboard:

```sql
UPDATE profiles 
SET id_status = 'verified', 
    id_verified_at = NOW(), 
    id_verified_by = 'manual-admin'
WHERE id = '<user-id>';
```

## Why This Happened

The Supabase CLI has a Docker compatibility issue on Windows:
```
exec /usr/local/bin/edge-runtime: exec format error
```

This is a known issue with the Supabase CLI on Windows. The workaround is to deploy via the Dashboard or use WSL2.

## Files You Need

**Edge Function Code:**
- Location: `supabase/functions/verify-id-photo/index.ts`
- Lines: 219 total
- Just copy the entire file content

**OpenAI API Key:**
- Should already be set (you ran `supabase secrets set OPENAI_API_KEY=...`)
- Verify in Dashboard: Edge Functions → Settings → Secrets

## Next Steps

1. **Deploy the Edge Function** (5 minutes via Dashboard)
2. **Test with a new upload** (delete current pending ID first)
3. **Check the logs** to see AI analysis results

**Once deployed, every ID upload will automatically verify in 2-5 seconds!** 🚀

---

## Need Help?

**Check these files:**
- `EDGE_FUNCTION_MANUAL_DEPLOY.md` - Detailed deployment guide
- `AUTO_VERIFICATION_GUIDE.md` - How the AI verification works
- `DEPLOYMENT_STATUS.md` - Overall deployment status

**Common Issues:**
- Function not found → Deploy the function
- OpenAI error → Check API key is set
- Timeout → Check OpenAI account has credits
