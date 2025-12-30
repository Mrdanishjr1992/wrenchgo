# Deploy Edge Functions via Supabase Dashboard

Since the CLI deployment is having Docker issues on Windows, deploy via the Dashboard instead.

## Prerequisites

Make sure you've set these secrets first (via CLI or Dashboard):

```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY
```

Or set them in Dashboard: **Project Settings** → **Edge Functions** → **Secrets**

## Function 1: create-payment-intent

### Dashboard Steps:
1. Go to: **Edge Functions** → **Deploy a new function**
2. **Function name:** `create-payment-intent`
3. **Copy the code from:** `supabase/functions/create-payment-intent/index.ts`
4. Click **Deploy function**

### Required Secrets:
- `STRIPE_SECRET_KEY`
- `SUPABASE_URL` (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

### Test URL:
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/create-payment-intent
```

---

## Function 2: stripe-webhook

### Dashboard Steps:
1. **Edge Functions** → **Deploy a new function**
2. **Function name:** `stripe-webhook`
3. **Copy the code from:** `supabase/functions/stripe-webhook/index.ts`
4. Click **Deploy function**

### Required Secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL` (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

### Webhook URL (for Stripe Dashboard):
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/stripe-webhook
```

---

## Function 3: validate-promotion

### Dashboard Steps:
1. **Edge Functions** → **Deploy a new function**
2. **Function name:** `validate-promotion`
3. **Copy the code from:** `supabase/functions/validate-promotion/index.ts`
4. Click **Deploy function**

### Required Secrets:
- `SUPABASE_URL` (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

### Test URL:
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/validate-promotion
```

---

## Function 4: stripe-connect-create-account-link

### Dashboard Steps:
1. **Edge Functions** → **Deploy a new function**
2. **Function name:** `stripe-connect-create-account-link`
3. **Copy the code from:** `supabase/functions/stripe-connect-create-account-link/index.ts`
4. Click **Deploy function**

### Required Secrets:
- `STRIPE_SECRET_KEY`
- `SUPABASE_URL` (auto-provided)
- `SUPABASE_ANON_KEY` (auto-provided)

### Test URL:
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/stripe-connect-create-account-link
```

---

## Verification Checklist

After deploying all functions, verify they're working:

### 1. Check Function List
- Go to **Edge Functions** in Dashboard
- You should see all 4 functions listed
- Status should be **Active**

### 2. Check Logs
- Click on each function
- Go to **Logs** tab
- Deploy a test request to see if it works

### 3. Test Each Function

#### Test create-payment-intent:
```bash
curl -X POST https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/create-payment-intent \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test-job-id"}'
```

#### Test validate-promotion:
```bash
curl -X POST https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/validate-promotion \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME10", "amountCents": 10000}'
```

#### Test stripe-connect-create-account-link:
```bash
curl -X POST https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/stripe-connect-create-account-link \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json"
```

---

## Alternative: Fix CLI and Deploy

If you want to fix the CLI issue instead:

### Option A: Update Docker Desktop
1. Open Docker Desktop
2. Settings → General → Enable "Use WSL 2 based engine"
3. Settings → Resources → WSL Integration → Enable your distro
4. Restart Docker

### Option B: Use --no-verify-jwt
```powershell
supabase functions deploy create-payment-intent --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy validate-promotion --no-verify-jwt
supabase functions deploy stripe-connect-create-account-link --no-verify-jwt
```

### Option C: Deploy All at Once
```powershell
supabase functions deploy
```

---

## Common Issues

### "Function already exists"
- Delete the old function in Dashboard first
- Or use CLI: `supabase functions delete FUNCTION_NAME`

### "Missing environment variables"
- Set secrets in Dashboard: **Project Settings** → **Edge Functions** → **Secrets**
- Or via CLI: `supabase secrets set KEY=VALUE`

### "Import errors"
- Make sure you copied the ENTIRE file including imports
- Check for any missing dependencies

### "CORS errors"
- The functions already have CORS headers configured
- If still having issues, check the function logs

---

## Next Steps

After all functions are deployed:

1. ✅ Test each function with curl or Postman
2. ✅ Set up Stripe webhook (if not done already)
3. ✅ Test the full payment flow in your app
4. ✅ Monitor function logs for errors

---

## Quick Deploy Checklist

- [ ] Set all required secrets (Stripe keys, webhook secret)
- [ ] Deploy `create-payment-intent` function
- [ ] Deploy `stripe-webhook` function
- [ ] Deploy `validate-promotion` function
- [ ] Deploy `stripe-connect-create-account-link` function
- [ ] Verify all functions show as "Active" in Dashboard
- [ ] Test each function with a sample request
- [ ] Check function logs for errors
- [ ] Configure Stripe webhook URL
- [ ] Test end-to-end payment flow

---

## Support

If you encounter issues:
1. Check function logs in Dashboard
2. Verify all secrets are set correctly
3. Test with curl to isolate issues
4. Check Stripe Dashboard for webhook events
