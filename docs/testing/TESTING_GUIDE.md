# 🧪 Testing Your Payment System - Complete Guide

## ✅ What's Been Completed

- ✅ Database migration applied (payments, promotions, mechanic_stripe_accounts)
- ✅ Edge Functions deployed (create-payment-intent, stripe-webhook, validate-promotion, stripe-connect-create-account-link)
- ✅ Stripe webhook configured
- ✅ Stripe SDK installed and configured
- ✅ Payment flow integrated into job acceptance
- ✅ Payment screens created and connected

---

## 🎯 Step 1: Add Test Promotions

Run this in Supabase SQL Editor:

1. Go to: https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/editor
2. Open `TEST_PROMOTIONS.sql` (in your project root)
3. Copy all contents
4. Paste into SQL Editor
5. Click "Run"

This creates 3 test promotions:
- **WELCOME10** - 10% off first service
- **SAVE20** - $20 off orders over $100
- **NOFEE** - Waives the $15 platform fee

---

## 🧪 Step 2: Test the Complete Flow

### A. Test as Mechanic (Stripe Onboarding)

1. **Open your app as a mechanic user**

2. **Navigate to Stripe onboarding:**
   - Go to Profile screen
   - Add a button to navigate to onboarding (if not already there):
   ```typescript
   router.push('/(mechanic)/stripe-onboarding');
   ```

3. **Complete Stripe onboarding:**
   - Click "Start Setup"
   - Use Stripe test data:
     - Business type: Individual
     - First name: Test
     - Last name: Mechanic
     - DOB: 01/01/1990
     - SSN: 000-00-0000 (test SSN)
     - Address: Any US address
     - Bank account: Use test routing number `110000000` and any account number

4. **Verify onboarding:**
   - Check `mechanic_stripe_accounts` table in Supabase
   - Should see `charges_enabled: true` and `payouts_enabled: true`

---

### B. Test as Customer (Full Payment Flow)

#### Step 1: Create a Test Job

1. **Sign in as a customer**
2. **Create a new job request:**
   - Select a vehicle
   - Choose a service (e.g., "Oil Change")
   - Submit the job

#### Step 2: Mechanic Sends Quote

1. **Switch to mechanic account**
2. **Find the job in "Available Jobs"**
3. **Send a quote:**
   - Price: $150 (or any amount)
   - Availability: "Tomorrow 2PM"
   - Add a note
   - Submit quote

#### Step 3: Customer Accepts Quote & Pays

1. **Switch back to customer account**
2. **Go to the job details**
3. **You'll see the quote from the mechanic**
4. **Click "ACCEPT QUOTE"**
5. **You'll be automatically taken to the payment screen**

#### Step 4: Complete Payment

On the payment screen:

1. **Review the breakdown:**
   - Service Amount: $150.00
   - Platform Fee: $15.00
   - **Total: $165.00**

2. **Test with a promo code (optional):**
   - Enter: `NOFEE`
   - Click "Apply"
   - Total should drop to $150.00 (fee waived)

3. **Enter Stripe test card:**
   - Card number: `4242 4242 4242 4242`
   - Expiry: `12/34` (any future date)
   - CVC: `123` (any 3 digits)
   - ZIP: `12345` (any 5 digits)

4. **Click "Pay Now"**

5. **Wait for confirmation:**
   - Should see "Payment Successful!" alert
   - Click "View Job"

#### Step 5: Verify Payment

1. **Check Supabase `payments` table:**
   - Should see a new payment record
   - Status: `paid`
   - All amounts calculated correctly

2. **Check Supabase `jobs` table:**
   - Job status should be `in_progress`

3. **Check Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/test/payments
   - Should see the payment
   - Should see the transfer to mechanic's connected account

4. **Check `promotion_redemptions` table (if you used a promo):**
   - Should see the redemption record

---

## 🧪 Step 3: Test Promotion Codes

### Test WELCOME10 (10% off)

1. Create a job with quote amount $100
2. Accept quote
3. On payment screen, enter: `WELCOME10`
4. Click "Apply"
5. **Expected:**
   - Service: $100.00
   - Platform Fee: $15.00
   - Discount: -$11.50 (10% of $115)
   - **Total: $103.50**

### Test SAVE20 ($20 off)

1. Create a job with quote amount $150
2. Accept quote
3. On payment screen, enter: `SAVE20`
4. Click "Apply"
5. **Expected:**
   - Service: $150.00
   - Platform Fee: $15.00
   - Discount: -$20.00
   - **Total: $145.00**

### Test NOFEE (waive platform fee)

1. Create any job
2. Accept quote
3. On payment screen, enter: `NOFEE`
4. Click "Apply"
5. **Expected:**
   - Service: $X.00
   - Platform Fee: $15.00
   - Discount: -$15.00
   - **Total: $X.00** (just the service amount)

---

## 🧪 Step 4: Test Mechanic Earnings View

1. **Sign in as the mechanic who received payment**
2. **Navigate to earnings screen:**
   ```typescript
   router.push(`/(mechanic)/earnings/${jobId}`);
   ```
3. **You should see:**
   - Payment status: PAID
   - Job Amount: $150.00
   - Platform Commission: $18.00 (12% of $150, max $50)
   - **Net Payout: $132.00**
   - Stripe Payment Intent ID
   - Payment method: card
   - Created date

---

## 🧪 Step 5: Test Webhook Events

### Test Payment Success Webhook

1. **Go to Stripe Dashboard:**
   - https://dashboard.stripe.com/test/webhooks
2. **Click on your webhook**
3. **Click "Send test webhook"**
4. **Select event:** `payment_intent.succeeded`
5. **Click "Send test webhook"**
6. **Check webhook logs:**
   - Should show 200 response
   - Check Supabase function logs for any errors

### Test Payment Failed Webhook

1. **Use a test card that fails:**
   - Card: `4000 0000 0000 0002` (card declined)
2. **Try to complete payment**
3. **Payment should fail**
4. **Check `payments` table:**
   - Status should be `failed`

---

## 🧪 Step 6: Test Edge Cases

### Test: Mechanic Without Stripe Account

1. **Create a mechanic account that hasn't completed Stripe onboarding**
2. **Have them send a quote**
3. **Customer accepts quote**
4. **Try to pay**
5. **Expected:** Error: "Mechanic has not completed Stripe onboarding"

### Test: Duplicate Payment

1. **Complete a payment successfully**
2. **Try to navigate back to payment screen for same job**
3. **Try to pay again**
4. **Expected:** Error: "Payment already exists for this job"

### Test: Invalid Promo Code

1. **On payment screen, enter:** `INVALID123`
2. **Click "Apply"**
3. **Expected:** Error message: "Invalid or expired promotion code"

### Test: Promo Code Already Used

1. **Use `WELCOME10` (max 1 redemption per user)**
2. **Complete payment**
3. **Create another job**
4. **Try to use `WELCOME10` again**
5. **Expected:** Error: "You've already used this promotion"

---

## ✅ Verification Checklist

After testing, verify:

- [ ] Mechanic can complete Stripe onboarding
- [ ] Customer can accept quote and is taken to payment screen
- [ ] Payment breakdown shows correct amounts
- [ ] Promo codes apply discounts correctly
- [ ] Stripe test card payment succeeds
- [ ] Payment record created in `payments` table with status `paid`
- [ ] Job status updates to `in_progress` after payment
- [ ] Mechanic can view earnings breakdown
- [ ] Stripe Dashboard shows payment and transfer
- [ ] Webhook events are received and processed
- [ ] Edge cases handled gracefully (no Stripe account, duplicate payment, invalid promo)

---

## 🐛 Troubleshooting

### Payment screen shows "No accepted quote found"

**Fix:** Make sure the quote status is `accepted` in the `quote_requests` table.

```sql
SELECT id, job_id, status FROM quote_requests WHERE job_id = 'YOUR_JOB_ID';
```

### "Mechanic has not completed Stripe onboarding"

**Fix:** Complete Stripe onboarding for the mechanic:
1. Sign in as mechanic
2. Go to `/(mechanic)/stripe-onboarding`
3. Complete the onboarding flow

### Payment fails with "Invalid payment intent"

**Fix:** Check Edge Function logs:
1. Go to Supabase Dashboard → Edge Functions
2. Click on `create-payment-intent`
3. Check logs for errors
4. Verify `STRIPE_SECRET_KEY` is set correctly

### Promo code doesn't apply

**Fix:** Check promotions table:
```sql
SELECT * FROM promotions WHERE code = 'YOUR_CODE';
```
- Verify `active = true`
- Check `start_date` and `end_date`
- Check `max_redemptions` hasn't been reached

### Webhook not receiving events

**Fix:**
1. Verify webhook URL in Stripe Dashboard
2. Check webhook signing secret is set in Supabase
3. Test webhook in Stripe Dashboard
4. Check Edge Function logs for errors

---

## 📊 Monitoring

### Check Payment Status

```sql
SELECT 
  p.id,
  p.job_id,
  p.status,
  p.customer_total_cents / 100.0 as total_dollars,
  p.mechanic_payout_cents / 100.0 as payout_dollars,
  p.created_at
FROM payments p
ORDER BY p.created_at DESC
LIMIT 10;
```

### Check Promotion Usage

```sql
SELECT 
  p.code,
  p.type,
  p.current_redemptions,
  p.max_redemptions,
  p.active
FROM promotions p
ORDER BY p.current_redemptions DESC;
```

### Check Mechanic Stripe Accounts

```sql
SELECT 
  m.mechanic_id,
  m.stripe_account_id,
  m.charges_enabled,
  m.payouts_enabled,
  m.status
FROM mechanic_stripe_accounts m;
```

---

## 🚀 Next Steps

After successful testing:

1. **Add navigation buttons:**
   - Add "View Earnings" button in mechanic job details
   - Add "Set Up Payments" button in mechanic profile

2. **Add payment status indicators:**
   - Show payment status in job details
   - Show "Payment Required" badge for accepted quotes

3. **Add notifications:**
   - Notify mechanic when payment is received
   - Notify customer when payment succeeds/fails

4. **Production setup:**
   - Switch to live Stripe keys
   - Update webhook URL to production
   - Test with real bank account (small amount)
   - Set up Stripe Connect payout schedule

5. **Analytics:**
   - Track payment success rate
   - Monitor promotion usage
   - Track mechanic earnings

---

## 🎉 Success!

If all tests pass, your payment system is fully operational! 🚀

**What you've built:**
- ✅ Complete Stripe Connect integration
- ✅ Secure payment processing
- ✅ Promotion code system
- ✅ Fee calculation and breakdown
- ✅ Mechanic payout system
- ✅ Webhook handling
- ✅ Beautiful payment UI

**You can now:**
- Accept payments from customers
- Apply promotional discounts
- Transfer funds to mechanics
- Track all transactions
- Handle refunds and disputes

---

## 📚 Additional Resources

- **Stripe Test Cards:** https://stripe.com/docs/testing
- **Stripe Connect Docs:** https://stripe.com/docs/connect
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Your Documentation:**
  - `PAYMENTS_DOCUMENTATION.md` - Complete system docs
  - `PAYMENTS_QUICK_SETUP.md` - Setup guide
  - `PAYMENTS_CHECKLIST.md` - Deployment checklist
  - `DASHBOARD_DEPLOYMENT_GUIDE.md` - Function deployment guide

---

## 🆘 Need Help?

If you encounter issues:
1. Check Edge Function logs in Supabase Dashboard
2. Check Stripe Dashboard for payment/webhook events
3. Verify all secrets are set correctly
4. Test with curl to isolate issues
5. Check database tables for data consistency

Good luck! 🎉
