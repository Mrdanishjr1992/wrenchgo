# 🔍 Debugging Edge Function Error

## Status: Function is Deployed ✅

The Edge Function `verify-id-photo` is deployed and ACTIVE (Version 2).

## Next Steps to Debug

### 1. Check Edge Function Logs

**Go to:** https://supabase.com/dashboard → Your Project → Edge Functions → verify-id-photo → **Logs**

Look for error messages when you upload an ID photo.

### 2. Common Issues & Solutions

#### Issue A: Missing Environment Variables

**Check:** Edge Functions → verify-id-photo → Settings → **Secrets**

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key (starts with `sk-...`)

**If missing, add it:**
```bash
npx supabase secrets set OPENAI_API_KEY=sk-your-key-here
```

#### Issue B: Storage Permissions

The function needs to download from the `identity-docs` bucket.

**Check:** Storage → identity-docs → Policies

**Required policy:** Service role should have read access.

#### Issue C: OpenAI API Error

**Possible causes:**
- Invalid API key
- No credits in OpenAI account
- Rate limit exceeded
- API key doesn't have GPT-4 Vision access

**Test your OpenAI key:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-your-key-here"
```

#### Issue D: Function Code Error

**Check the logs for:**
- JavaScript/TypeScript errors
- Missing imports
- Timeout errors

### 3. Test the Function Directly

You can test the function from the Supabase Dashboard:

**Go to:** Edge Functions → verify-id-photo → **Invoke**

**Test payload:**
```json
{
  "userId": "your-user-id",
  "filePath": "your-user-id/id-photo.jpg"
}
```

This will show you the exact error message.

### 4. Enable Detailed Logging

Let me update the app to show more detailed error information:
