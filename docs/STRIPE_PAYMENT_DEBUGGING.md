# Stripe Payment Debugging Guide: Why Payments Succeed But Don't Appear in Dashboard

## Executive Summary

**Your Issue:** PaymentIntents are created successfully, client flow completes, but transactions don't appear in Stripe Dashboard.

**Root Cause Analysis:** Based on your code, I've identified **3 CRITICAL ISSUES** that cause this exact problem.

---

## 🚨 CRITICAL ISSUES IN YOUR CODE

### Issue #1: **NO STRIPE-ACCOUNT HEADER FOR CONNECT CHARGES**

**Location:** `supabase/functions/create-payment-intent/index.ts:185-206`

**Problem:**
```typescript
const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: finalTotalCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: { /* ... */ },
  },
  { idempotencyKey }
)
```

**What's Wrong:**
- You're creating a PaymentIntent on the **platform account** (your main Stripe account)
- You store `mechanic_stripe_account_id` in metadata but **never use it**
- The payment goes to YOUR platform account, not the mechanic's connected account
- **Platform account payments don't show in the main dashboard by default in test mode**

**Why This Happens:**
When you create a PaymentIntent without specifying a connected account, Stripe creates it on the platform account. In test mode, these often don't appear in the main Payments view because Stripe separates platform charges from direct charges.

**The Fix:**
You have 3 options for Stripe Connect charges:

#### Option A: **Destination Charges** (Recommended for your use case)
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: finalTotalCents,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  application_fee_amount: finalPlatformFeeCents, // Platform fee
  transfer_data: {
    destination: mechanicAccount.stripe_account_id, // Mechanic gets the rest
  },
  metadata: {
    job_id,
    invoice_id: invoice.id,
    payment_id: payment.id,
    customer_id: job.customer_id,
    mechanic_id: job.mechanic_id,
  },
  description: `WrenchGo Job: ${job.title}`,
}, { idempotencyKey });
```

**Destination Charges:**
- ✅ Payment appears in **platform dashboard** immediately
- ✅ Funds automatically transferred to mechanic
- ✅ Platform fee deducted automatically
- ✅ Customer sees platform as merchant
- ✅ Platform handles disputes/refunds

#### Option B: **Direct Charges** (Alternative)
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: finalTotalCents,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  metadata: { /* ... */ },
  description: `WrenchGo Job: ${job.title}`,
}, {
  stripeAccount: mechanicAccount.stripe_account_id, // Charge on mechanic's account
  idempotencyKey,
});

// Then create a separate transfer for platform fee
const transfer = await stripe.transfers.create({
  amount: finalPlatformFeeCents,
  currency: 'usd',
  destination: 'YOUR_PLATFORM_ACCOUNT_ID', // Reverse transfer for fee
  transfer_group: `job_${job_id}`,
}, {
  stripeAccount: mechanicAccount.stripe_account_id,
});
```

**Direct Charges:**
- ❌ Payment appears in **mechanic's dashboard**, not platform
- ❌ Requires separate transfer for platform fee
- ❌ More complex refund handling
- ✅ Customer sees mechanic as merchant

#### Option C: **Separate Charge + Transfer** (Most complex)
```typescript
// 1. Charge customer on platform account
const paymentIntent = await stripe.paymentIntents.create({
  amount: finalTotalCents,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  metadata: { /* ... */ },
});

// 2. After payment succeeds (in webhook), transfer to mechanic
const transfer = await stripe.transfers.create({
  amount: mechanicNetCents,
  currency: 'usd',
  destination: mechanicAccount.stripe_account_id,
  transfer_group: `job_${job_id}`,
  metadata: {
    job_id,
    payment_id: payment.id,
  },
});
```

**Separate Charge + Transfer:**
- ✅ Payment appears in **platform dashboard**
- ❌ Requires webhook handling for transfer
- ❌ Delay between charge and transfer
- ✅ Maximum control over funds flow

---

### Issue #2: **MISSING PAYMENT CONFIRMATION**

**Location:** Your client-side code (not shown, but inferred)

**Problem:**
You're likely doing this:
```typescript
// ❌ WRONG - Creates PaymentIntent but never confirms it
const { clientSecret } = await createPaymentIntent(jobId);
// ... user enters card details ...
// ... but payment is never confirmed!
```

**What's Wrong:**
- Creating a PaymentIntent puts it in `requires_payment_method` or `requires_confirmation` status
- These statuses **don't appear in Stripe Dashboard Payments view**
- You must call `confirmPayment()` or `confirmCardPayment()` to actually charge the card

**The Fix:**
```typescript
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

// In your payment component
const stripe = useStripe();
const elements = useElements();

const handlePayment = async () => {
  // 1. Create PaymentIntent on server
  const { clientSecret } = await createPaymentIntent(jobId);
  
  // 2. Confirm payment with card details
  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: elements.getElement(CardElement),
      billing_details: {
        name: customerName,
        email: customerEmail,
      },
    },
  });
  
  if (error) {
    console.error('Payment failed:', error);
    return;
  }
  
  // 3. Payment succeeded!
  console.log('PaymentIntent:', paymentIntent);
  // paymentIntent.status === 'succeeded'
};
```

**For React Native with Stripe SDK:**
```typescript
import { useStripe } from '@stripe/stripe-react-native';

const { confirmPayment } = useStripe();

const handlePayment = async () => {
  const { clientSecret } = await createPaymentIntent(jobId);
  
  const { error, paymentIntent } = await confirmPayment(clientSecret, {
    paymentMethodType: 'Card',
    paymentMethodData: {
      billingDetails: {
        name: customerName,
        email: customerEmail,
      },
    },
  });
  
  if (error) {
    console.error('Payment failed:', error);
    return;
  }
  
  console.log('Payment succeeded:', paymentIntent);
};
```

---

### Issue #3: **SETUPINTENT VS PAYMENTINTENT CONFUSION**

**Location:** `supabase/functions/customer-setup-payment-method/index.ts`

**Problem:**
```typescript
const setupIntent = await stripeRequest("setup_intents", {
  customer: stripeCustomerId,
  "payment_method_types[]": "card",
  usage: "off_session",
});
```

**What's Wrong:**
- **SetupIntents** are for saving payment methods WITHOUT charging
- **SetupIntents NEVER appear in Stripe Payments dashboard**
- They only appear in "Payment methods" section
- If you're testing with SetupIntent, you'll never see a payment

**The Difference:**

| Feature | SetupIntent | PaymentIntent |
|---------|-------------|---------------|
| Purpose | Save card for future use | Charge card now |
| Dashboard | Payment Methods | Payments |
| Creates charge | ❌ No | ✅ Yes |
| Requires amount | ❌ No | ✅ Yes |
| Use case | Add card to wallet | Process payment |

**The Fix:**
Use SetupIntent for adding cards, PaymentIntent for charging:

```typescript
// 1. Add card (SetupIntent) - in payment-setup screen
const setupIntent = await stripe.setupIntents.create({
  customer: stripeCustomerId,
  payment_method_types: ['card'],
  usage: 'off_session',
});

// 2. Charge card (PaymentIntent) - in payment screen
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000,
  currency: 'usd',
  customer: stripeCustomerId,
  payment_method: savedPaymentMethodId, // From SetupIntent
  off_session: true,
  confirm: true, // Auto-confirm for saved cards
});
```

---

## 📊 PAYMENT STATUS STATES THAT CAUSE "INVISIBLE" PAYMENTS

### PaymentIntent Lifecycle

```
requires_payment_method  ← Created but no card attached (INVISIBLE)
         ↓
requires_confirmation    ← Card attached but not confirmed (INVISIBLE)
         ↓
requires_action          ← Needs 3DS authentication (INVISIBLE)
         ↓
processing               ← Being processed (VISIBLE but pending)
         ↓
succeeded                ← Completed (FULLY VISIBLE)
```

**Dashboard Visibility:**

| Status | Visible in Dashboard? | Notes |
|--------|----------------------|-------|
| `requires_payment_method` | ❌ No | Just created, no card |
| `requires_confirmation` | ❌ No | Card attached, not confirmed |
| `requires_action` | ⚠️ Partial | Shows as "Incomplete" |
| `processing` | ✅ Yes | Shows as "Processing" |
| `succeeded` | ✅ Yes | Shows as "Succeeded" |
| `canceled` | ⚠️ Partial | Shows in "All payments" filter |

**How to Check Status:**
```typescript
// Server-side
const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
console.log('Status:', paymentIntent.status);
console.log('Amount:', paymentIntent.amount);
console.log('Customer:', paymentIntent.customer);
console.log('Charges:', paymentIntent.charges.data);

// If status is 'requires_confirmation', you forgot to confirm!
// If status is 'requires_action', customer needs to complete 3DS
```

---

## 🔍 EXACT LOGS TO PRINT SERVER-SIDE

Add these logs to your `create-payment-intent` function:

```typescript
// After creating PaymentIntent
console.log('=== PAYMENT INTENT CREATED ===');
console.log('PaymentIntent ID:', paymentIntent.id);
console.log('Status:', paymentIntent.status);
console.log('Amount:', paymentIntent.amount, 'cents');
console.log('Currency:', paymentIntent.currency);
console.log('Customer:', paymentIntent.customer);
console.log('Client Secret:', paymentIntent.client_secret);
console.log('Metadata:', JSON.stringify(paymentIntent.metadata, null, 2));
console.log('Application Fee:', paymentIntent.application_fee_amount);
console.log('Transfer Data:', paymentIntent.transfer_data);
console.log('On Behalf Of:', paymentIntent.on_behalf_of);
console.log('Stripe Account:', paymentIntent.stripe_account); // Should be null for platform charges
console.log('==============================');

// In webhook handler
console.log('=== PAYMENT INTENT WEBHOOK ===');
console.log('Event Type:', event.type);
console.log('PaymentIntent ID:', paymentIntent.id);
console.log('Status:', paymentIntent.status);
console.log('Amount Received:', paymentIntent.amount_received);
console.log('Charges:', paymentIntent.charges.data.map(c => ({
  id: c.id,
  amount: c.amount,
  status: c.status,
  paid: c.paid,
  destination: c.destination,
  transfer: c.transfer,
  application_fee: c.application_fee,
})));
console.log('==============================');
```

**Critical Fields to Verify:**

1. **`paymentIntent.status`** - Must be `succeeded` to appear in dashboard
2. **`paymentIntent.charges.data`** - Must have at least one charge
3. **`paymentIntent.amount_received`** - Must match `amount`
4. **`paymentIntent.transfer_data.destination`** - Should be mechanic's account ID
5. **`paymentIntent.application_fee_amount`** - Should be your platform fee
6. **`charge.destination`** - Should be mechanic's account ID (for destination charges)
7. **`charge.transfer`** - Should be null for destination charges, populated for separate transfers

---

## ✅ MINIMAL CORRECT EXAMPLE

### Server-Side (Edge Function)

```typescript
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const { job_id, amount_cents, mechanic_account_id, platform_fee_cents } = await req.json();
  
  // CRITICAL: Use destination charges for Connect
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount_cents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    
    // 🔥 THIS IS THE KEY - Destination charge
    application_fee_amount: platform_fee_cents,
    transfer_data: {
      destination: mechanic_account_id,
    },
    
    metadata: {
      job_id,
      platform: 'wrenchgo',
    },
    description: `WrenchGo Job Payment`,
  });
  
  // Log for debugging
  console.log('PaymentIntent created:', {
    id: paymentIntent.id,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    application_fee: paymentIntent.application_fee_amount,
    destination: paymentIntent.transfer_data?.destination,
  });
  
  return new Response(JSON.stringify({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### Client-Side (React Native)

```typescript
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from './supabase';

export function PaymentScreen({ jobId, amount }) {
  const { confirmPayment, loading } = useStripe();
  
  const handlePayment = async () => {
    try {
      // 1. Create PaymentIntent on server
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          job_id: jobId,
          amount_cents: amount * 100,
          mechanic_account_id: 'acct_xxx', // From mechanic's Connect account
          platform_fee_cents: 1500,
        },
      });
      
      if (error) throw error;
      
      // 2. Confirm payment with Stripe SDK
      const { error: confirmError, paymentIntent } = await confirmPayment(
        data.clientSecret,
        {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              name: 'Customer Name',
              email: 'customer@example.com',
            },
          },
        }
      );
      
      if (confirmError) {
        console.error('Payment failed:', confirmError);
        Alert.alert('Payment Failed', confirmError.message);
        return;
      }
      
      // 3. Payment succeeded!
      console.log('Payment succeeded:', paymentIntent);
      Alert.alert('Success', 'Payment completed!');
      
      // 4. Verify in your database
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .single();
      
      console.log('Payment record:', payment);
      
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', error.message);
    }
  };
  
  return (
    <Button title="Pay Now" onPress={handlePayment} disabled={loading} />
  );
}
```

### Webhook Handler

```typescript
serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  
  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    Deno.env.get('STRIPE_WEBHOOK_SECRET')
  );
  
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    
    console.log('Payment succeeded:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status,
      charges: paymentIntent.charges.data.length,
      destination: paymentIntent.transfer_data?.destination,
    });
    
    // Update your database
    await supabase
      .from('payments')
      .update({
        status: 'succeeded',
        stripe_charge_id: paymentIntent.latest_charge,
        paid_at: new Date().toISOString(),
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);
    
    // Create transfer record (for destination charges, this is automatic)
    if (paymentIntent.transfer_data?.destination) {
      console.log('Funds will be transferred to:', paymentIntent.transfer_data.destination);
    }
  }
  
  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
```

---

## 🎯 HOW TO VERIFY PAYMENT APPEARS IN DASHBOARD

### Step 1: Check PaymentIntent Status
```bash
# Using Stripe CLI
stripe payment_intents retrieve pi_xxx

# Look for:
# - status: "succeeded" (not "requires_confirmation")
# - amount_received: should match amount
# - charges.data: should have at least one charge
```

### Step 2: Check Dashboard Filters
1. Go to Stripe Dashboard → Payments
2. Check filters:
   - ✅ "All payments" (not just "Successful")
   - ✅ Date range includes today
   - ✅ Test mode is ON (if using test keys)
   - ✅ "All sources" (not filtered by payment method)

### Step 3: Check Connect Dashboard
If using Connect:
1. Platform account: Shows destination charges
2. Connected account: Shows direct charges
3. Make sure you're viewing the correct account

### Step 4: Use Stripe CLI
```bash
# List recent PaymentIntents
stripe payment_intents list --limit 10

# Check specific PaymentIntent
stripe payment_intents retrieve pi_xxx

# Check charges
stripe charges list --limit 10

# Check transfers (for Connect)
stripe transfers list --limit 10
```

---

## 🔧 IMMEDIATE ACTION ITEMS

1. **Add destination charge parameters** to your `create-payment-intent` function:
   ```typescript
   application_fee_amount: finalPlatformFeeCents,
   transfer_data: { destination: mechanicAccount.stripe_account_id },
   ```

2. **Verify client-side confirmation** - Make sure you're calling `confirmPayment()` or `confirmCardPayment()`

3. **Add comprehensive logging** - Log every field mentioned in the "Exact Logs" section

4. **Test with Stripe CLI** - Use `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook` to see real-time events

5. **Check webhook delivery** - Go to Stripe Dashboard → Developers → Webhooks → Check if `payment_intent.succeeded` events are being sent

6. **Verify test mode** - Make sure you're using test keys (`sk_test_xxx`) and viewing test data in dashboard

---

## 📚 ADDITIONAL RESOURCES

- [Stripe Connect Destination Charges](https://stripe.com/docs/connect/destination-charges)
- [PaymentIntent Lifecycle](https://stripe.com/docs/payments/paymentintents/lifecycle)
- [SetupIntent vs PaymentIntent](https://stripe.com/docs/payments/save-and-reuse)
- [Stripe Connect Best Practices](https://stripe.com/docs/connect/best-practices)

---

## 🎓 KEY TAKEAWAYS

1. **Destination charges** are the simplest way to handle Connect payments and ensure dashboard visibility
2. **Always confirm PaymentIntents** - creating them isn't enough
3. **SetupIntents never appear in Payments** - they're only for saving cards
4. **Status matters** - only `succeeded` and `processing` show in dashboard
5. **Log everything** - you can't debug what you can't see
6. **Test mode is separate** - test payments don't mix with live payments

Your payments are likely being created but stuck in `requires_confirmation` status because the client isn't confirming them, OR they're being created on the platform account without proper Connect parameters.

Fix these issues and your payments will appear in the dashboard immediately.
