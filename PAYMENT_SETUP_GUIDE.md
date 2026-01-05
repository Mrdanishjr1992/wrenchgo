# WrenchGo Payment Infrastructure Setup Guide

## 🚨 CRITICAL: Stripe Webhook Setup (REQUIRED FOR PAYMENTS TO WORK)

### Step 1: Deploy Webhook Handler

Your webhook handler exists but needs to be deployed and configured.

**Deploy the webhook function:**
```bash
npx supabase functions deploy stripe-webhook
```

**Set environment variables in Supabase Dashboard:**
1. Go to Project Settings → Edge Functions → Environment Variables
2. Add these variables:
   - `STRIPE_SECRET_KEY` = Your Stripe secret key (sk_test_... or sk_live_...)
   - `STRIPE_WEBHOOK_SECRET` = (Get this in Step 2 below)

### Step 2: Configure Webhook in Stripe Dashboard

1. **Go to Stripe Dashboard** → Developers → Webhooks
2. **Click "Add endpoint"**
3. **Endpoint URL**: `https://[YOUR-PROJECT-REF].supabase.co/functions/v1/stripe-webhook`
   - Replace `[YOUR-PROJECT-REF]` with your Supabase project reference
   - Example: `https://abcdefghijklmnop.supabase.co/functions/v1/stripe-webhook`

4. **Select events to listen to:**
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `payment_intent.canceled`
   - ✅ `charge.refunded`
   - ✅ `account.updated` (for Connect account status)

5. **Click "Add endpoint"**

6. **Copy the Signing Secret** (starts with `whsec_...`)
   - Go back to Supabase Dashboard → Edge Functions → Environment Variables
   - Set `STRIPE_WEBHOOK_SECRET` = the signing secret you just copied

7. **Test the webhook:**
   - In Stripe Dashboard, click "Send test webhook"
   - Select `payment_intent.succeeded`
   - Check if it returns 200 OK

---

## 🔧 CRITICAL ISSUES TO FIX

### Issue #1: Payments Table Missing
**Problem**: The `payments` table exists in Stripe Wrapper but not in your migrations
**Impact**: Webhook handler will fail when trying to update payment records

**Fix**: Create the payments table migration (see below)

### Issue #2: Stripe Connect Onboarding Failing (401 JWT)
**Problem**: Edge function `stripe-connect-create-account-link` returns 401
**Root Cause**: Function not deployed or JWT validation failing

**Fix**:
1. Deploy via Supabase Dashboard (Windows CLI has issues):
   - Go to Edge Functions → stripe-connect-create-account-link
   - Click "Deploy" and upload from `supabase/functions/stripe-connect-create-account-link/`
2. Or sign out/in to get fresh JWT token

### Issue #3: Payment Flow Not Integrated
**Problem**: No UI to trigger payments after job completion
**Impact**: Customers can't pay, mechanics can't get paid

**Fix**: Integrate payment UI (see implementation guide below)

---

## 📊 Database Schema Required

### Payments Table
The webhook handler expects this schema. Check if it exists:

```sql
-- Check if payments table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' 
AND table_schema = 'public';
```

If missing, you need to create it. The webhook handler expects these columns:
- `id` (uuid)
- `job_id` (uuid)
- `quote_id` (uuid)
- `customer_id` (uuid)
- `mechanic_id` (uuid)
- `stripe_payment_intent_id` (text)
- `stripe_charge_id` (text)
- `stripe_connected_account_id` (text)
- `status` (text) - values: processing, paid, failed, cancelled, refunded, partially_refunded
- `quote_amount_cents` (integer)
- `customer_platform_fee_cents` (integer)
- `customer_discount_cents` (integer)
- `customer_total_cents` (integer)
- `mechanic_platform_commission_cents` (integer)
- `mechanic_payout_cents` (integer)
- `platform_revenue_cents` (integer)
- `payment_method_type` (text)
- `receipt_url` (text)
- `paid_at` (timestamptz)
- `refunded_at` (timestamptz)
- `refund_amount_cents` (integer)
- `failure_reason` (text)
- `promotion_codes` (text[])
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

---

## 🧪 Testing Checklist

### Test Stripe Connect Onboarding:
1. ✅ Mechanic clicks "Setup Stripe Account"
2. ✅ Opens Stripe onboarding in browser
3. ✅ Completes onboarding
4. ✅ Returns to app
5. ✅ `mechanic_stripe_accounts` table shows `charges_enabled: true, payouts_enabled: true`

### Test Payment Flow:
1. ✅ Customer accepts quote
2. ✅ Payment intent created (check `create-payment-intent` logs)
3. ✅ Customer enters card details
4. ✅ Payment succeeds in Stripe Dashboard
5. ✅ Webhook fires `payment_intent.succeeded`
6. ✅ Payment record in DB updates to `status: 'paid'`
7. ✅ Job status updates to `in_progress`

### Verify in Supabase:
```sql
-- Check recent payments
SELECT 
  id,
  job_id,
  status,
  customer_total_cents,
  mechanic_payout_cents,
  paid_at,
  created_at
FROM payments
ORDER BY created_at DESC
LIMIT 10;

-- Check mechanic Stripe accounts
SELECT 
  mechanic_id,
  stripe_account_id,
  status,
  charges_enabled,
  payouts_enabled,
  details_submitted
FROM mechanic_stripe_accounts;
```

### Verify in Stripe Dashboard:
1. **Payments** → Check recent Payment Intents
2. **Connect** → Check connected accounts status
3. **Developers** → **Webhooks** → Check delivery logs
4. **Developers** → **Events** → Check recent events

---

## 🚀 Implementation Priority

1. **[CRITICAL]** Deploy webhook handler + configure in Stripe Dashboard
2. **[CRITICAL]** Verify/create payments table schema
3. **[HIGH]** Fix Stripe Connect onboarding (deploy edge function)
4. **[HIGH]** Integrate payment UI in job completion flow
5. **[MEDIUM]** Add webhook event logging table for debugging
6. **[LOW]** Add payout scheduling (weekly transfers)

---

## 📞 Support

If webhooks still don't work after setup:
1. Check Supabase Edge Function logs
2. Check Stripe webhook delivery logs
3. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
4. Test with Stripe CLI: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`
