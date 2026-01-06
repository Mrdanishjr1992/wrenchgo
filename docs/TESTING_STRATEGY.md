# WrenchGo Stripe Connect Testing Strategy

## Test Environment Setup

### Stripe Test Mode
- Use test API keys: `sk_test_...` and `pk_test_...`
- Configure webhook endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
- Use Stripe CLI for local webhook testing: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`

### Test Cards
```
Success: 4242 4242 4242 4242
Requires 3DS: 4000 0025 0000 3155
Declined: 4000 0000 0000 0002
Insufficient funds: 4000 0000 0000 9995
```

---

## Unit Tests

### Edge Function: lockInvoice
```typescript
// Test: Should create locked invoice with correct calculations
// Given: Job with quote ($100 labor, $50 parts) + adjustment (+$30)
// Expected: total_cents = 18000, platform_fee_cents = 2700, mechanic_net_cents = 15300

// Test: Should reject if job not customer_verified
// Test: Should be idempotent (return existing invoice if already locked)
```

### Edge Function: createPaymentIntent
```typescript
// Test: Should reject if customer is not job owner
// Test: Should reject if invoice not locked
// Test: Should reject if mechanic not onboarded
// Test: Should return existing PaymentIntent if already created
// Test: Should include correct metadata for transfer
```

### Edge Function: stripeWebhook
```typescript
// Test: Should reject invalid signatures
// Test: Should be idempotent (duplicate event_id)
// Test: payment_intent.succeeded should update payment, invoice, job, create ledger entry
// Test: charge.refunded should update all related records and create notifications
```

### Edge Function: runWeeklyPayouts
```typescript
// Test: Should group ledger items by mechanic
// Test: Should only process items with available_for_transfer_at <= now
// Test: Should create Transfer with correct idempotency key
// Test: Should handle partial failures gracefully
```

---

## Integration Tests (Stripe Testmode)

### Test Case 1: Successful Payment Flow
```
1. Create test customer and mechanic users
2. Mechanic completes Connect onboarding (use test account)
3. Create job, quote, accept quote
4. Mechanic verifies completion
5. Customer verifies completion
6. Lock invoice
7. Create PaymentIntent
8. Simulate payment_intent.succeeded webhook
9. Verify:
   - payment.status = 'succeeded'
   - invoice.status = 'paid'
   - job.status = 'paid'
   - ledger entry created with available_for_transfer_at = next Monday
   - notifications created for both parties
```

### Test Case 2: Payment Requires 3DS
```
1. Use test card 4000 0025 0000 3155
2. Create PaymentIntent
3. Simulate payment_intent.requires_action webhook
4. Verify payment.status = 'requires_action'
5. Complete 3DS authentication
6. Simulate payment_intent.succeeded webhook
7. Verify final state matches Test Case 1
```

### Test Case 3: Payment Declined
```
1. Use test card 4000 0000 0000 0002
2. Create PaymentIntent
3. Simulate payment_intent.payment_failed webhook
4. Verify:
   - payment.status = 'failed'
   - error_message populated
   - notification sent to customer
   - invoice remains 'locked' (can retry)
```

### Test Case 4: Weekly Payout
```
1. Create 3 completed jobs for same mechanic (all paid)
2. Set available_for_transfer_at to yesterday
3. Call runWeeklyPayouts function
4. Verify:
   - Single Transfer created with sum of all 3 jobs
   - ledger items updated to 'transferred'
   - transfer record created
   - notification sent to mechanic
```

### Test Case 5: Refund
```
1. Complete successful payment (Test Case 1)
2. Issue refund via Stripe Dashboard
3. Simulate charge.refunded webhook
4. Verify:
   - payment.status = 'refunded'
   - invoice.status = 'refunded'
   - ledger.status = 'refunded'
   - notifications sent to both parties
```

### Test Case 6: Dispute
```
1. Complete successful payment
2. Create dispute via Stripe Dashboard
3. Simulate charge.dispute.created webhook
4. Verify:
   - job.status = 'disputed'
   - invoice.status = 'disputed'
   - notifications sent to both parties
```

---

## Webhook Replay Tests

### Local Testing with Stripe CLI
```bash
# Forward webhooks to local Supabase
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# Trigger specific events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
stripe trigger account.updated
```

### Idempotency Test
```
1. Capture webhook event payload
2. Send same event twice with same stripe-signature
3. Verify:
   - First request: processes successfully
   - Second request: returns 200 but skips processing (already_processed: true)
   - Database state unchanged after second request
```

---

## End-to-End Scenario Matrix

| Scenario | Mechanic Onboarded | Both Verified | Invoice Locked | Payment Status | Expected Outcome |
|----------|-------------------|---------------|----------------|----------------|------------------|
| 1 | ✓ | ✓ | ✓ | succeeded | Job paid, ledger created |
| 2 | ✗ | ✓ | ✓ | - | createPaymentIntent fails |
| 3 | ✓ | ✗ | - | - | lockInvoice fails |
| 4 | ✓ | ✓ | ✗ | - | createPaymentIntent fails |
| 5 | ✓ | ✓ | ✓ | failed | Payment failed, can retry |
| 6 | ✓ | ✓ | ✓ | refunded | All records updated |

---

## Mobile App Testing

### PaymentSheet Integration
```
1. Test successful payment
2. Test user cancels PaymentSheet
3. Test app backgrounded during payment
4. Test network interruption during payment
5. Verify PaymentProcessing screen updates via Realtime
```

### Deep Link Testing
```
1. Test return_url after Connect onboarding
2. Test refresh_url if onboarding incomplete
3. Test payment-complete deep link
```

### Realtime Subscription Testing
```
1. Complete payment in Stripe Dashboard
2. Verify app receives update within 2 seconds
3. Test subscription cleanup on unmount
4. Test reconnection after network loss
```

---

## Performance Tests

### Concurrent Payments
```
1. Create 10 jobs ready for payment
2. Initiate all 10 payments simultaneously
3. Verify all PaymentIntents created with unique idempotency keys
4. Verify all webhooks processed correctly
5. Verify no race conditions in ledger creation
```

### Large Payout Batch
```
1. Create 100 completed jobs across 20 mechanics
2. Run weekly payout
3. Verify all Transfers created
4. Verify execution time < 30 seconds
5. Verify partial failures don't block other mechanics
```

---

## Security Tests

### RLS Policy Tests
```
1. Customer A tries to pay Customer B's job → FAIL
2. Customer tries to read mechanic ledger → FAIL
3. Mechanic tries to modify locked invoice → FAIL
4. Unauthenticated user tries to create payment → FAIL
```

### Edge Function Authorization
```
1. Call createPaymentIntent without auth header → 401
2. Call with expired token → 401
3. Call with valid token but wrong user → 403
```

### Webhook Security
```
1. Send webhook without signature → 400
2. Send webhook with invalid signature → 400
3. Send webhook with valid signature but tampered payload → 400
```

---

## Monitoring & Alerts

### Key Metrics to Track
- Payment success rate (target: >95%)
- Webhook processing time (target: <2s)
- Failed transfers (alert if >5%)
- Duplicate webhook events (should be handled gracefully)

### Log Queries
```sql
-- Failed payments in last 24h
SELECT * FROM payments 
WHERE status = 'failed' 
AND created_at > NOW() - INTERVAL '24 hours';

-- Unprocessed ledger items
SELECT * FROM mechanic_ledger 
WHERE status = 'available_for_transfer' 
AND available_for_transfer_at < NOW();

-- Webhook processing errors
SELECT * FROM stripe_webhook_events 
WHERE metadata->>'error' IS NOT NULL;
```
