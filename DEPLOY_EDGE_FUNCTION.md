# Deploy Edge Function Without Docker

Since Docker is having issues, deploy the Edge Function manually:

## Option 1: Via Supabase Dashboard (RECOMMENDED)

1. Go to https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions
2. Click on `delete-account` function (or create new if doesn't exist)
3. Copy the entire contents of `supabase/functions/delete-account/index.ts`
4. Paste into the editor
5. Click **Deploy**

## Option 2: Fix Docker and Redeploy

```powershell
# Restart Docker Desktop
# Then run:
npx supabase functions deploy delete-account
```

## The Key Fix

The Edge Function now uses:
```typescript
// Extract JWT token from Authorization header
const token = authHeader.replace("Bearer ", "");

// Get user from JWT using admin client
const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
```

This properly validates the JWT token sent from the app.
