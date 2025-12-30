# Manual Edge Function Deployment Guide

## Issue
The Supabase CLI is encountering a Docker compatibility error on Windows:
```
exec /usr/local/bin/edge-runtime: exec format error
```

## Solution: Deploy via Supabase Dashboard

### Step 1: Access Edge Functions in Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Edge Functions** in the left sidebar
4. Click **"Create a new function"** or **"Deploy function"**

### Step 2: Create the Function

**Function Name:** `verify-id-photo`

**Function Code:** Copy the entire content from `supabase/functions/verify-id-photo/index.ts`

### Step 3: Set Environment Variables

In the Edge Functions settings, add:

**Secret Name:** `OPENAI_API_KEY`  
**Secret Value:** Your OpenAI API key (starts with `sk-...`)

### Step 4: Deploy

Click **"Deploy"** button

### Step 5: Test the Function

You can test it directly from the dashboard or use the app to upload an ID photo.

---

## Alternative: Use Supabase CLI with WSL2

If you want to use the CLI, install WSL2 (Windows Subsystem for Linux):

### Install WSL2

```powershell
wsl --install
```

### Install Supabase CLI in WSL2

```bash
npm install -g supabase
```

### Deploy from WSL2

```bash
cd /mnt/c/Users/mrdan/source/repos/Mechanic\ app/wrenchgo
supabase functions deploy verify-id-photo
```

---

## Verification

After deployment, verify the function is working:

1. **Check Function Logs** in Supabase Dashboard
2. **Upload a test ID photo** in your app
3. **Check the profiles table** - `id_status` should update to `verified` or `rejected`

---

## Function Code Reference

The Edge Function is located at:
```
supabase/functions/verify-id-photo/index.ts
```

Key features:
- Downloads ID photo from storage
- Analyzes with OpenAI GPT-4 Vision
- Updates profile with verification result
- Fallback to basic validation if no OpenAI key

---

## Troubleshooting

### Function Not Triggering

Check the database trigger:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_id_photo_upload';
```

### Function Errors

Check Edge Function logs in Supabase Dashboard:
- Go to Edge Functions
- Click on `verify-id-photo`
- View **Logs** tab

### OpenAI API Issues

- Verify API key is set correctly
- Check OpenAI account has credits
- Review OpenAI API usage dashboard

---

## Cost Estimate

**OpenAI GPT-4 Vision API:**
- ~$0.01-0.03 per ID verification
- Based on image size and complexity

**Supabase Edge Functions:**
- Free tier: 500K invocations/month
- After that: $2 per 1M invocations

---

## Next Steps

1. Deploy the function via Dashboard (recommended for Windows)
2. Set the OpenAI API key
3. Test with a real ID photo upload
4. Monitor logs for any issues

**Once deployed, the automated verification will work seamlessly!** 🚀
