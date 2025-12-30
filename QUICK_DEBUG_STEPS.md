# 🔧 Quick Debugging Steps

## The Issue

The Edge Function is deployed but returning a 400 error (non-2xx status code).

## Step 1: Check the Logs NOW

**While the error is fresh, check the logs immediately:**

1. Go to: https://supabase.com/dashboard
2. Navigate to: **Edge Functions** → **verify-id-photo** → **Logs** tab
3. Look at the most recent log entry

**What to look for:**
- `[VERIFY-ID] Starting verification for user...` - Function was called ✅
- `[VERIFY-ID] Error: ...` - The actual error message ⚠️

## Step 2: Common Error Messages & Fixes

### Error: "Missing userId or filePath"
**Cause:** The function isn't receiving the correct parameters.
**Fix:** Already handled in the app code, unlikely to be this.

### Error: "Storage error" or "download failed"
**Cause:** The function can't access the `identity-docs` bucket.
**Fix:** Check storage policies allow service role to read.

### Error: "OpenAI API error" or "fetch failed"
**Cause:** OpenAI API key is missing, invalid, or has no credits.
**Fix:** 
```bash
npx supabase secrets set OPENAI_API_KEY=sk-your-actual-key-here
```

### Error: "Failed to update profiles"
**Cause:** RLS policy blocking the service role from updating profiles.
**Fix:** Service role should bypass RLS, but check the policy.

## Step 3: Test with a Simple Function

Let me create a minimal test version of the function to isolate the issue.

**Create a new file:** `supabase/functions/verify-id-photo-test/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  console.log("[TEST] Function called");
  
  try {
    const body = await req.json();
    console.log("[TEST] Received body:", body);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Test function works!",
        received: body 
      }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("[TEST] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
```

**Deploy it:**
```bash
npx supabase functions deploy verify-id-photo-test
```

**Test it from the app by temporarily changing the function name in `src/lib/verification.ts`:**
```typescript
const { data, error } = await supabase.functions.invoke("verify-id-photo-test", {
  body: { userId, filePath },
});
```

If this works, the issue is in the main function logic.

## Step 4: Check Environment Variables

**Verify the OpenAI key is set:**

```bash
npx supabase secrets list
```

**You should see:**
```
OPENAI_API_KEY
```

**If not, set it:**
```bash
npx supabase secrets set OPENAI_API_KEY=sk-your-key-here
```

## Step 5: Most Likely Issue - OpenAI API Key

Based on the error pattern, the most likely issue is:

1. **OpenAI API key is not set** in the Edge Function environment
2. **OpenAI API key is invalid** or expired
3. **OpenAI account has no credits**

**To verify:**

1. Check secrets: `npx supabase secrets list`
2. Test your OpenAI key manually:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_KEY_HERE"
   ```

## Step 6: Fallback to Basic Validation

If you don't want to use OpenAI right now, the function has a fallback. Let me update it to use basic validation by default:
