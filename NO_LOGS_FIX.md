# 🚨 No Logs - Function Not Executing

## Issue: No Logs in Dashboard

If you see **no logs at all** in the Edge Functions dashboard, it means the function is either:
1. Not being called by the app
2. Has a different name/slug than expected
3. Wasn't deployed correctly

## Solution Steps

### Step 1: Verify Function Name/Slug

From the CLI output, I saw:
```
NAME: verify-id-photo
SLUG: clever-responder  ⚠️ This is different!
```

**The slug is what you actually call, not the name!**

### Step 2: Update App to Use Correct Slug

Update `src/lib/verification.ts` line 139:

```typescript
// Change from:
const { data, error } = await supabase.functions.invoke("verify-id-photo", {

// To:
const { data, error } = await supabase.functions.invoke("clever-responder", {
```

### Step 3: Test Again

1. Save the file
2. Reload your app
3. Delete the pending ID
4. Upload a new ID photo
5. Check the logs again

---

## Alternative: Redeploy with Correct Name

If you want the slug to match the name, you need to delete and recreate the function:

### Via Dashboard:

1. Go to Edge Functions
2. Delete the existing `verify-id-photo` function
3. Create a new function
4. Name: `verify-id-photo`
5. Make sure the slug is also `verify-id-photo`
6. Paste the code from `supabase/functions/verify-id-photo/index.ts`
7. Deploy

---

## Quick Test: Call Function Directly

You can test if the function works by calling it directly from the Supabase Dashboard:

### Via Dashboard:

1. Go to Edge Functions → verify-id-photo (or clever-responder)
2. Click **"Invoke"** tab
3. Enter test payload:
```json
{
  "userId": "test-user-id",
  "filePath": "test-user-id/test.jpg"
}
```
4. Click **"Invoke"**

**Expected result:**
- If it works: You'll see a response (even if it errors on storage, you'll see logs)
- If it doesn't work: No response or timeout

---

## Most Likely Issue: Slug Mismatch

Based on the CLI output showing `SLUG: clever-responder`, this is almost certainly the issue.

**Quick Fix:**

```typescript
// src/lib/verification.ts line 139
const { data, error } = await supabase.functions.invoke("clever-responder", {
  body: { userId, filePath },
});
```

---

## How to Check Current Function Slug

Run this command:
```bash
npx supabase functions list
```

Look at the **SLUG** column (not the NAME column). That's what you need to use in `supabase.functions.invoke()`.

---

## After Fixing the Slug

Once you use the correct slug, you should see:

1. **Console logs in your app:**
   ```
   [ID VERIFICATION] Triggering auto-verification for: { userId: "...", filePath: "..." }
   ```

2. **Logs in Supabase Dashboard:**
   ```
   [VERIFY-ID] Starting verification for user ...
   [VERIFY-ID] Analyzing image with AI...
   ```

3. **Either success or a specific error** (which we can then debug)

---

## Summary

**The issue is likely the slug mismatch:**
- App is calling: `verify-id-photo`
- Actual slug is: `clever-responder`

**Fix:** Update line 139 in `src/lib/verification.ts` to use `clever-responder`

**Or:** Redeploy the function with the correct name/slug matching.
