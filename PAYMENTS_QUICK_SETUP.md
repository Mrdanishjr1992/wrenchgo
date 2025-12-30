# Quick Setup Guide - Stripe Payments

## Prerequisites
- Stripe account (test mode for development)
- Supabase project
- React Native app with Expo

## Step-by-Step Setup

### 1. Run Database Migration (5 minutes)

```bash
# In Supabase SQL Editor, run:
supabase/migrations/20250117000000_create_payments_system.sql
```

Or via CLI:
```bash
supabase db push
```

### 2. Configure Stripe (10 minutes)

#### A. Get Stripe Keys
1. Go to https://dashboard.stripe.com
2. Switch to **Test mode** (toggle in top right)
3. Go to **Developers** > **API keys**
4. Copy:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

#### B. Set Supabase Secrets
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
supabase secrets set APP_SCHEME=wrenchgo
```

#### C. Create Webhook
1. Go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   - `account.updated`
5. Copy **Signing secret** (starts with `whsec_`)
6. Set secret:
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

### 3. Deploy Edge Functions (5 minutes)

```bash
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy validate-promotion
supabase functions deploy stripe-connect-create-account-link
```

### 4. Install Stripe SDK in App (2 minutes)

```bash
npm install @stripe/stripe-react-native
```

### 5. Configure Stripe Provider (2 minutes)

In `app/_layout.tsx`, wrap your app:

```tsx
import { StripeProvider } from '@stripe/stripe-react-native';

export default function RootLayout() {
  return (
    <StripeProvider publishableKey="pk_test_YOUR_KEY_HERE">
      {/* Your existing app structure */}
    </StripeProvider>
  );
}
```

### 6. Create Test Promotion (Optional)

In Supabase SQL Editor:

```sql
INSERT INTO promotions (
  code,
  type,
  percent_off,
  description,
  active
) VALUES (
  'TEST10',
  'percent_discount',
  10.00,
  '10% off for testing',
  true
);
```

## Testing

### Test Customer Payment

1. Navigate to a job with an accepted quote
2. Go to payment screen: `/(customer)/payment/[jobId]`
3. Use test card: `4242 4242 4242 4242`
4. Any future expiry, any 3-digit CVC
5. Apply promo code: `TEST10`
6. Complete payment

### Test Mechanic Onboarding

1. As a mechanic, go to: `/(mechanic)/stripe-onboarding`
2. Click "Start Setup"
3. Use test data:
   - SSN: `000-00-0000`
   - Routing: `110000000`
   - Account: `000123456789`
4. Complete onboarding

### Test Mechanic Earnings

1. After payment is complete
2. Go to: `/(mechanic)/earnings/[jobId]`
3. View breakdown showing:
   - Job amount
   - Platform commission (12%, max $50)
   - Net payout

## Verification Checklist

- [ ] Database migration applied successfully
- [ ] Stripe secrets set in Supabase
- [ ] Webhook created and secret set
- [ ] Edge Functions deployed
- [ ] Stripe SDK installed in app
- [ ] StripeProvider configured
- [ ] Test payment completes successfully
- [ ] Webhook receives events (check Stripe Dashboard)
- [ ] Payment record created in database
- [ ] Job status updates to "in_progress"
- [ ] Mechanic can complete Stripe onboarding
- [ ] Mechanic can view earnings breakdown

## Common Issues

### "Mechanic has not completed Stripe onboarding"
- Mechanic must complete Stripe Connect onboarding first
- Go to `/(mechanic)/stripe-onboarding` and complete setup

### "Failed to create payment intent"
- Check `STRIPE_SECRET_KEY` is set correctly
- Verify quote is in "accepted" status
- Check Edge Function logs in Supabase

### Webhook not receiving events
- Verify webhook URL is correct
- Check `STRIPE_WEBHOOK_SECRET` is set
- Look at webhook attempts in Stripe Dashboard

### Payment succeeds but job status doesn't update
- Check webhook is receiving `payment_intent.succeeded` event
- Check Edge Function logs for errors
- Verify RLS policies allow updates

## Next Steps

1. Review full documentation: `PAYMENTS_DOCUMENTATION.md`
2. Test all payment flows thoroughly
3. Add payment navigation to your existing screens
4. Customize UI to match your brand
5. Switch to live mode when ready for production

## Production Checklist

Before going live:

- [ ] Switch Stripe to **Live mode**
- [ ] Update `STRIPE_SECRET_KEY` with live key
- [ ] Update `STRIPE_WEBHOOK_SECRET` with live webhook secret
- [ ] Update Stripe publishable key in app
- [ ] Create live webhook endpoint
- [ ] Test with real bank account (small amount)
- [ ] Review Stripe Connect terms
- [ ] Set up proper error monitoring
- [ ] Configure email notifications for failed payments
- [ ] Review and test refund flow

## Support

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Connect Guide**: https://stripe.com/docs/connect
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Full Documentation**: See `PAYMENTS_DOCUMENTATION.md`
