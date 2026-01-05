# Edge Function 401 Error - Troubleshooting

## Current Issue
The edge function is returning 401 before even executing (execution_id is null in logs).

## Root Cause
The Supabase gateway is blocking the request. This happens when:
1. The edge function doesn't have the required environment variables
2. The function needs to be redeployed after the initial deployment
3. JWT verification is failing at the gateway level

## Solution

### Step 1: Verify Environment Variables in Supabase Dashboard

Go to: https://supabase.com/dashboard/project/komsqqxqirvfgforixxq/settings/functions

Ensure these secrets are set:
- `STRIPE_SECRET_KEY` - Your Stripe secret key (sk_...)
- `SUPABASE_URL` - Your Supabase URL (should be auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (should be auto-set)

### Step 2: Redeploy the Edge Function

The function needs to be redeployed to pick up the environment variables:

1. Go to: https://supabase.com/dashboard/project/komsqqxqirvfgforixxq/functions
2. Find `stripe-connect-create-account-link`
3. Click **"Redeploy"** or **"Deploy new version"**
4. Upload the function again from: `supabase/functions/stripe-connect-create-account-link`

### Step 3: Check Function Logs

After redeploying, test again and check the logs:
- Go to: https://supabase.com/dashboard/project/komsqqxqirvfgforixxq/functions/stripe-connect-create-account-link/logs
- Look for console.log output from the function
- If you see "=== Stripe Connect Account Link Request ===" then the function is executing
- If execution_id is still null, the gateway is blocking it

### Step 4: Alternative - Disable JWT Verification (Not Recommended)

If the above doesn't work, you can temporarily disable JWT verification at the gateway level by adding a `verify_jwt: false` option in the function config. However, this is NOT recommended for production.

## Expected Behavior

When working correctly, you should see:
- `execution_id` is NOT null in the logs
- Console logs from the function appear in the logs
- Response includes detailed error messages from the function code (not generic 401)
