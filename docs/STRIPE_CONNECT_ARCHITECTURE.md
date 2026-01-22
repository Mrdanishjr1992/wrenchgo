# WrenchGo Stripe Connect Architecture

## Executive Summary

WrenchGo uses **Stripe Connect with Destination Charges** to process payments from customers to mechanics, with the platform collecting a fee.

---

## 1. Stripe Connect Model Decision

### We Use: **Destination Charges**

| Factor | Destination Charges ✅ | Direct Charges ❌ |
|--------|----------------------|------------------|
| **Dashboard Visibility** | Payments visible in YOUR dashboard | Payments only in connected account |
| **Fee Collection** | Automatic via `transfer_data.amount` | Manual via `application_fee_amount` |
| **Refunds** | Platform handles | Connected account handles |
| **Disputes** | Platform handles | Connected account handles |
| **Complexity** | Simple - no `stripeAccount` header | Complex - must pass header everywhere |
| **Customer Relationship** | Platform owns customer | Connected account owns customer |

### Why Destination Charges for WrenchGo:

1. **Platform owns the customer relationship** - Customers pay WrenchGo, not individual mechanics
2. **Centralized refund/dispute handling** - We handle all customer service
3. **Dashboard visibility** - All payments visible in our Stripe dashboard
4. **Simpler implementation** - No `stripeAccount` header management
5. **Automatic transfers** - Stripe handles mechanic payouts

---

## 2. Payment Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Customer completes job verification                                      │
│                    │                                                         │
│                    ▼                                                         │
│  2. Client calls create-payment-intent Edge Function                         │
│                    │                                                         │
│                    ▼                                                         │
│  3. Server creates PaymentIntent with:                                       │
│     • amount: $100 (total)                                                   │
│     • transfer_data.destination: acct_mechanic123                            │
│     • transfer_data.amount: $85 (mechanic gets)                              │
│     • Platform keeps: $15 (implicit)                                         │
│                    │                                                         │
│                    ▼                                                         │
│  4. Server returns client_secret to app                                      │
│                    │                                                         │
│                    ▼                                                         │
│  5. Client presents PaymentSheet                                             │
│     • Customer enters card / selects saved card                              │
│     • 3DS handled automatically if needed                                    │
│                    │                                                         │
│                    ▼                                                         │
│  6. Stripe processes payment                                                 │
│     • Charges customer $100                                                  │
│     • Creates automatic transfer of $85 to mechanic                          │
│     • Platform balance increases by $15                                      │
│                    │                                                         │
│                    ▼                                                         │
│  7. Webhook: payment_intent.succeeded                                        │
│     • Update payment status → 'succeeded'                                    │
│     • Update job status → 'paid'                                             │
│     • Create mechanic_ledger entry                                           │
│     • Send notifications                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Critical Code: PaymentIntent Creation

```typescript
// supabase/functions/create-payment-intent/index.ts

const paymentIntent = await stripe.paymentIntents.create({
  amount: totalCents,           // Customer pays this
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  
  // ⚠️ CRITICAL: This makes it a destination charge
  transfer_data: {
    destination: mechanicStripeAccountId,  // acct_xxx
    amount: mechanicNetCents,              // Mechanic receives this
  },
  
  metadata: {
    job_id,
    payment_id,
    mechanic_id,
    mechanic_stripe_account_id: mechanicStripeAccountId,
    // ... other metadata for debugging
  },
}, { idempotencyKey: `pi_${paymentId}` });
```

### What This Does:

1. **Customer charged**: `amount` ($100)
2. **Mechanic receives**: `transfer_data.amount` ($85)
3. **Platform keeps**: `amount - transfer_data.amount` ($15)
4. **Visible in**: Platform's Stripe Dashboard → Payments
5. **Transfer visible in**: Mechanic's Connected Account → Transfers

---

## 4. Client-Side Payment Confirmation

```typescript
// app/(app)/jobs/[jobId]/payment.tsx

import { useStripe } from '@stripe/stripe-react-native';

const { initPaymentSheet, presentPaymentSheet } = useStripe();

// 1. Get client_secret from server
const response = await fetch('/functions/v1/create-payment-intent', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ job_id: jobId }),
});
const { client_secret } = await response.json();

// 2. Initialize PaymentSheet
await initPaymentSheet({
  paymentIntentClientSecret: client_secret,
  merchantDisplayName: 'WrenchGo',
  returnURL: 'wrenchgo://payment-complete',
});

// 3. Present PaymentSheet (handles card input + 3DS)
const { error } = await presentPaymentSheet();

if (error) {
  // Handle error or cancellation
} else {
  // Payment submitted - wait for webhook confirmation
  // Navigate to processing screen
}
```

### Important Notes:

- **Never trust client success** - The `presentPaymentSheet()` success only means the payment was submitted
- **Webhook is source of truth** - Only update DB status from `payment_intent.succeeded` webhook
- **3DS handled automatically** - PaymentSheet handles authentication challenges

---

## 5. Webhook Handler (Source of Truth)

```typescript
// supabase/functions/stripe-webhook/index.ts

case 'payment_intent.succeeded':
  // 1. Find payment record
  const payment = await db.payments.findByStripePI(paymentIntent.id);
  
  // 2. Update payment status
  await db.payments.update(payment.id, {
    status: 'succeeded',
    stripe_charge_id: paymentIntent.latest_charge,
  });
  
  // 3. Update job status
  await db.jobs.update(payment.job_id, { status: 'paid' });
  
  // 4. Create ledger entry for mechanic
  await db.mechanic_ledger.insert({
    mechanic_id: payment.mechanic_id,
    amount_cents: mechanicNetCents,
    status: 'transferred', // Destination charges transfer immediately
  });
  
  // 5. Send notifications
  await sendNotifications(payment);
```

### Required Webhook Events:

| Event | Purpose |
|-------|---------|
| `payment_intent.succeeded` | Payment complete - update all statuses |
| `payment_intent.payment_failed` | Payment failed - notify customer |
| `payment_intent.requires_action` | 3DS needed - client handles |
| `payment_intent.canceled` | Payment canceled |
| `charge.refunded` | Refund processed |
| `charge.dispute.created` | Dispute filed |
| `account.updated` | Mechanic account status changed |
| `transfer.created` | Mechanic transfer confirmed |

---

## 6. Database Schema

```sql
-- payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  invoice_id UUID REFERENCES job_invoices(id),
  customer_id UUID REFERENCES profiles(id),
  mechanic_id UUID REFERENCES profiles(id),
  
  -- Stripe IDs
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  
  -- Amounts
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  
  -- Status (updated ONLY by webhooks)
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending → processing → requires_action → succeeded/failed/cancelled
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  
  -- Debugging
  metadata JSONB,
  error_message TEXT
);

-- mechanic_ledger table
CREATE TABLE mechanic_ledger (
  id UUID PRIMARY KEY,
  mechanic_id UUID REFERENCES profiles(id),
  payment_id UUID REFERENCES payments(id),
  job_id UUID REFERENCES jobs(id),
  stripe_account_id TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  -- transferred → paid_out
  transferred_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ
);
```

---

## 7. Debugging Checklist

### Payment Not Appearing in Dashboard?

1. **Check PaymentIntent status**:
   ```bash
   stripe payment_intents retrieve pi_xxx
   ```
   - `requires_payment_method` → Client never confirmed
   - `requires_confirmation` → Server created but client didn't present
   - `requires_action` → 3DS pending
   - `succeeded` → Should be visible!

2. **Check transfer_data was set**:
   ```bash
   stripe payment_intents retrieve pi_xxx --expand transfer_data
   ```
   - If `transfer_data` is null → Not a destination charge!

3. **Check webhook received**:
   ```sql
   SELECT * FROM stripe_webhook_events 
   WHERE stripe_event_id LIKE '%pi_xxx%';
   ```

4. **Check Edge Function logs**:
   ```bash
   supabase functions logs create-payment-intent
   ```
   Look for: `[PI] PaymentIntent created: pi_xxx`

### Mechanic Not Receiving Money?

1. **Check mechanic account status**:
   ```sql
   SELECT * FROM mechanic_stripe_accounts 
   WHERE mechanic_id = 'xxx';
   ```
   - `charges_enabled` must be `true`
   - `payouts_enabled` must be `true`

2. **Check transfer in Stripe**:
   ```bash
   stripe transfers list --destination=acct_xxx
   ```

3. **Check ledger entry**:
   ```sql
   SELECT * FROM mechanic_ledger 
   WHERE payment_id = 'xxx';
   ```

---

## 8. Anti-Patterns to Avoid

### ❌ NEVER DO THIS:

```typescript
// 1. Creating PaymentIntent without transfer_data
const pi = await stripe.paymentIntents.create({
  amount: 10000,
  currency: 'usd',
  // Missing transfer_data! Money stays in platform, no mechanic payment
});

// 2. Using stripeAccount header (that's for direct charges)
const pi = await stripe.paymentIntents.create(
  { amount: 10000 },
  { stripeAccount: 'acct_xxx' }  // WRONG for destination charges
);

// 3. Trusting client success
const { error } = await presentPaymentSheet();
if (!error) {
  await updatePaymentStatus('succeeded');  // WRONG! Use webhook
}

// 4. Storing Stripe account ID only in metadata
// Always store in database column for querying

// 5. Not using idempotency keys
const pi = await stripe.paymentIntents.create({ ... });  // No idempotency!

// 6. Mixing SetupIntent and PaymentIntent
// SetupIntent = save card (no charge)
// PaymentIntent = charge card
```

### ✅ ALWAYS DO THIS:

```typescript
// 1. Use destination charges with transfer_data
const pi = await stripe.paymentIntents.create({
  amount: totalCents,
  transfer_data: {
    destination: mechanicAccountId,
    amount: mechanicNetCents,
  },
});

// 2. Use idempotency keys
const pi = await stripe.paymentIntents.create(
  { ... },
  { idempotencyKey: `pi_${paymentId}` }
);

// 3. Update status ONLY from webhooks
// payment_intent.succeeded → status = 'succeeded'

// 4. Store all IDs in database columns
await db.payments.update({
  stripe_payment_intent_id: pi.id,
  stripe_charge_id: pi.latest_charge,
});

// 5. Log everything for debugging
console.log(`[PI] Created: ${pi.id}, status=${pi.status}, amount=${pi.amount}`);
```

---

## 9. Testing Checklist

Before going live, verify:

- [ ] Payment appears in Stripe Dashboard → Payments
- [ ] Transfer appears in mechanic's connected account
- [ ] `payment_intent.succeeded` webhook fires
- [ ] Database `payments.status` = 'succeeded'
- [ ] Database `jobs.status` = 'paid'
- [ ] `mechanic_ledger` entry created
- [ ] Notifications sent to customer and mechanic
- [ ] Refund works and updates all statuses
- [ ] 3DS cards work (use `4000002500003155`)

### Test Cards:

| Card | Behavior |
|------|----------|
| `4242424242424242` | Success |
| `4000002500003155` | Requires 3DS |
| `4000000000000002` | Declined |
| `4000000000009995` | Insufficient funds |

---

## 10. Production Checklist

- [ ] `STRIPE_SECRET_KEY` is live key (not test)
- [ ] `STRIPE_WEBHOOK_SECRET` is for live endpoint
- [ ] Webhook endpoint registered in Stripe Dashboard
- [ ] All required events enabled in webhook
- [ ] Error alerting configured
- [ ] Idempotency keys prevent duplicate charges
- [ ] Mechanic accounts verified (`charges_enabled: true`)
