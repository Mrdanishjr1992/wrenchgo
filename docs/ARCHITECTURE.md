# WrenchGo Stripe Connect Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MOBILE APP (React Native + Expo)                   │
│                                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Mechanic    │  │   Customer   │  │   Payment    │  │  Processing  │   │
│  │  Onboarding  │  │  Completion  │  │    Screen    │  │    Screen    │   │
│  │   Screen     │  │   Handshake  │  │ (PaymentSheet│  │  (Realtime)  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                  │                  │                  │            │
└─────────┼──────────────────┼──────────────────┼──────────────────┼───────────┘
          │                  │                  │                  │
          │ createAccountLink│ lockInvoice      │ createPaymentIntent  │ subscribe
          │                  │                  │                  │ to payment
          ▼                  ▼                  ▼                  ▼ updates
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE EDGE FUNCTIONS (Deno)                          │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ createStripe     │  │  lockInvoice     │  │ createPayment    │          │
│  │ ConnectAccount   │  │  - Snapshot      │  │ Intent           │          │
│  │ Link             │  │    quote+adj     │  │  - Validate      │          │
│  │  - Create acct   │  │  - Calculate     │  │  - Create PI     │          │
│  │  - Return URL    │  │    fees          │  │  - Store payment │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                      │                     │
│           ▼                     ▼                      ▼                     │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    stripeWebhook (Idempotent)                    │       │
│  │  - Verify signature                                              │       │
│  │  - Check duplicate events                                        │       │
│  │  - Handle: payment_intent.*, account.updated, charge.refunded   │       │
│  │  - Update: payments, invoices, jobs, ledger, notifications       │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                   ▲                                          │
│  ┌────────────────────────────────┼──────────────────────────────┐         │
│  │              runWeeklyPayouts (Cron: Monday 9AM)               │         │
│  │  - Query ledger (available_for_transfer_at <= now)             │         │
│  │  - Group by mechanic                                            │         │
│  │  - Create Transfers with idempotency                            │         │
│  │  - Update ledger.transferred_at                                 │         │
│  └────────────────────────────────────────────────────────────────┘         │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ Stripe API calls
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STRIPE PLATFORM                                 │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  PaymentIntent   │  │  Connect Account │  │    Transfer      │          │
│  │  - Customer pays │  │  - Mechanic acct │  │  - Weekly payout │          │
│  │  - Platform rcvs │  │  - Onboarding    │  │  - To mechanic   │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                      │                     │
│           └─────────────────────┴──────────────────────┘                     │
│                                 │                                            │
│                                 │ Webhooks                                   │
│                                 ▼                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE POSTGRES + REALTIME                          │
│                                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │    jobs      │  │ job_invoices │  │   payments   │  │mechanic_ledger│  │
│  │  - status    │  │  - locked    │  │  - status    │  │  - available  │   │
│  │  - verified  │  │  - line_items│  │  - realtime  │  │  - transferred│   │
│  └──────────────┘  └──────────────┘  └──────┬───────┘  └──────────────┘   │
│                                              │                               │
│                                              │ Realtime subscription         │
│                                              ▼                               │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                      notifications                               │       │
│  │  - payment_succeeded, transfer_created, payout_completed         │       │
│  └─────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Payment Flow State Machine

```
JOB STATUS TRANSITIONS:
draft → quoted → accepted → in_progress → mechanic_verified → customer_verified → completed → paid

INVOICE STATUS:
draft → locked → paid → (refunded/disputed)

PAYMENT STATUS:
pending → processing → (requires_action) → succeeded/failed

LEDGER STATUS:
pending → available_for_transfer → transferred → paid_out
```

---

## Detailed Flow: Customer Pays After Job Completion

### Phase 1: Job Completion Handshake
```
1. Mechanic completes work
2. Mechanic taps "Mark Complete" → calls verify_job_completion('mechanic')
   - Sets mechanic_verified_at = NOW()
   - Sets job.status = 'mechanic_verified'

3. Customer inspects work
4. Customer taps "Confirm Complete" → calls verify_job_completion('customer')
   - Sets customer_verified_at = NOW()
   - Sets job.status = 'customer_verified'
   - Sets completed_at = NOW()

5. App navigates customer to invoice screen
```

### Phase 2: Invoice Locking
```
1. Customer views invoice screen
2. If invoice not locked, tap "Finalize Invoice"
3. Call Edge Function: lockInvoice(job_id)
   
   Edge Function Logic:
   - Fetch job with quotes and adjustments
   - Validate: job.status = 'customer_verified'
   - Calculate:
     * subtotal = quote.total + sum(adjustments)
     * platform_fee = subtotal * 0.15
     * mechanic_net = subtotal - platform_fee
   - Create job_invoices row:
     * status = 'locked'
     * line_items = [labor, parts, adjustments, platform_fee]
     * locked_at = NOW()
   - Update job.status = 'completed'
   - Return invoice_id

4. App displays locked invoice with line items
5. Customer taps "Proceed to Payment"
```

### Phase 3: Payment Intent Creation
```
1. Call Edge Function: createPaymentIntent(job_id)

   Edge Function Logic:
   - Validate: user = job.customer_id
   - Validate: job.status = 'completed'
   - Validate: both verified (mechanic_verified_at AND customer_verified_at)
   - Fetch locked invoice
   - Fetch mechanic Stripe account
   - Validate: mechanic.onboarding_completed = true
   
   - Create Stripe PaymentIntent:
     * amount = invoice.total_cents
     * currency = 'usd'
     * automatic_payment_methods = enabled
     * metadata = {
         job_id,
         invoice_id,
         customer_id,
         mechanic_id,
         mechanic_stripe_account_id,
         mechanic_net_cents,
         platform_fee_cents
       }
     * idempotency_key = "payment_{job_id}_{timestamp}"
   
   - Insert payments row:
     * stripe_payment_intent_id = pi.id
     * status = 'pending'
     * client_secret = pi.client_secret
   
   - Return { client_secret, payment_id }

2. App receives client_secret
```

### Phase 4: PaymentSheet Presentation
```
1. App calls Stripe SDK:
   initPaymentSheet({
     paymentIntentClientSecret: client_secret,
     merchantDisplayName: 'WrenchGo',
     returnURL: 'wrenchgo://payment-complete'
   })

2. App calls presentPaymentSheet()
3. User enters payment details (or uses saved card)
4. Stripe processes payment (may require 3DS)
5. PaymentSheet returns success/failure
6. App navigates to PaymentProcessing screen
```

### Phase 5: Payment Processing (Realtime)
```
1. PaymentProcessing screen subscribes to payment row:
   supabase
     .channel(`payment:${paymentId}`)
     .on('postgres_changes', { table: 'payments', filter: `id=eq.${paymentId}` })
     .subscribe()

2. Stripe sends webhook: payment_intent.succeeded
3. Webhook handler:
   - Verify signature
   - Check idempotency (stripe_webhook_events table)
   - Update payments.status = 'succeeded'
   - Update job_invoices.status = 'paid'
   - Update jobs.status = 'paid', paid_at = NOW()
   - Insert mechanic_ledger row:
     * amount_cents = mechanic_net_cents
     * status = 'available_for_transfer'
     * available_for_transfer_at = next Monday
   - Insert notifications (customer + mechanic)

4. Realtime pushes update to app
5. App detects payment.status = 'succeeded'
6. App navigates to PaymentSuccess screen
```

### Phase 6: Weekly Payout (Automated)
```
1. Cron job triggers every Monday 9 AM UTC
2. Call Edge Function: runWeeklyPayouts()

   Edge Function Logic:
   - Query mechanic_ledger:
     * status = 'available_for_transfer'
     * available_for_transfer_at <= NOW()
   - Group by mechanic_id
   - For each mechanic:
     * Sum amount_cents
     * Create Stripe Transfer:
       - amount = sum
       - destination = mechanic_stripe_account_id
       - idempotency_key = "transfer_{mechanic_id}_{date}"
     * Insert transfers row
     * Update ledger items:
       - status = 'transferred'
       - stripe_transfer_id = transfer.id
       - transferred_at = NOW()
     * Insert notification (mechanic)

3. Stripe processes transfers (usually instant)
4. Stripe sends webhook: transfer.created
5. Webhook updates transfers.status = 'succeeded'

6. Stripe initiates payout to mechanic's bank (2-3 days)
7. Stripe sends webhook: payout.paid
8. Webhook updates ledger:
   - status = 'paid_out'
   - stripe_payout_id = payout.id
   - paid_out_at = payout.arrival_date
9. Insert notification (mechanic)
```

---

## Error Handling & Edge Cases

### User Closes App Mid-Payment
- PaymentSheet handles payment completion independently
- Webhook updates database regardless of app state
- When user reopens app, Realtime subscription reconnects
- App queries payment status and shows appropriate screen

### Duplicate Webhook Delivery
- Check stripe_webhook_events table for event_id
- If exists, return 200 immediately (idempotent)
- If not exists, process and insert event_id

### Payment Requires 3DS
- Webhook: payment_intent.requires_action
- Update payment.status = 'requires_action'
- PaymentSheet automatically handles 3DS flow
- After completion, webhook: payment_intent.succeeded

### Mechanic Not Onboarded
- createPaymentIntent validates mechanic.onboarding_completed
- Returns error if false
- App shows error: "Mechanic must complete onboarding first"

### Transfer Fails
- Webhook: transfer.failed
- Update transfers.status = 'failed'
- Update ledger items back to 'available_for_transfer'
- Next weekly run will retry

### Refund Issued
- Admin issues refund via Stripe Dashboard
- Webhook: charge.refunded
- Update payment.status = 'refunded'
- Update invoice.status = 'refunded'
- Update ledger.status = 'refunded'
- Insert notifications (both parties)

### Dispute Created
- Webhook: charge.dispute.created
- Update job.status = 'disputed'
- Update invoice.status = 'disputed'
- Insert notifications (both parties)
- Support team gathers evidence

---

## Security Considerations

### RLS Policies
- Customers can only pay their own jobs
- Mechanics can only view their own ledger
- Service role bypasses RLS for webhooks

### Idempotency
- All Stripe API calls use idempotency keys
- Webhook events tracked in stripe_webhook_events
- Payment creation uses job_id in idempotency key

### Secrets Management
- All Stripe secret keys in Supabase secrets
- Never expose secret keys in app
- Webhook signing secret verified on every request

### Amount Validation
- Invoice locked before payment (immutable)
- PaymentIntent amount matches invoice.total_cents
- No client-side amount manipulation possible

---

## Monitoring & Alerts

### Critical Alerts
- Payment failure rate > 10% (5-minute window)
- Webhook processing errors
- Failed transfers
- Database connection errors

### Metrics to Track
- Total payment volume (GMV)
- Payment success rate
- Average payment amount
- Webhook processing time
- Ledger items pending transfer

### Log Queries
```sql
-- Failed payments today
SELECT * FROM payments WHERE status = 'failed' AND created_at > CURRENT_DATE;

-- Pending transfers
SELECT mechanic_id, SUM(amount_cents) FROM mechanic_ledger 
WHERE status = 'available_for_transfer' GROUP BY mechanic_id;

-- Webhook errors
SELECT * FROM stripe_webhook_events WHERE metadata->>'error' IS NOT NULL;
```

---

## Implementation Timeline

### Week 1: Database & Core Functions
- [ ] Run schema migration
- [ ] Deploy lockInvoice function
- [ ] Deploy createPaymentIntent function
- [ ] Test with Stripe testmode

### Week 2: Webhook & Realtime
- [ ] Deploy stripeWebhook function
- [ ] Configure webhook endpoint in Stripe
- [ ] Test webhook idempotency
- [ ] Enable Realtime on payments table

### Week 3: Mobile App Integration
- [ ] Build completion handshake screens
- [ ] Build invoice screen
- [ ] Integrate PaymentSheet
- [ ] Build PaymentProcessing screen with Realtime

### Week 4: Payouts & Testing
- [ ] Deploy runWeeklyPayouts function
- [ ] Set up cron job
- [ ] End-to-end testing
- [ ] Security audit

### Week 5: Production Deployment
- [ ] Switch to live Stripe keys
- [ ] Configure production webhooks
- [ ] Deploy to app stores
- [ ] Monitor first week closely
