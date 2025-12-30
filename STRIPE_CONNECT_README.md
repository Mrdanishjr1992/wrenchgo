# 🏦 Stripe Connect - Mechanic Payouts

Complete implementation of Stripe Connect for mechanic direct deposit payouts.

## 🎯 What This Does

Enables mechanics to:
- Add their bank account information securely via Stripe
- Receive direct deposits for completed jobs
- View payout account status in their profile
- Update bank information as needed

**Security**: Bank account numbers are NEVER stored in your database - Stripe handles all sensitive data.

## 📦 What's Included

### Database
- ✅ `mechanic_payout_accounts` table with RLS policies
- ✅ Automatic timestamp updates
- ✅ Indexes for performance

### Backend (Supabase Edge Functions)
- ✅ `stripe-connect-create-account-link` - Creates Stripe account & onboarding URL
- ✅ `stripe-connect-refresh-status` - Syncs account status from Stripe

### Frontend (React Native)
- ✅ Payout account UI in mechanic profile
- ✅ Deep link handling for Stripe return URLs
- ✅ Status indicators and loading states
- ✅ Error handling

### Documentation
- ✅ `STRIPE_CONNECT_SETUP.md` - Complete setup guide
- ✅ `STRIPE_CONNECT_TESTING.md` - Testing checklist
- ✅ `STRIPE_CONNECT_QUICKREF.md` - Quick reference
- ✅ `STRIPE_CONNECT_SUMMARY.md` - Implementation summary

## 🚀 Quick Start

### 1. Configure Stripe Dashboard
```
1. Go to https://dashboard.stripe.com
2. Enable Connect → Choose Express accounts
3. Add redirect URLs:
   - wrenchgo://stripe-connect-return
   - wrenchgo://stripe-connect-refresh
4. Copy your API keys (test mode)
```

### 2. Deploy to Supabase
```bash
# Set secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key_here
supabase secrets set APP_SCHEME=wrenchgo

# Apply migration
supabase db push

# Deploy functions
supabase functions deploy stripe-connect-create-account-link
supabase functions deploy stripe-connect-refresh-status
```

Or use the deployment script:
```bash
./deploy-stripe-connect.sh
```

### 3. Configure App
Create `.env` from `.env.example`:
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### 4. Rebuild App
```bash
npm run ios  # or npm run android
```

### 5. Test
1. Sign in as a mechanic
2. Go to Profile tab
3. Tap "ADD BANK INFO"
4. Complete Stripe onboarding with test data
5. Verify status shows "Complete"

## 🧪 Test Data

Use these values in Stripe's test mode:

```
Routing number: 110000000
Account number: 000123456789
SSN: 000-00-0000
DOB: 01/01/1990
Address: 123 Test St, San Francisco, CA 94102
```

## 📱 User Experience

### Mechanic Flow
1. **No Account**: Shows "ADD BANK INFO" button
2. **Tap Button**: Opens Stripe onboarding in browser
3. **Fill Form**: Enters personal info and bank details
4. **Submit**: Stripe verifies information
5. **Return**: Deep link brings them back to app
6. **Status Updated**: Shows "Complete" with green checkmark

### Status Display
- 🟢 **Complete**: All capabilities enabled, ready to receive payouts
- 🟡 **Incomplete**: Needs to complete onboarding
- 🟡 **Pending**: Additional information required
- 🔴 **Restricted**: Account disabled (contact support)

## 🔒 Security

- ✅ Bank data stored by Stripe, not in your database
- ✅ RLS policies prevent cross-mechanic access
- ✅ JWT authentication on all API calls
- ✅ Unique Stripe account per mechanic
- ✅ Secure deep link validation

## 📊 Database Schema

```sql
mechanic_payout_accounts
├── mechanic_id          UUID (PK, FK to profiles.id)
├── stripe_account_id    TEXT (unique)
├── onboarding_status    TEXT (incomplete|pending|complete|restricted)
├── charges_enabled      BOOLEAN
├── payouts_enabled      BOOLEAN
├── requirements_due     JSONB
├── created_at           TIMESTAMPTZ
└── updated_at           TIMESTAMPTZ
```

## 🔌 API Endpoints

### Create Account Link
```bash
POST /functions/v1/stripe-connect-create-account-link
Authorization: Bearer <JWT>

Response:
{
  "onboardingUrl": "https://connect.stripe.com/setup/...",
  "stripeAccountId": "acct_..."
}
```

### Refresh Status
```bash
POST /functions/v1/stripe-connect-refresh-status
Authorization: Bearer <JWT>

Response:
{
  "stripeAccountId": "acct_...",
  "onboardingStatus": "complete",
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "requirementsDue": []
}
```

## 💰 Payment Flow (Next Step)

When implementing customer payments, use the fee structure:

**Fee Rules:**
- Flat fee from customer: $15 (1500 cents)
- Mechanic commission: 12% of labor, capped at $50 (5000 cents)

**Calculation:**
```typescript
const labor_cents = /* job labor cost */;
const percent_fee_cents = Math.min(Math.round(labor_cents * 0.12), 5000);
const customer_total_cents = labor_cents + 1500;
const mechanic_payout_cents = labor_cents - percent_fee_cents;
```

**Stripe Implementation:**
```typescript
// Create payment intent with destination charge
const paymentIntent = await stripe.paymentIntents.create({
  amount: customer_total_cents,           // Total customer pays
  currency: 'usd',
  customer: customerStripeId,
  payment_method: savedPaymentMethodId,
  confirm: true,
  transfer_data: {
    amount: mechanic_payout_cents,        // Amount mechanic receives
    destination: mechanicStripeAccountId, // From mechanic_payout_accounts
  },
  metadata: {
    job_id: jobId,
    labor_cents: labor_cents.toString(),
  },
});
```

**Examples:**
- $100 job: Customer pays $115, mechanic gets $88, platform keeps $27
- $500 job: Customer pays $515, mechanic gets $450, platform keeps $65
- $1000 job: Customer pays $1015, mechanic gets $950, platform keeps $65

See **`PAYMENT_IMPLEMENTATION.md`** for complete payment flow implementation with edge function code, React Native components, and testing guide.

Stripe automatically:
- Charges customer's card
- Transfers funds to mechanic's bank
- Handles disputes and refunds
- Provides tax forms (1099-K)

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Deep link not working | Rebuild app after adding scheme to app.json |
| "Onboarding link expired" | Links expire in 5 minutes - generate new one |
| "Payouts not enabled" | Check `requirements_due` field, complete onboarding |
| 401 Unauthorized | Re-authenticate user |
| Account restricted | Contact Stripe support |

## 📚 Documentation

- **Setup Guide**: `STRIPE_CONNECT_SETUP.md` - Detailed configuration steps
- **Testing Guide**: `STRIPE_CONNECT_TESTING.md` - Complete test cases
- **Quick Reference**: `STRIPE_CONNECT_QUICKREF.md` - Commands and data
- **Summary**: `STRIPE_CONNECT_SUMMARY.md` - Implementation overview

## 🎓 Learn More

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Expo Deep Linking](https://docs.expo.dev/guides/deep-linking/)

## ✅ Production Checklist

Before going live:

- [ ] Switch to live Stripe API keys
- [ ] Update redirect URLs in Stripe Dashboard
- [ ] Test with real bank account
- [ ] Configure webhook endpoint
- [ ] Set up monitoring and alerts
- [ ] Update privacy policy
- [ ] Train support team
- [ ] Test on iOS and Android devices
- [ ] Load test with multiple mechanics

## 🆘 Support

Need help? Check:
1. `STRIPE_CONNECT_SETUP.md` for configuration issues
2. `STRIPE_CONNECT_TESTING.md` for test cases
3. [Stripe Support](https://support.stripe.com)
4. [Supabase Support](https://supabase.com/support)

## 📝 Notes

- Customer "save card on file" flow is separate and unchanged
- Existing auth routing is not affected
- Bank account numbers are NEVER stored in Postgres
- Each mechanic gets their own Stripe Express account
- Stripe handles all KYC/AML compliance

---

**Ready to deploy?** Run `./deploy-stripe-connect.sh` and follow the prompts!
