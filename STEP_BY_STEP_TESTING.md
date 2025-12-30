# 🧪 Step-by-Step Testing Guide

## ✅ Prerequisites Complete
- ✅ Database migration applied
- ✅ Test promotions added
- ✅ Edge Functions deployed
- ✅ Code errors fixed

---

## 📋 STEP 1: Test Mechanic Stripe Onboarding

### What You'll Do:
Set up a mechanic account to receive payments via Stripe Connect.

### Steps:

1. **Start your app:**
   ```bash
   npx expo start
   ```

2. **Login as a mechanic:**
   - Open the app on your device/simulator
   - Sign in with a mechanic account
   - (If you don't have one, create a new account and set `user_type = 'mechanic'` in the `profiles` table)

3. **Navigate to Stripe Onboarding:**
   - Go to: `/(mechanic)/stripe-onboarding`
   - Or add a button in your mechanic dashboard that navigates there

4. **Click "Start Stripe Onboarding":**
   - This will call the Edge Function to create a Stripe Connect account
   - You'll get an onboarding URL

5. **Complete Stripe Onboarding:**
   - Click "Continue to Stripe"
   - This opens Stripe's onboarding form
   - **Use test data:**
     - Business type: Individual
     - First name: Test
     - Last name: Mechanic
     - Email: test@example.com
     - Phone: 000-000-0000
     - DOB: 01/01/1990
     - SSN: 000-00-0000 (test mode)
     - Address: 123 Test St, Test City, CA, 12345
     - Bank account: Use test routing number `110000000` and account `000123456789`

6. **Verify Success:**
   - After completing onboarding, you'll be redirected back to the app
   - The screen should show:
     - ✅ Charges Enabled: Yes
     - ✅ Payouts Enabled: Yes
     - ✅ Details Submitted: Yes
   - Check `mechanic_stripe_accounts` table in Supabase:
     ```sql
     SELECT * FROM mechanic_stripe_accounts;
     ```
   - Status should be `active`

---

## 📋 STEP 2: Create a Job and Get a Quote

### What You'll Do:
Create a job as a customer and have the mechanic send a quote.

### Steps:

1. **Switch to customer account:**
   - Logout from mechanic account
   - Login as a customer (or create a new customer account)

2. **Create a new job:**
   - Navigate to create job screen
   - Fill in job details:
     - Title: "Oil Change"
     - Description: "Need an oil change for my 2020 Honda Civic"
     - Location: Any address
   - Submit the job

3. **Switch back to mechanic account:**
   - Logout and login as the mechanic

4. **View the job:**
   - Go to available jobs list
   - Find the "Oil Change" job
   - Click to view details

5. **Send a quote:**
   - Click "Send Quote" or similar button
   - Enter quote amount: **$150.00** (15000 cents)
   - Add any notes
   - Submit the quote

6. **Verify quote was sent:**
   - Check `quote_requests` table:
     ```sql
     SELECT * FROM quote_requests WHERE job_id = 'YOUR_JOB_ID';
     ```
   - Status should be `pending`

---

## 📋 STEP 3: Accept Quote and Navigate to Payment

### What You'll Do:
Accept the mechanic's quote, which will automatically navigate to the payment screen.

### Steps:

1. **Switch back to customer account:**
   - Logout and login as customer

2. **View the job:**
   - Go to "My Jobs" or jobs list
   - Find the "Oil Change" job
   - Click to view details

3. **Accept the quote:**
   - You should see the mechanic's quote: $150.00
   - Click "Accept Quote" button
   - **You'll automatically navigate to the payment screen!**

4. **Verify navigation:**
   - You should now be on: `/(customer)/payment/[jobId]`
   - The screen should show:
     - Service Amount: $150.00
     - Platform Fee: $15.00
     - Total: $165.00

5. **Verify database:**
   - Check `quote_requests` table:
     ```sql
     SELECT * FROM quote_requests WHERE job_id = 'YOUR_JOB_ID';
     ```
   - Status should be `accepted`

---

## 📋 STEP 4: Test Promotion Code

### What You'll Do:
Apply a promotion code to get a discount.

### Steps:

1. **On the payment screen:**
   - Find the "Promo Code" input field
   - Enter: `NOFEE`
   - Click "Apply"

2. **Verify discount applied:**
   - The breakdown should update:
     - Service Amount: $150.00
     - Platform Fee: $15.00
     - Discount: -$15.00
     - **Total: $150.00** (fee waived!)

3. **Try other promo codes:**
   - Remove `NOFEE` and try `WELCOME10`:
     - Service Amount: $150.00
     - Platform Fee: $15.00
     - Discount: -$16.50 (10% off $165)
     - **Total: $148.50**
   
   - Try `SAVE20`:
     - Service Amount: $150.00
     - Platform Fee: $15.00
     - Discount: -$20.00
     - **Total: $145.00**

4. **For final test, use `NOFEE` to keep it simple**

---

## 📋 STEP 5: Complete Payment

### What You'll Do:
Enter card details and complete the payment.

### Steps:

1. **Enter card details:**
   - Card Number: `4242 4242 4242 4242`
   - Expiry: `12/34` (any future date)
   - CVC: `123` (any 3 digits)
   - ZIP: `12345` (any 5 digits)

2. **Click "Pay Now":**
   - The button should show a loading spinner
   - Wait for the payment to process (5-10 seconds)

3. **Verify success:**
   - You should see a success message
   - You'll be redirected back to the job details screen
   - Job status should update to "In Progress"

4. **Check database:**
   ```sql
   -- Check payment record
   SELECT * FROM payments WHERE job_id = 'YOUR_JOB_ID';
   ```
   - Status should be `paid`
   - `customer_total_cents` should be `15000` (if using NOFEE)
   - `mechanic_payout_cents` should be `13200` ($150 - 12% commission)
   - `platform_revenue_cents` should be `1800` ($18 commission)

   ```sql
   -- Check job status
   SELECT status FROM jobs WHERE id = 'YOUR_JOB_ID';
   ```
   - Status should be `in_progress`

   ```sql
   -- Check promotion redemption
   SELECT * FROM promotion_redemptions WHERE job_id = 'YOUR_JOB_ID';
   ```
   - Should have a record with `discount_amount_cents = 1500`

5. **Check Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/test/payments
   - You should see the payment for $150.00
   - Click on it to see details
   - Should show transfer to mechanic's connected account

---

## 📋 STEP 6: View Mechanic Earnings

### What You'll Do:
Check the mechanic's earnings breakdown for this job.

### Steps:

1. **Switch to mechanic account:**
   - Logout and login as mechanic

2. **Navigate to earnings screen:**
   - Go to: `/(mechanic)/earnings/[jobId]`
   - Or add a "View Earnings" button in the job details

3. **Verify earnings breakdown:**
   - Service Amount: $150.00
   - Platform Commission: $18.00 (12%)
   - **Your Payout: $132.00**

4. **Check Stripe Dashboard (Mechanic's Connected Account):**
   - The mechanic should see the $132.00 transfer in their Stripe account
   - (In test mode, you can view this in your main Stripe dashboard under "Connect" → "Accounts")

---

## ✅ Success Checklist

After completing all steps, verify:

- ✅ Mechanic completed Stripe onboarding
- ✅ Customer created a job
- ✅ Mechanic sent a quote
- ✅ Customer accepted quote → Auto-navigated to payment
- ✅ Promotion code applied successfully
- ✅ Payment completed with test card
- ✅ `payments` table has record with status `paid`
- ✅ `jobs` table updated to `in_progress`
- ✅ `promotion_redemptions` table has redemption record
- ✅ Payment appears in Stripe Dashboard
- ✅ Mechanic can view earnings breakdown

---

## 🐛 Troubleshooting

### Issue: "Mechanic has not completed Stripe onboarding"
**Solution:** Complete Step 1 first

### Issue: Payment screen shows "No accepted quote found"
**Solution:** Make sure you accepted the quote in Step 3

### Issue: Promo code doesn't apply
**Solution:** Check that promotion is active in `promotions` table

### Issue: Payment fails
**Solution:** 
- Check Edge Function logs in Supabase
- Verify `STRIPE_SECRET_KEY` is set in Edge Function secrets
- Make sure mechanic has `charges_enabled = true`

### Issue: Webhook not updating payment status
**Solution:**
- Check webhook is configured in Stripe Dashboard
- Verify `STRIPE_WEBHOOK_SECRET` is set
- Check Edge Function logs for errors

---

## 🎯 Next Steps After Testing

Once all tests pass:

1. ✅ Add "View Earnings" button in mechanic job details
2. ✅ Add payment status indicators in job lists
3. ✅ Add push notifications for payment events
4. ✅ Test edge cases (declined cards, expired cards, etc.)
5. ✅ Switch to live Stripe keys for production

---

**Ready to start? Begin with STEP 1!** 🚀
