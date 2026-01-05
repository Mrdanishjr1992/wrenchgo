# 🔍 WrenchGo Payment System - Root Cause Analysis

## Payment Model: Destination Charges

**How it works:**
1. Platform charges customer directly (via `create-payment-intent`)
2. Stripe automatically transfers funds to mechanic's connected account
3. Platform keeps application fee (12% commission + $15 platform fee)

**Code Location**: `supabase/functions/create-payment-intent/index.ts` (lines 189-192)

---

## 🚨 ROOT CAUSE: NO WEBHOOKS = NO PAYMENT UPDATES

### The Problem

Your payment flow has a **critical missing piece**: Stripe webhooks are not configured.

**What happens now:**
```
Customer pays → Stripe processes → ❌ NOTHING HAPPENS IN YOUR APP
```

**What should happen:**
```
Customer pays → Stripe processes → Webhook fires → Database updates → Job starts
```

### Why This Breaks Everything

1. **Payment Intent Created** ✅
   - `create-payment-intent` edge function creates payment
   - Returns `clientSecret` to app
   - Payment record created with `status: 'processing'`

2. **Customer Pays** ✅
   - Stripe processes payment successfully
   - Money moves from customer to platform
   - Platform fee transferred to mechanic

3. **Webhook Should Fire** ❌ **NOT CONFIGURED**
   - Stripe tries to send `payment_intent.succeeded` event
   - No webhook endpoint configured
   - Your app never knows payment succeeded

4. **Database Never Updates** ❌
   - Payment stuck in `status: 'processing'` forever
   - Job never starts
   - Mechanic never notified
   - Customer thinks payment failed

### Evidence

1. **You confirmed**: "no webhooks"
2. **Webhook handler exists**: `supabase/functions/stripe-webhook/index.ts`
3. **But not deployed/configured**: No endpoint in Stripe Dashboard
4. **Payment triggers not integrated**: "payment triggers haven't been integrated yet"

---

## 🔧 THE FIX (3 Critical Steps)

### Step 1: Deploy Webhook Handler
```bash
# Deploy the edge function
npx supabase functions deploy stripe-webhook

# Or via Supabase Dashboard (recommended for Windows)
```

### Step 2: Configure in Stripe Dashboard
1. Go to: https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://[YOUR-PROJECT].supabase.co/functions/v1/stripe-webhook`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, etc.
4. Copy signing secret → Add to Supabase env vars as `STRIPE_WEBHOOK_SECRET`

### Step 3: Test
```sql
-- After a test payment, check:
SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 5;
SELECT * FROM payments WHERE status = 'paid';
```

---

## 📊 Data Flow Analysis

### Current State (BROKEN)
```
App → create-payment-intent → Stripe → ❌ DEAD END
                                ↓
                          Payment succeeds
                                ↓
                          ❌ No webhook
                                ↓
                          Database never updates
```

### Fixed State (WORKING)
```
App → create-payment-intent → Stripe → Webhook → Database
                                ↓         ↓          ↓
                          Payment    Event    Update payment
                          succeeds   fires    status to 'paid'
                                              Update job status
                                              Notify mechanic
```

---

## 🗄️ Database Schema Verification

### Tables Required (All Exist ✅)

1. **payments** ✅
   - Tracks all payment transactions
   - Updated by webhook handler
   - Columns: `stripe_payment_intent_id`, `status`, `paid_at`, etc.

2. **mechanic_stripe_accounts** ✅
   - Stores Stripe Connect account info
   - Updated by `account.updated` webhook
   - Columns: `stripe_account_id`, `charges_enabled`, `payouts_enabled`

3. **webhook_events** ✅ (NEW)
   - Logs all webhook events for debugging
   - Columns: `stripe_event_id`, `event_type`, `processed`, `processing_error`

4. **jobs** ✅
   - Job status updated when payment succeeds
   - Webhook changes status from `pending_payment` → `in_progress`

---

## 🧪 Testing Strategy

### Test 1: Webhook Delivery
**Goal**: Verify Stripe can reach your webhook endpoint

**Steps**:
1. Deploy webhook handler
2. Configure in Stripe Dashboard
3. Send test webhook from Stripe
4. Check response is 200 OK

**SQL Check**:
```sql
SELECT * FROM webhook_events WHERE event_type = 'payment_intent.succeeded';
```

### Test 2: Payment Flow
**Goal**: Verify end-to-end payment processing

**Steps**:
1. Create test job
2. Accept quote
3. Pay with test card: 4242 4242 4242 4242
4. Check Stripe Dashboard (payment should succeed)
5. Check database (payment should update to 'paid')

**SQL Check**:
```sql
SELECT 
  p.status,
  p.paid_at,
  j.status as job_status
FROM payments p
JOIN jobs j ON j.id = p.job_id
WHERE p.stripe_payment_intent_id = 'pi_xxx';
```

### Test 3: Mechanic Payout
**Goal**: Verify mechanic receives funds

**Steps**:
1. Complete payment flow
2. Check Stripe Dashboard → Connect → Accounts
3. Find mechanic's account
4. Verify balance shows expected amount

**Expected**:
- Customer pays: $100
- Platform fee: $12 (12%) + $15 = $27
- Mechanic receives: $73

---

## 🚨 Secondary Issues

### Issue #2: Stripe Connect Onboarding (401 JWT)
**Status**: HIGH priority
**Impact**: Mechanics can't complete onboarding → can't receive payments

**Root Cause**: Edge function not deployed or JWT expired

**Fix**: Deploy `stripe-connect-create-account-link` via Supabase Dashboard

### Issue #3: Payment UI Not Integrated
**Status**: HIGH priority
**Impact**: No way for customers to trigger payments

**Root Cause**: Payment flow not connected to job completion screen

**Fix**: Add payment button when job status = 'completed'

---

## 📈 Payment Flow Architecture

### Recommended Flow

1. **Job Completion**
   - Mechanic marks job as complete
   - Job status → `completed`
   - Customer notified

2. **Payment Trigger**
   - Customer clicks "Pay Now"
   - App calls `create-payment-intent` edge function
   - Edge function:
     - Creates payment record (status: 'processing')
     - Creates Stripe PaymentIntent with destination charge
     - Returns `clientSecret`

3. **Customer Pays**
   - App shows Stripe payment sheet
   - Customer enters card details
   - Stripe processes payment

4. **Webhook Fires**
   - Stripe sends `payment_intent.succeeded` to webhook endpoint
   - Webhook handler:
     - Updates payment (status: 'paid', paid_at: now)
     - Updates job (status: 'in_progress')
     - Logs event in `webhook_events`

5. **Payout (Weekly)**
   - Stripe automatically transfers funds to mechanic
   - Platform keeps application fee
   - Mechanic receives payout to bank account

---

## 🎯 Success Metrics

### Payment System is Working When:

1. ✅ **Webhooks deliver successfully**
   - Check: Stripe Dashboard → Webhooks → Recent deliveries
   - Expected: 200 OK responses

2. ✅ **Payments update in database**
   - Check: `SELECT * FROM payments WHERE status = 'paid'`
   - Expected: Payments move from 'processing' to 'paid'

3. ✅ **Jobs progress correctly**
   - Check: `SELECT * FROM jobs WHERE status = 'in_progress'`
   - Expected: Jobs move from 'completed' to 'in_progress' after payment

4. ✅ **Mechanics receive funds**
   - Check: Stripe Dashboard → Connect → Accounts
   - Expected: Mechanic balance shows correct amount

5. ✅ **Platform receives commission**
   - Check: Stripe Dashboard → Balance
   - Expected: Platform balance shows application fees

---

## 📞 Immediate Action Required

**Priority 1 (BLOCKING):**
1. Deploy `stripe-webhook` edge function
2. Configure webhook in Stripe Dashboard
3. Test webhook delivery

**Priority 2 (HIGH):**
1. Deploy `stripe-connect-create-account-link` edge function
2. Test mechanic onboarding
3. Integrate payment UI in job completion flow

**Priority 3 (MEDIUM):**
1. Add error handling and retry logic
2. Set up monitoring and alerts
3. Add payment status polling (fallback if webhook fails)

---

## 📚 References

- **Action Plan**: `PAYMENT_ACTION_PLAN.md` (step-by-step instructions)
- **Setup Guide**: `PAYMENT_SETUP_GUIDE.md` (webhook configuration)
- **Known Issues**: `KNOWN_ISSUES.md` (other bugs and fixes)
- **Stripe Docs**: https://stripe.com/docs/connect/destination-charges
- **Webhook Docs**: https://stripe.com/docs/webhooks

---

**Diagnosis Date**: 2025-02-04
**Status**: Root cause identified, fix plan created
**Next Step**: Deploy webhook handler (see PAYMENT_ACTION_PLAN.md)
