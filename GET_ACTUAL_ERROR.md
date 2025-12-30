# 🔍 Getting the Actual Error Message

## Progress: Function is Now Being Called! ✅

The function is executing but returning a 400 error. We need to see the actual error message.

## Step 1: Check Updated App Logs

I've updated the app to show the actual error response. 

**Test again:**
1. Delete the pending ID
2. Upload a new ID photo
3. Look for this log:
   ```
   [ID VERIFICATION] Error response body: {...}
   ```

This will show the exact error from the Edge Function.

## Step 2: Check Supabase Dashboard Logs

**Go to:** https://supabase.com/dashboard → Edge Functions → verify-id-photo → **Logs** tab

**Look for:**
- `[VERIFY-ID] Starting verification for user...` ✅ Function started
- `[VERIFY-ID] Error: ...` ⚠️ The actual error

**Common errors you might see:**

### Error: "Storage error" or "Object not found"
**Cause:** The file path is incorrect or the file doesn't exist
**Check:** The file path should be `userId/photo-id.jpeg`

### Error: "OpenAI API error: 401 Unauthorized"
**Cause:** Invalid OpenAI API key
**Fix:** Update the API key in Dashboard → Edge Functions → Settings → Secrets

### Error: "OpenAI API error: 404 Model not found"
**Cause:** Your OpenAI account doesn't have access to `gpt-4-turbo`
**Fix:** Change the model in the Edge Function code

### Error: "OpenAI API error: 429 Rate limit"
**Cause:** Too many requests or no credits
**Fix:** Check your OpenAI billing

### Error: "Failed to update profiles"
**Cause:** Database permission issue
**Fix:** Check RLS policies

## Step 3: Verify Function Code in Dashboard

**Important:** The function you deployed via Dashboard might be different from the local file.

**Check:**
1. Go to Edge Functions → verify-id-photo
2. Click **"Edit"** or view the code
3. Verify it matches `supabase/functions/verify-id-photo/index.ts`

**Key things to check:**
- Line 115: Model should be `gpt-4-turbo` (or a model you have access to)
- Line 100-105: OpenAI key check and fallback
- Line 46-48: Storage download code

## Step 4: Test with Simple Function

If the error is unclear, deploy the simple test function:

**Deploy:** `supabase/functions/verify-id-photo-simple/index.ts`

This function:
- ✅ Skips OpenAI completely
- ✅ Auto-approves all IDs
- ✅ Only tests storage download and database update

**If simple function works:** The issue is with OpenAI API
**If simple function fails:** The issue is with storage or database

## Step 5: Manual Test in Dashboard

You can test the function directly:

1. Go to Edge Functions → verify-id-photo → **Invoke** tab
2. Enter:
```json
{
  "userId": "69d99678-0b83-45ed-bf2b-8ecff6f2596c",
  "filePath": "69d99678-0b83-45ed-bf2b-8ecff6f2596c/photo-id.jpeg"
}
```
3. Click **"Invoke"**
4. See the response immediately

## Most Likely Issues (Based on 400 Error)

### 1. Storage Download Error (60% likely)
The function can't download the file from storage.

**Possible causes:**
- File path is wrong
- File doesn't exist
- Storage permissions issue

**Check:** Go to Storage → identity-docs → Browse files
- Verify the file exists at the correct path

### 2. OpenAI API Error (30% likely)
The OpenAI API call is failing.

**Possible causes:**
- Invalid API key
- Model not available
- No credits
- Rate limit

**Check:** Dashboard logs will show the specific OpenAI error

### 3. Database Update Error (10% likely)
The function can't update the profiles table.

**Possible causes:**
- RLS policy blocking service role (unlikely)
- Column doesn't exist (unlikely, we ran migrations)

## Next Steps

1. **Test again** with the updated app code
2. **Check the logs** in Supabase Dashboard
3. **Report back** with the specific error message

Once we see the actual error, we can fix it immediately!

---

## Quick Commands

**Check if file exists in storage:**
```sql
SELECT * FROM storage.objects 
WHERE bucket_id = 'identity-docs' 
AND name LIKE '69d99678-0b83-45ed-bf2b-8ecff6f2596c%';
```

**Check OpenAI secret:**
```bash
npx supabase secrets list
```

**Redeploy function with updated code:**
- Copy `supabase/functions/verify-id-photo/index.ts`
- Paste in Dashboard → Edge Functions → Edit
- Click Deploy
