# WrenchGo Payments System Documentation

## Overview

This document describes the complete Stripe payments implementation for WrenchGo, including quote payments, platform fees, promotions, and Stripe Connect for mechanic payouts.

## Architecture

### Stripe Connect Approach

We use **Stripe Connect with Destination Charges** for the marketplace:

- **Why this approach?**
  - Customer pays us (the platform) directly
  - We automatically transfer funds to mechanics minus our commission
  - Platform controls the entire payment flow
  - Simplifies refunds and disputes
  - Mechanics don't need to handle customer payment methods

- **Alternative considered:** Separate charges would require mechanics to handle their own payments, adding complexity

### Business Rules

#### Customer Side
- **Quote Amount**: The mechanic's service fee
- **Platform Fee**: Fixed $15 per job (goes to platform)
- **Discounts**: Applied via promotion codes
- **Total**: `quote_amount + $15 - discounts`

#### Mechanic Side
- **Job Amount**: The quote amount they set
- **Platform Commission**: 12% of quote amount, capped at $50
- **Net Payout**: `quote_amount - commission`
- **Visibility**: Mechanics do NOT see the customer's $15 platform fee

#### Platform Revenue
- **Total Revenue**: `$15 customer fee + mechanic commission - discounts`

## Database Schema

### Tables Created

#### `mechanic_stripe_accounts`
Stores Stripe Connect account information for mechanics.

```sql
- id: UUID (primary key)
- mechanic_id: UUID (references auth.users)
- stripe_account_id: TEXT (Stripe Connect account ID)
- status: ENUM (not_started, pending, active, restricted, rejected)
- charges_enabled: BOOLEAN
- payouts_enabled: BOOLEAN
- details_submitted: BOOLEAN
- onboarding_url: TEXT
- onboarding_expires_at: TIMESTAMPTZ
```

#### `payments`
Stores all payment transactions with full breakdown.

```sql
- id: UUID (primary key)
- job_id: UUID (references jobs)
- quote_id: UUID (references quotes)
- customer_id: UUID (references auth.users)
- mechanic_id: UUID (references auth.users)
- quote_amount_cents: INTEGER
- customer_platform_fee_cents: INTEGER (default 1500 = $15)
- customer_discount_cents: INTEGER
- customer_total_cents: INTEGER
- mechanic_platform_commission_cents: INTEGER
- mechanic_payout_cents: INTEGER
- platform_revenue_cents: INTEGER
- stripe_payment_intent_id: TEXT
- stripe_charge_id: TEXT
- status: ENUM (requires_payment, processing, paid, failed, refunded, cancelled)
- promotion_codes: TEXT[]
- paid_at: TIMESTAMPTZ
```

#### `promotions`
Stores promotional codes and campaigns.

```sql
- id: UUID (primary key)
- code: TEXT (unique)
- type: ENUM (percent_discount, fixed_discount, waive_platform_fee, credit, referral_bonus)
- amount_cents: INTEGER
- percent_off: DECIMAL(5,2)
- start_date: TIMESTAMPTZ
- end_date: TIMESTAMPTZ
- max_redemptions: INTEGER
- max_redemptions_per_user: INTEGER
- active: BOOLEAN
```

#### `promotion_redemptions`
Tracks who used which promotions.

```sql
- id: UUID (primary key)
- promotion_id: UUID (references promotions)
- user_id: UUID (references auth.users)
- job_id: UUID (references jobs)
- payment_id: UUID (references payments)
- discount_amount_cents: INTEGER
```

## Edge Functions

### 1. `create-payment-intent`

Creates a Stripe PaymentIntent with full fee calculation.

**Request:**
```json
{
  "jobId": "uuid",
  "quoteId": "uuid",
  "promotionCode": "WELCOME10" // optional
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "paymentId": "uuid",
  "breakdown": {
    "quoteAmountCents": 10000,
    "customerPlatformFeeCents": 1500,
    "customerDiscountCents": 1150,
    "customerTotalCents": 10350,
    "mechanicPlatformCommissionCents": 1200,
    "mechanicPayoutCents": 8800,
    "platformRevenueCents": 1350,
    "promotionApplied": {
      "code": "WELCOME10",
      "type": "percent_discount",
      "discountCents": 1150
    }
  }
}
```

**Security:**
- Validates user is the customer for the job
- Checks quote is accepted
- Prevents duplicate payments
- Validates mechanic has completed Stripe onboarding
- Calculates all fees server-side (client cannot manipulate)

### 2. `stripe-webhook`

Handles Stripe webhook events to update payment status.

**Events Handled:**
- `payment_intent.succeeded` → Mark payment as paid, update job status
- `payment_intent.payment_failed` → Mark payment as failed
- `payment_intent.canceled` → Mark payment as cancelled
- `charge.refunded` → Handle refunds
- `account.updated` → Update mechanic Stripe account status

**Webhook URL:** `https://your-project.supabase.co/functions/v1/stripe-webhook`

### 3. `validate-promotion`

Validates promotion codes before payment.

**Request:**
```json
{
  "promotionCode": "WELCOME10",
  "quoteAmountCents": 10000
}
```

**Response:**
```json
{
  "valid": true,
  "promotion": {
    "code": "WELCOME10",
    "type": "percent_discount",
    "description": "10% off your first job"
  },
  "discountCents": 1150
}
```

### 4. `stripe-connect-create-account-link`

Creates Stripe Connect onboarding link for mechanics.

**Response:**
```json
{
  "url": "https://connect.stripe.com/setup/...",
  "accountId": "acct_xxx",
  "status": "pending"
}
```

## Setup Instructions

### 1. Database Migration

Run the migration in Supabase SQL Editor:

```bash
# Apply migration
supabase db push

# Or manually run
supabase/migrations/20250117000000_create_payments_system.sql
```

### 2. Stripe Configuration

#### Get Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Get your keys from **Developers** > **API keys**
3. For testing, use **Test mode** keys
4. For production, use **Live mode** keys

#### Set Supabase Secrets

```bash
# Set Stripe secret key
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx

# Set webhook secret (after creating webhook)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

# Set app scheme for deep linking
supabase secrets set APP_SCHEME=wrenchgo
```

#### Create Webhook

1. Go to **Developers** > **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
4. Events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   - `account.updated`
5. Copy the **Signing secret** and set it as `STRIPE_WEBHOOK_SECRET`

### 3. Deploy Edge Functions

```bash
# Deploy all payment functions
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy validate-promotion
supabase functions deploy stripe-connect-create-account-link
```

### 4. React Native Setup

#### Install Stripe SDK

```bash
npm install @stripe/stripe-react-native
# or
yarn add @stripe/stripe-react-native
```

#### Configure Stripe Provider

In your root `_layout.tsx`:

```tsx
import { StripeProvider } from '@stripe/stripe-react-native';

export default function RootLayout() {
  return (
    <StripeProvider
      publishableKey="pk_test_xxx" // Your Stripe publishable key
      merchantIdentifier="merchant.com.wrenchgo" // For Apple Pay
    >
      {/* Your app */}
    </StripeProvider>
  );
}
```

## Usage Examples

### Customer Payment Flow

```tsx
import { useRouter } from 'expo-router';

// Navigate to payment screen
router.push(`/(customer)/payment/${jobId}?quoteId=${quoteId}`);
```

The payment screen handles:
1. Loading quote details
2. Calculating breakdown
3. Applying promotion codes
4. Collecting card information
5. Creating PaymentIntent
6. Confirming payment with Stripe
7. Showing success/failure

### Mechanic Earnings View

```tsx
import { useRouter } from 'expo-router';

// Navigate to earnings screen
router.push(`/(mechanic)/earnings/${jobId}`);
```

Shows:
- Job amount
- Platform commission (12%, max $50)
- Net payout
- Payment status
- Payment details

### Stripe Connect Onboarding

```tsx
import { useRouter } from 'expo-router';

// Navigate to onboarding
router.push('/(mechanic)/stripe-onboarding');
```

Handles:
- Checking if mechanic has Stripe account
- Creating Stripe Connect account
- Opening onboarding link
- Showing account status

## Promotion System

### Creating Promotions

Insert directly into database or create admin panel:

```sql
-- 10% off promotion
INSERT INTO promotions (
  code,
  type,
  percent_off,
  description,
  start_date,
  end_date,
  max_redemptions,
  max_redemptions_per_user,
  active
) VALUES (
  'WELCOME10',
  'percent_discount',
  10.00,
  '10% off your first job',
  NOW(),
  NOW() + INTERVAL '30 days',
  1000,
  1,
  true
);

-- Fixed $20 off
INSERT INTO promotions (
  code,
  type,
  amount_cents,
  description,
  minimum_amount_cents,
  active
) VALUES (
  'SAVE20',
  'fixed_discount',
  2000,
  '$20 off orders over $100',
  10000,
  true
);

-- Waive platform fee
INSERT INTO promotions (
  code,
  type,
  description,
  active
) VALUES (
  'NOFEE',
  'waive_platform_fee',
  'No platform fee for this job',
  true
);
```

### Promotion Types

1. **percent_discount**: Percentage off total (quote + platform fee)
2. **fixed_discount**: Fixed dollar amount off
3. **waive_platform_fee**: Removes the $15 platform fee
4. **credit**: Store credit (future feature)
5. **referral_bonus**: Referral rewards (future feature)

## Testing

### Test Cards

Use Stripe test cards:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`

Any future expiry date and any 3-digit CVC.

### Test Promotion Codes

Create test promotions in your database:

```sql
INSERT INTO promotions (code, type, percent_off, active)
VALUES ('TEST10', 'percent_discount', 10.00, true);
```

### Test Stripe Connect

1. Use test mode in Stripe Dashboard
2. Complete onboarding with test data
3. Use test SSN: `000-00-0000`
4. Use test routing number: `110000000`
5. Use test account number: `000123456789`

## Security Considerations

### RLS Policies

- ✅ Customers can only view their own payments
- ✅ Mechanics can only view their own payments
- ✅ Mechanics cannot see customer platform fees
- ✅ Promotion validation happens server-side
- ✅ Payment calculations happen server-side

### Stripe Security

- ✅ Secret keys stored in Supabase secrets (never in code)
- ✅ Webhook signatures verified
- ✅ PaymentIntents created server-side only
- ✅ Idempotency keys prevent duplicate charges
- ✅ Card data never touches our servers (handled by Stripe)

## Monitoring & Debugging

### Check Payment Status

```sql
SELECT 
  p.*,
  j.status as job_status,
  q.amount as quote_amount
FROM payments p
JOIN jobs j ON j.id = p.job_id
JOIN quotes q ON q.id = p.quote_id
WHERE p.status = 'failed'
ORDER BY p.created_at DESC;
```

### Check Mechanic Stripe Accounts

```sql
SELECT 
  msa.*,
  pr.full_name,
  pr.email
FROM mechanic_stripe_accounts msa
JOIN profiles pr ON pr.id = msa.mechanic_id
WHERE msa.status != 'active';
```

### Check Promotion Usage

```sql
SELECT 
  p.code,
  p.type,
  p.current_redemptions,
  p.max_redemptions,
  COUNT(pr.id) as actual_redemptions
FROM promotions p
LEFT JOIN promotion_redemptions pr ON pr.promotion_id = p.id
GROUP BY p.id
ORDER BY p.created_at DESC;
```

## Troubleshooting

### Payment Failed

1. Check Stripe Dashboard for error details
2. Check `payments.failure_reason` in database
3. Verify mechanic has completed Stripe onboarding
4. Verify webhook is receiving events

### Webhook Not Working

1. Check webhook URL is correct
2. Verify `STRIPE_WEBHOOK_SECRET` is set
3. Check Stripe Dashboard > Webhooks > Events
4. Check Supabase Edge Function logs

### Promotion Not Applying

1. Check promotion is active
2. Check start/end dates
3. Check redemption limits
4. Check minimum amount requirements
5. Check user hasn't already used it

## Future Enhancements

- [ ] Refund handling in app UI
- [ ] Partial refunds
- [ ] Subscription payments for premium features
- [ ] Saved payment methods
- [ ] Apple Pay / Google Pay
- [ ] Referral bonus system
- [ ] Store credit system
- [ ] Mechanic earnings dashboard
- [ ] Tax reporting (1099 forms)
- [ ] Multi-currency support

## Support

For issues or questions:
- Check Stripe Dashboard for payment details
- Check Supabase logs for Edge Function errors
- Review RLS policies if data access issues
- Contact Stripe support for Connect account issues
