# 🚀 Quick Start - Testing Payment System

## ✅ Setup Complete!
- Database migration applied
- Test promotions added
- Edge Functions deployed
- Profile screen updated with Stripe onboarding

---

## 📱 STEP 1: Setup Mechanic Stripe Account

### Option A: Via Profile Screen (Easiest)

1. **Start your app:**
   ```bash
   npx expo start
   ```

2. **Login as a mechanic**

3. **Go to Profile tab:**
   - Tap the "Profile" tab at the bottom
   - Scroll down to "Payout Account" section

4. **Click "SETUP STRIPE ACCOUNT":**
   - This will open Stripe's onboarding form in your browser

5. **Complete Stripe onboarding with test data:**
   - Business type: **Individual**
   - First name: **Test**
   - Last name: **Mechanic**
   - Email: **test@example.com**
   - Phone: **000-000-0000**
   - DOB: **01/01/1990**
   - SSN: **000-00-0000** (test mode accepts this)
   - Address: **123 Test St, Test City, CA, 12345**
   - Bank routing: **110000000**
   - Bank account: **000123456789**

6. **Return to app:**
   - After completing, you'll be redirected back
   - Tap the refresh icon next to "Payout Account"
   - You should see:
     - Status: **Active** ✅
     - Charges enabled: **✓ Yes**
     - Payouts enabled: **✓ Yes**
     - Details submitted: **✓ Yes**

---

## 📋 STEP 2: Create Job & Send Quote

### As Customer:

1. **Logout and login as customer**

2. **Create a job:**
   - Title: "Oil Change"
   - Description: "Need oil change for 2020 Honda Civic"
   - Submit

### As Mechanic:

3. **Logout and login as mechanic**

4. **Find the job and send quote:**
   - Go to available jobs
   - Open "Oil Change" job
   - Send quote: **$150.00**

---

## 💳 STEP 3: Accept Quote & Pay

### As Customer:

1. **Logout and login as customer**

2. **View the job:**
   - Go to "My Jobs"
   - Open "Oil Change" job

3. **Accept the quote:**
   - Click "Accept Quote"
   - **You'll automatically navigate to payment screen!**

4. **Apply promo code:**
   - Enter: `NOFEE`
   - Click "Apply"
   - Total should drop from $165 to $150 (fee waived!)

5. **Enter card details:**
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `12345`

6. **Click "Pay Now":**
   - Wait for processing
   - You'll see success message
   - Redirected to job details

---

## ✅ STEP 4: Verify Everything Works

### Check Database:

```sql
-- Check payment
SELECT * FROM payments WHERE job_id = 'YOUR_JOB_ID';
-- Should show: status = 'paid', customer_total_cents = 15000

-- Check job status
SELECT status FROM jobs WHERE id = 'YOUR_JOB_ID';
-- Should show: status = 'in_progress'

-- Check promo redemption
SELECT * FROM promotion_redemptions WHERE job_id = 'YOUR_JOB_ID';
-- Should show: discount_amount_cents = 1500
```

### Check Stripe Dashboard:

- Go to: https://dashboard.stripe.com/test/payments
- You should see payment for $150.00
- Click it to see transfer to mechanic

---

## 🎉 Success!

If all steps worked, your payment system is fully functional!

### What You Just Tested:
- ✅ Mechanic Stripe onboarding
- ✅ Job creation and quoting
- ✅ Quote acceptance → Auto-navigation to payment
- ✅ Promotion code application
- ✅ Payment processing
- ✅ Database updates
- ✅ Stripe Connect transfers

---

## 🐛 Troubleshooting

**Can't find Profile tab?**
- Make sure you're logged in as a mechanic
- Check bottom navigation bar

**"SETUP STRIPE ACCOUNT" button doesn't work?**
- Check Edge Function logs in Supabase
- Verify `STRIPE_SECRET_KEY` is set in secrets

**Payment fails?**
- Make sure mechanic completed Stripe onboarding first
- Check that status shows "Active" in profile

**Promo code doesn't apply?**
- Make sure you ran `TEST_PROMOTIONS.sql`
- Check promotions table has active codes

---

## 📚 More Details

For complete testing guide, see: `STEP_BY_STEP_TESTING.md`

**Ready to test? Start with STEP 1!** 🚀
