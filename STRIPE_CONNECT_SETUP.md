# Stripe Connect Configuration Guide

## Overview
This implementation uses Stripe Connect Express accounts to enable mechanics to receive direct deposits for completed jobs. Bank account information is securely stored by Stripe, not in your database.

## Stripe Dashboard Configuration

### 1. Enable Stripe Connect
1. Log in to your Stripe Dashboard: https://dashboard.stripe.com
2. Navigate to **Connect** → **Settings**
3. Click **Get Started** if Connect is not yet enabled
4. Choose **Express** as your account type (recommended for marketplaces)

### 2. Configure Connect Settings

#### Brand Settings
- Navigate to **Connect** → **Settings** → **Branding**
- Upload your app logo and brand colors
- Set your business name (displayed during onboarding)

#### Account Requirements
- Navigate to **Connect** → **Settings** → **Account requirements**
- For US mechanics, ensure these are enabled:
  - Individual accounts
  - Business accounts (optional)
  - Tax ID collection
  - Bank account verification

### 3. Configure Redirect URLs

**CRITICAL**: Set up your app's deep link URLs for the onboarding flow.

Navigate to **Connect** → **Settings** → **Integration**

Add these redirect URLs:
```
wrenchgo://stripe-connect-return
wrenchgo://stripe-connect-refresh
```

If using a custom scheme, replace `wrenchgo` with your `APP_SCHEME` environment variable.

For development/testing, also add:
```
exp://127.0.0.1:8081/--/stripe-connect-return
exp://127.0.0.1:8081/--/stripe-connect-refresh
```

### 4. Webhook Configuration (Future Implementation)

Navigate to **Developers** → **Webhooks** → **Add endpoint**

**Endpoint URL**: `https://[your-project-ref].supabase.co/functions/v1/stripe-connect-webhook`

**Events to listen for**:
- `account.updated` - Sync account status changes
- `account.application.deauthorized` - Handle disconnections
- `payout.paid` - Track successful payouts
- `payout.failed` - Handle failed payouts
- `charge.succeeded` - Track successful charges
- `charge.failed` - Handle failed charges

### 5. API Keys Setup

#### Get your API keys:
1. Navigate to **Developers** → **API keys**
2. Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)
3. Copy your **Publishable key** (starts with `pk_test_` or `pk_live_`)

#### Add to Supabase Edge Functions:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key_here
supabase secrets set APP_SCHEME=wrenchgo
```

#### Add to your app's environment:
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### 6. Test Mode vs Live Mode

**Test Mode** (Development):
- Use test API keys (`sk_test_`, `pk_test_`)
- Use test bank accounts: https://stripe.com/docs/connect/testing
- Test routing number: `110000000`
- Test account number: `000123456789`

**Live Mode** (Production):
- Switch to live API keys in Stripe Dashboard
- Update all environment variables with live keys
- Ensure your business is verified with Stripe
- Complete Stripe's platform agreement

### 7. Platform Fees (Optional)

If you want to charge a platform fee on transactions:

1. Navigate to **Connect** → **Settings** → **Platform settings**
2. Enable **Application fees**
3. Set your fee structure (percentage or fixed amount)

To implement in code, modify the payment intent creation:
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000,
  currency: 'usd',
  application_fee_amount: 500, // $5.00 platform fee
  transfer_data: {
    destination: mechanicStripeAccountId,
  },
});
```

## App Configuration

### 1. Update app.json / app.config.js

Add the deep link scheme:
```json
{
  "expo": {
    "scheme": "wrenchgo",
    "ios": {
      "bundleIdentifier": "com.yourcompany.wrenchgo"
    },
    "android": {
      "package": "com.yourcompany.wrenchgo"
    }
  }
}
```

### 2. Environment Variables

Create/update `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

### 3. Deploy Edge Functions

```bash
# Deploy both functions
supabase functions deploy stripe-connect-create-account-link
supabase functions deploy stripe-connect-refresh-status

# Set secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key
supabase secrets set APP_SCHEME=wrenchgo
```

### 4. Run Database Migration

```bash
# Apply the migration
supabase db push

# Or manually run the SQL file
psql -h db.your-project.supabase.co -U postgres -d postgres -f supabase/migrations/20250116000000_create_mechanic_payout_accounts.sql
```

## Security Considerations

1. **Never store bank account numbers** - Stripe handles all sensitive data
2. **Use RLS policies** - Only mechanics can access their own payout accounts
3. **Validate JWT tokens** - Edge functions verify user authentication
4. **Use HTTPS only** - All API calls must use secure connections
5. **Rotate API keys** - Regularly rotate Stripe keys in production
6. **Monitor webhooks** - Set up alerts for failed webhook deliveries

## Compliance & Legal

1. **Stripe Terms of Service** - Ensure your platform complies with Stripe's Connected Account Agreement
2. **KYC/AML Requirements** - Stripe handles identity verification for Express accounts
3. **Tax Reporting** - Stripe provides 1099-K forms for mechanics earning over threshold
4. **Data Privacy** - Update your privacy policy to mention Stripe as a payment processor

## Troubleshooting

### Common Issues:

**"No Stripe account found"**
- Mechanic hasn't completed onboarding
- Check `mechanic_payout_accounts` table for their record

**"Onboarding link expired"**
- Account links expire after a few minutes
- Call `stripe-connect-create-account-link` again to generate a new link

**"Payouts not enabled"**
- Mechanic hasn't completed all required information
- Check `requirements_due` field in database
- Have mechanic complete onboarding again

**Deep link not working**
- Verify scheme in app.json matches APP_SCHEME env variable
- Test with `npx uri-scheme open wrenchgo://stripe-connect-return --ios`
- Check Xcode/Android Studio logs for deep link registration

## Support Resources

- Stripe Connect Documentation: https://stripe.com/docs/connect
- Stripe Express Accounts: https://stripe.com/docs/connect/express-accounts
- Stripe Testing: https://stripe.com/docs/connect/testing
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
