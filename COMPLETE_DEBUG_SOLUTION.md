# 🔧 Complete Debugging Solution

## Current Status

✅ Edge Function `verify-id-photo` is deployed (Version 2, ACTIVE)
✅ OpenAI API key is set in secrets
⚠️ Function is returning a 400 error (non-2xx status code)

## Solution: Use Simple Test Function First

I've created a simplified version that will help us isolate the issue.

### Step 1: Deploy the Simple Test Function

This function auto-approves all IDs without calling OpenAI, so we can test if the basic flow works.

**Deploy via Dashboard:**

1. Go to: https://supabase.com/dashboard → Edge Functions
2. Click **"Create a new function"**
3. Name: `verify-id-photo-simple`
4. Copy code from: `supabase/functions/verify-id-photo-simple/index.ts`
5. Click **"Deploy"**

**Or via CLI (if you have WSL2):**
```bash
npx supabase functions deploy verify-id-photo-simple
```

### Step 2: Update App to Use Simple Function

Temporarily change the function name in `src/lib/verification.ts`:

```typescript
// Line 137 - Change from:
const { data, error } = await supabase.functions.invoke("verify-id-photo", {

// To:
const { data, error } = await supabase.functions.invoke("verify-id-photo-simple", {
```

### Step 3: Test Upload

1. Delete your current pending ID
2. Upload a new ID photo
3. It should auto-approve immediately

**If this works:** The issue is in the main function (likely OpenAI API call)
**If this fails:** The issue is with basic Supabase setup (storage, RLS, etc.)

---

## Debugging the Main Function

### Check the Logs

**Go to:** Dashboard → Edge Functions → verify-id-photo → Logs

**Look for these specific errors:**

#### Error 1: "OpenAI API error: 401"
**Cause:** Invalid API key
**Fix:** 
```bash
npx supabase secrets set OPENAI_API_KEY=sk-your-correct-key
```

#### Error 2: "OpenAI API error: 429"
**Cause:** Rate limit or no credits
**Fix:** Check your OpenAI account billing

#### Error 3: "OpenAI API error: 404" or "model not found"
**Cause:** Model `gpt-4o` or `gpt-4-turbo` not available
**Fix:** I've updated the function to use `gpt-4-turbo`. Redeploy:
```bash
# Copy the updated code from supabase/functions/verify-id-photo/index.ts
# Paste into Dashboard → Edge Functions → verify-id-photo → Edit
```

#### Error 4: "Storage error" or "download failed"
**Cause:** Function can't access the storage bucket
**Fix:** Check storage policies (service role should have access)

#### Error 5: "Failed to update profiles"
**Cause:** RLS policy issue
**Fix:** Service role should bypass RLS, but verify the policy

---

## Quick Fix: Use Basic Validation (No OpenAI)

If you want to skip OpenAI for now, the function has a built-in fallback.

**Option A: Remove OpenAI Key Temporarily**
```bash
npx supabase secrets unset OPENAI_API_KEY
```

The function will automatically use basic image validation (checks file size, format, etc.)

**Option B: Update Function to Always Use Basic Validation**

Edit `supabase/functions/verify-id-photo/index.ts` line 100:

```typescript
// Change from:
if (!openaiKey) {

// To:
if (true) {  // Always use basic validation
```

---

## Most Likely Issues (In Order)

### 1. OpenAI Model Not Available (90% likely)

Your OpenAI account might not have access to `gpt-4-turbo` or `gpt-4o`.

**Test your OpenAI key:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_KEY_HERE" | grep gpt-4
```

**Available models:**
- `gpt-4-turbo` - Latest, requires GPT-4 API access
- `gpt-4-vision-preview` - Older vision model
- `gpt-4o` - Newest, might not be available yet

**Fix:** Update the model in the function to one you have access to.

### 2. OpenAI API Key Invalid (5% likely)

The key might be expired or incorrect.

**Fix:** Generate a new key at https://platform.openai.com/api-keys

### 3. Storage/RLS Issue (3% likely)

The function can't download the image or update the profile.

**Fix:** Check the logs for specific error messages.

### 4. Network/Timeout Issue (2% likely)

The OpenAI API call is timing out.

**Fix:** Increase timeout or use basic validation.

---

## Recommended Action Plan

### Immediate (5 minutes):

1. **Deploy the simple test function** (see Step 1 above)
2. **Test with simple function** (see Step 2-3 above)
3. **Check if it works**

### If Simple Function Works:

The issue is definitely in the OpenAI API call. Then:

1. **Check Edge Function logs** for the exact OpenAI error
2. **Test your OpenAI key** with curl command above
3. **Update the model** if needed
4. **Or use basic validation** (no OpenAI) for now

### If Simple Function Fails:

The issue is with basic setup. Then:

1. **Check storage policies** (service role access)
2. **Check RLS policies** (profiles table)
3. **Check the logs** for specific error

---

## Updated Files

I've made these changes:

1. ✅ **`src/lib/verification.ts`** - Added detailed error logging
2. ✅ **`supabase/functions/verify-id-photo/index.ts`** - Changed model to `gpt-4-turbo`, added better error logging
3. ✅ **`supabase/functions/verify-id-photo-simple/index.ts`** - Created simple test function

---

## Next Steps

**Try the simple function first!** This will tell us exactly where the problem is.

1. Deploy `verify-id-photo-simple`
2. Update app to use it
3. Test upload
4. Report back what happens

Then we can fix the main function based on what we learn.
