# Edge Function Deployment Guide

The Supabase CLI on Windows has known issues with deploying edge functions. Use one of these methods:

## Method 1: Supabase Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions
2. Click **"Deploy new function"**
3. Upload these functions:
   - `supabase/functions/stripe-connect-create-account-link`
   - `supabase/functions/stripe-webhook`
4. Click **Deploy**

## Method 2: WSL/Linux Script

1. Get your **Access Token**: https://supabase.com/dashboard/account/tokens
2. Get your **Project Ref**: https://supabase.com/dashboard/project/_/settings/general
3. Run the deployment script:

```bash
wsl
cd /mnt/d/src/wrenchgo
chmod +x deploy-edge-functions.sh
./deploy-edge-functions.sh YOUR_ACCESS_TOKEN YOUR_PROJECT_REF
```

## After Deployment

### Configure Stripe Webhook

1. Go to: https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. Set URL to: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   - `account.updated`
5. Copy the **Signing Secret**
6. Add to Supabase: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/settings/functions
   - Name: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_...`

### Test the Deployment

Try the payout setup again in your app. The 401 error should be resolved.
