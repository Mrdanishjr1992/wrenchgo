# 🚨 WrenchGo Payment System - CRITICAL ACTION PLAN

## Executive Summary

**Current Status**: ❌ PAYMENTS NOT WORKING
**Root Cause**: No webhooks configured - payments never update in database
**Impact**: BLOCKING - Cannot process any payments until fixed

---

## 🔴 CRITICAL ISSUES (Must Fix Immediately)

### Issue #1: NO WEBHOOKS CONFIGURED ⚠️⚠️⚠️
**Status**: BLOCKING ALL PAYMENTS
**Impact**: Payments succeed in Stripe but app never knows about it

**What's Happening**:
1. Customer pays → Stripe processes payment ✅
2. Stripe tries to notify your app via webhook → ❌ NO WEBHOOK CONFIGURED
3. Your database never updates → Payment stuck in "processing" forever
4. Job never starts, mechanic never gets paid

**Fix Required**: Deploy webhook handler + configure in Stripe Dashboard (see below)

---

### Issue #2: Stripe Connect Onboarding Failing (401 JWT)
**Status**: HIGH - Mechanics can't complete onboarding
**Impact**: Mechanics can't receive payments

**Error**: `Failed to create account link (401)`
**Root Cause**: Edge function not deployed or JWT expired

**Fix Required**: Deploy edge function via Supabase Dashboard

---

### Issue #3: Payment UI Not Integrated
**Status**: HIGH - No way to trigger payments
**Impact**: Customers can't pay for jobs

**Fix Required**: Integrate payment flow in job completion screen

---

## ✅ WHAT'S ALREADY WORKING

1. ✅ Payment infrastructure code exists (`create-payment-intent`, `stripe-webhook`)
2. ✅ Database tables created (`payments`, `mechanic_stripe_accounts`, `webhook_events`)
3. ✅ Stripe Connect setup code exists
4. ✅ Destination charges configured (12% commission + $15 platform fee)

---

## 🎯 ACTION PLAN (Step-by-Step)

### STEP 1: Deploy Webhook Handler (CRITICAL - DO THIS FIRST)

#### 1.1 Deploy the Edge Function
```bash
# Option A: Via Supabase Dashboard (RECOMMENDED for Windows)
1. Go to Supabase Dashboard → Edge Functions
2. Click "Deploy new function"
3. Upload from: supabase/functions/stripe-webhook/
4. Click "Deploy"

# Option B: Via CLI (Linux/Mac only)
npx supabase functions deploy stripe-webhook
```

#### 1.2 Set Environment Variables
Go to Supabase Dashboard → Project Settings → Edge Functions → Environment Variables

Add these:
- `STRIPE_SECRET_KEY` = Your Stripe secret key (sk_test_... or sk_live_...)
- `STRIPE_WEBHOOK_SECRET` = (Get this in Step 1.3)

#### 1.3 Configure Webhook in Stripe Dashboard

1. **Go to**: https://dashboard.stripe.com/webhooks
2. **Click**: "Add endpoint"
3. **Endpoint URL**: `https://[YOUR-PROJECT-REF].supabase.co/functions/v1/stripe-webhook`
   - Find your project ref in Supabase Dashboard → Project Settings → API
   - Example: `https://abcdefghijklmnop.supabase.co/functions/v1/stripe-webhook`

4. **Select events**:
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `payment_intent.canceled`
   - ✅ `charge.refunded`
   - ✅ `account.updated`

5. **Click**: "Add endpoint"

6. **Copy the Signing Secret** (starts with `whsec_...`)
   - Go back to Supabase → Edge Functions → Environment Variables
   - Set `STRIPE_WEBHOOK_SECRET` = the signing secret

7. **Test the webhook**:
   - Click "Send test webhook"
   - Select `payment_intent.succeeded`
   - Should return 200 OK

#### 1.4 Verify Webhook is Working
```sql
-- Check webhook events are being logged
SELECT 
  stripe_event_id,
  event_type,
  processed,
  processing_error,
  created_at
FROM webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

---

### STEP 2: Fix Stripe Connect Onboarding

#### 2.1 Deploy Edge Function
```bash
# Via Supabase Dashboard (RECOMMENDED)
1. Go to Edge Functions
2. Deploy: supabase/functions/stripe-connect-create-account-link/
```

#### 2.2 Test Onboarding Flow
1. Open app as mechanic
2. Go to Profile → "Setup Stripe Account"
3. Should open Stripe onboarding in browser
4. Complete onboarding
5. Return to app
6. Verify in database:

```sql
SELECT 
  mechanic_id,
  stripe_account_id,
  status,
  charges_enabled,
  payouts_enabled,
  details_submitted
FROM mechanic_stripe_accounts
WHERE mechanic_id = '[YOUR_MECHANIC_PROFILE_ID]';
```

Expected result:
- `charges_enabled: true`
- `payouts_enabled: true`
- `status: 'active'`

---

### STEP 3: Integrate Payment UI

#### 3.1 Find Job Completion Screen
Location: Likely in `app/(customer)/jobs/[id].tsx` or similar

#### 3.2 Add Payment Button
When job status changes to "completed", show payment button:

```typescript
// Example integration (adjust to your actual code)
const handlePayment = async () => {
  try {
    setLoading(true);
    
    // Call create-payment-intent edge function
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: job.id,
          quoteId: job.accepted_quote_id,
        }),
      }
    );
    
    const data = await response.json();
    
    if (data.clientSecret) {
      // Open Stripe payment sheet
      // Use @stripe/stripe-react-native
      const { error } = await presentPaymentSheet({
        clientSecret: data.clientSecret,
      });
      
      if (error) {
        Alert.alert('Payment failed', error.message);
      } else {
        Alert.alert('Success', 'Payment completed!');
        // Refresh job status
      }
    }
  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
};
```

#### 3.3 Install Stripe React Native SDK
```bash
npx expo install @stripe/stripe-react-native
```

---

## 🧪 TESTING CHECKLIST

### Test 1: Webhook Delivery
1. ✅ Go to Stripe Dashboard → Webhooks
2. ✅ Click your webhook endpoint
3. ✅ Check "Recent deliveries"
4. ✅ Should see successful 200 responses

### Test 2: Payment Flow End-to-End
1. ✅ Create a test job
2. ✅ Mechanic accepts and completes job
3. ✅ Customer pays with test card (4242 4242 4242 4242)
4. ✅ Check Stripe Dashboard → Payments (should see payment)
5. ✅ Check database:

```sql
-- Payment should be marked as paid
SELECT * FROM payments WHERE job_id = '[JOB_ID]';
-- Expected: status = 'paid', paid_at IS NOT NULL

-- Job should be in_progress
SELECT status FROM jobs WHERE id = '[JOB_ID]';
-- Expected: status = 'in_progress'
```

### Test 3: Mechanic Payout
1. ✅ Check Stripe Dashboard → Connect → Accounts
2. ✅ Find mechanic's account
3. ✅ Verify balance shows expected amount
4. ✅ Payouts should happen automatically (weekly)

---

## 📊 MONITORING & DEBUGGING

### Check Webhook Logs
```sql
-- See all webhook events
SELECT 
  stripe_event_id,
  event_type,
  processed,
  processing_error,
  created_at
FROM webhook_events
ORDER BY created_at DESC;

-- See failed webhooks
SELECT * FROM webhook_events 
WHERE processing_error IS NOT NULL;
```

### Check Payment Status
```sql
-- See all payments
SELECT 
  p.id,
  p.status,
  p.customer_total_cents / 100.0 as customer_total_dollars,
  p.mechanic_payout_cents / 100.0 as mechanic_payout_dollars,
  p.platform_revenue_cents / 100.0 as platform_revenue_dollars,
  p.paid_at,
  p.failure_reason,
  j.status as job_status
FROM payments p
JOIN jobs j ON j.id = p.job_id
ORDER BY p.created_at DESC;
```

### Check Stripe Dashboard
1. **Payments**: https://dashboard.stripe.com/payments
2. **Connect Accounts**: https://dashboard.stripe.com/connect/accounts
3. **Webhooks**: https://dashboard.stripe.com/webhooks
4. **Events**: https://dashboard.stripe.com/events
5. **Logs**: https://dashboard.stripe.com/logs

---

## 🚨 COMMON ERRORS & FIXES

### Error: "Webhook signature verification failed"
**Fix**: `STRIPE_WEBHOOK_SECRET` doesn't match Stripe Dashboard
- Go to Stripe → Webhooks → Click your endpoint → Copy signing secret
- Update in Supabase → Edge Functions → Environment Variables

### Error: "Payment record not found"
**Fix**: Payment wasn't created before webhook fired
- Ensure `create-payment-intent` creates payment record BEFORE returning clientSecret
- Check `create-payment-intent` logs

### Error: "Mechanic account not found"
**Fix**: Mechanic hasn't completed Stripe onboarding
- Check `mechanic_stripe_accounts` table
- Ensure `charges_enabled` and `payouts_enabled` are true

### Error: "Invalid JWT"
**Fix**: Token expired or edge function not deployed
- Sign out and sign back in
- Deploy edge function via Supabase Dashboard

---

## 📞 NEXT STEPS

1. **[CRITICAL]** Deploy webhook handler (Step 1)
2. **[CRITICAL]** Configure webhook in Stripe Dashboard (Step 1.3)
3. **[HIGH]** Deploy Stripe Connect edge function (Step 2)
4. **[HIGH]** Test mechanic onboarding (Step 2.2)
5. **[HIGH]** Integrate payment UI (Step 3)
6. **[MEDIUM]** Test end-to-end payment flow
7. **[LOW]** Set up monitoring and alerts

---

## 📚 DOCUMENTATION

- **Payment Setup Guide**: `PAYMENT_SETUP_GUIDE.md`
- **Known Issues**: `KNOWN_ISSUES.md`
- **Stripe Docs**: https://stripe.com/docs/connect/destination-charges
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions

---

## ✅ SUCCESS CRITERIA

Payment system is working when:
1. ✅ Webhooks deliver successfully (200 OK in Stripe Dashboard)
2. ✅ Payments update from "processing" to "paid" in database
3. ✅ Jobs update from "pending_payment" to "in_progress"
4. ✅ Mechanics can complete onboarding
5. ✅ Mechanics see correct balance in Stripe Dashboard
6. ✅ Customers can pay with credit card
7. ✅ Platform receives 12% commission + $15 fee
8. ✅ Mechanics receive remaining amount

---

**Last Updated**: 2025-02-04
**Status**: Awaiting webhook deployment
