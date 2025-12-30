# 🚀 Deploy Edge Functions via Supabase Dashboard

## Quick Links

- **Your Supabase Dashboard:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt
- **Edge Functions Page:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

---

## ⚠️ IMPORTANT: Set Secrets First!

Before deploying functions, you MUST set these secrets:

### Go to: Project Settings → Edge Functions → Secrets

Add these secrets:

```
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
OPENAI_API_KEY=sk-YOUR_OPENAI_KEY (if using ID verification)
```

**How to get these:**
- **STRIPE_SECRET_KEY:** https://dashboard.stripe.com/test/apikeys (Reveal "Secret key")
- **STRIPE_WEBHOOK_SECRET:** Create webhook first (see below), then copy signing secret
- **OPENAI_API_KEY:** https://platform.openai.com/api-keys

---

## 📋 Deployment Checklist

Follow these steps in order:

- [ ] **Step 1:** Set secrets in Supabase Dashboard
- [ ] **Step 2:** Deploy `create-payment-intent` function
- [ ] **Step 3:** Deploy `stripe-webhook` function
- [ ] **Step 4:** Deploy `validate-promotion` function
- [ ] **Step 5:** Deploy `stripe-connect-create-account-link` function
- [ ] **Step 6:** Create Stripe webhook
- [ ] **Step 7:** Test all functions

---

## 🔧 How to Deploy Each Function

### General Steps (for each function):

1. Go to: https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions
2. Click **"Deploy a new function"** (or **"New Edge Function"**)
3. Enter the function name (exactly as shown below)
4. Copy the code from the section below
5. Paste into the code editor
6. Click **"Deploy function"**
7. Wait for deployment to complete (green checkmark)

---

## Function 1: create-payment-intent

### Function Name:
```
create-payment-intent
```

### Code to Copy:

Open this file and copy ALL contents:
```
supabase/functions/create-payment-intent/index.ts
```

**Or copy from here:**

The file is 281 lines. Make sure you copy from line 1 (`import { serve }...`) to line 281 (the final closing brace and semicolon).

### Required Secrets:
- ✅ `STRIPE_SECRET_KEY`
- ✅ `SUPABASE_URL` (auto-provided)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

### Test URL:
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/create-payment-intent
```

---

## Function 2: stripe-webhook

### Function Name:
```
stripe-webhook
```

### Code to Copy:

Open this file and copy ALL contents:
```
supabase/functions/stripe-webhook/index.ts
```

### Required Secrets:
- ✅ `STRIPE_SECRET_KEY`
- ✅ `STRIPE_WEBHOOK_SECRET`
- ✅ `SUPABASE_URL` (auto-provided)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

### Webhook URL (for Stripe Dashboard):
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/stripe-webhook
```

**⚠️ IMPORTANT:** After deploying this function, you MUST create the webhook in Stripe Dashboard!

---

## Function 3: validate-promotion

### Function Name:
```
validate-promotion
```

### Code to Copy:

Open this file and copy ALL contents:
```
supabase/functions/validate-promotion/index.ts
```

### Required Secrets:
- ✅ `SUPABASE_URL` (auto-provided)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

### Test URL:
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/validate-promotion
```

---

## Function 4: stripe-connect-create-account-link

### Function Name:
```
stripe-connect-create-account-link
```

### Code to Copy:

Open this file and copy ALL contents:
```
supabase/functions/stripe-connect-create-account-link/index.ts
```

### Required Secrets:
- ✅ `STRIPE_SECRET_KEY`
- ✅ `SUPABASE_URL` (auto-provided)
- ✅ `SUPABASE_ANON_KEY` (auto-provided)

### Test URL:
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/stripe-connect-create-account-link
```

---

## 🔗 Step 6: Create Stripe Webhook

After deploying the `stripe-webhook` function:

### 1. Go to Stripe Dashboard:
https://dashboard.stripe.com/test/webhooks

### 2. Click "Add endpoint"

### 3. Enter Endpoint URL:
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/stripe-webhook
```

### 4. Select Events:
Click "Select events" and choose these 5:
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed`
- ✅ `payment_intent.canceled`
- ✅ `charge.refunded`
- ✅ `account.updated`

### 5. Click "Add endpoint"

### 6. Copy Signing Secret:
- Click "Reveal" next to "Signing secret"
- Copy the secret (starts with `whsec_`)

### 7. Add to Supabase Secrets:
- Go back to Supabase Dashboard
- Project Settings → Edge Functions → Secrets
- Add: `STRIPE_WEBHOOK_SECRET` = `whsec_YOUR_SECRET`

---

## ✅ Verification

After deploying all functions, verify they're working:

### 1. Check Function List
Go to: https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

You should see:
- ✅ `create-payment-intent` - Active
- ✅ `stripe-webhook` - Active
- ✅ `validate-promotion` - Active
- ✅ `stripe-connect-create-account-link` - Active

### 2. Check Function Logs
Click on each function → **Logs** tab to see if there are any errors

### 3. Test with curl

**Test create-payment-intent:**
```bash
curl -X POST https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/create-payment-intent \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test-job-id", "quoteId": "test-quote-id"}'
```

**Test validate-promotion:**
```bash
curl -X POST https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/validate-promotion \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME10", "amountCents": 10000}'
```

**Test stripe-connect-create-account-link:**
```bash
curl -X POST https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/stripe-connect-create-account-link \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 🐛 Troubleshooting

### "Missing environment variables"
- Make sure you set all secrets in: Project Settings → Edge Functions → Secrets
- Redeploy the function after adding secrets

### "Function not found"
- Make sure the function name matches exactly (no typos)
- Check that deployment completed successfully (green checkmark)

### "Import errors" or "Module not found"
- Make sure you copied the ENTIRE file including all imports at the top
- Don't miss the first few lines or the last closing brace

### "CORS errors"
- The functions already have CORS headers configured
- If still having issues, check the function logs for details

### Webhook not receiving events
- Make sure you deployed the `stripe-webhook` function first
- Verify the webhook URL in Stripe Dashboard is correct
- Check that you selected the correct events
- Verify `STRIPE_WEBHOOK_SECRET` is set in Supabase

---

## 📱 Next Steps

After all functions are deployed:

1. ✅ Test payment flow in your React Native app
2. ✅ Test promotion codes
3. ✅ Test Stripe Connect onboarding for mechanics
4. ✅ Monitor function logs for errors
5. ✅ Set up production Stripe keys when ready to go live

---

## 🎯 Quick Reference

### Your URLs:
- **Supabase Dashboard:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt
- **Edge Functions:** https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions
- **Stripe Dashboard:** https://dashboard.stripe.com/test
- **Stripe Webhooks:** https://dashboard.stripe.com/test/webhooks

### Function URLs:
```
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/create-payment-intent
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/stripe-webhook
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/validate-promotion
https://kkpkpybqbtmcvriqrmrt.supabase.co/functions/v1/stripe-connect-create-account-link
```

---

## 💡 Tips

1. **Deploy one function at a time** - easier to troubleshoot if something goes wrong
2. **Check logs after each deployment** - catch errors early
3. **Test with curl first** - before testing in the app
4. **Use test mode in Stripe** - don't use real money during development
5. **Monitor webhook events** - in Stripe Dashboard to see if they're being received

---

## 🆘 Need Help?

If you encounter issues:
1. Check the function logs in Supabase Dashboard
2. Verify all secrets are set correctly
3. Make sure the webhook is configured in Stripe
4. Test with curl to isolate the issue
5. Check Stripe Dashboard for webhook delivery status

---

## ✨ You're Almost Done!

Once all 4 functions are deployed and the webhook is configured, your payment system will be fully operational! 🎉

The app will be able to:
- ✅ Create payment intents with fee breakdowns
- ✅ Apply promotion codes
- ✅ Process payments via Stripe
- ✅ Handle webhooks for payment status updates
- ✅ Onboard mechanics to Stripe Connect
- ✅ Calculate and transfer mechanic payouts

Good luck! 🚀
