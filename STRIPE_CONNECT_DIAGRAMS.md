# Stripe Connect Architecture & Flow Diagrams

## Fee Structure

### Platform Fee Rules
- **Flat fee from customer**: $15 (1500 cents)
- **Mechanic commission**: 12% of labor, capped at $50 (5000 cents)

### Fee Calculation
```typescript
// Example: $500 labor job
const labor_cents = 50000; // $500.00

// Calculate mechanic commission (12% of labor, max $50)
const percent_fee_cents = Math.min(Math.round(labor_cents * 0.12), 5000);
// Result: Math.min(6000, 5000) = 5000 cents ($50)

// Customer pays: labor + flat fee
const customer_total_cents = labor_cents + 1500;
// Result: 50000 + 1500 = 51500 cents ($515.00)

// Mechanic receives: labor - commission
const mechanic_payout_cents = labor_cents - percent_fee_cents;
// Result: 50000 - 5000 = 45000 cents ($450.00)

// Platform keeps: flat fee + commission
const platform_revenue_cents = 1500 + percent_fee_cents;
// Result: 1500 + 5000 = 6500 cents ($65.00)
```

### Stripe Connect Implementation
```typescript
// Use destination charges with transfer_data
const paymentIntent = await stripe.paymentIntents.create({
  amount: customer_total_cents,           // Total customer pays
  currency: 'usd',
  customer: customerStripeId,
  payment_method: savedPaymentMethodId,
  transfer_data: {
    amount: mechanic_payout_cents,        // Amount mechanic receives
    destination: mechanicStripeAccountId, // From mechanic_payout_accounts
  },
  // Platform automatically keeps the difference
  // (customer_total_cents - mechanic_payout_cents)
});
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Native App                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           Mechanic Profile Screen                          │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │         Payout Account Section                       │  │ │
│  │  │  • Status Display                                    │  │ │
│  │  │  • "ADD BANK INFO" Button                           │  │ │
│  │  │  • Refresh Status Button                            │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ JWT Token
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                       │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │ create-account-link      │  │ refresh-status               │ │
│  │ • Verify JWT             │  │ • Verify JWT                 │ │
│  │ • Create Stripe account  │  │ • Fetch Stripe account       │ │
│  │ • Generate onboarding URL│  │ • Update DB with status      │ │
│  │ • Upsert DB record       │  │ • Return current status      │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Stripe API Key
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Stripe API                               │
│  • Express Account Management                                    │
│  • Account Link Generation                                       │
│  • Onboarding Flow                                              │
│  • Bank Account Verification                                     │
│  • Payout Processing                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ RLS Policies
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         mechanic_payout_accounts                         │  │
│  │  • mechanic_id (PK)                                      │  │
│  │  • stripe_account_id                                     │  │
│  │  • onboarding_status                                     │  │
│  │  • charges_enabled                                       │  │
│  │  • payouts_enabled                                       │  │
│  │  • requirements_due                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Onboarding Flow

```
┌──────────┐
│ Mechanic │
└────┬─────┘
     │
     │ 1. Opens Profile
     ▼
┌─────────────────┐
│ Profile Screen  │
│ "ADD BANK INFO" │
└────┬────────────┘
     │
     │ 2. Taps Button
     ▼
┌──────────────────────────────┐
│ setupPayoutAccount()         │
│ • Get JWT token              │
│ • Call Edge Function         │
└────┬─────────────────────────┘
     │
     │ 3. POST /create-account-link
     ▼
┌──────────────────────────────┐
│ Edge Function                │
│ • Verify JWT                 │
│ • Check existing account     │
│ • Create Stripe account      │
│ • Generate account link      │
│ • Upsert DB record           │
└────┬─────────────────────────┘
     │
     │ 4. Return onboardingUrl
     ▼
┌──────────────────────────────┐
│ App Opens Browser            │
│ Linking.openURL()            │
└────┬─────────────────────────┘
     │
     │ 5. Navigate to Stripe
     ▼
┌──────────────────────────────┐
│ Stripe Onboarding Form       │
│ • Personal Info              │
│ • Address                    │
│ • Bank Account               │
│ • Verification               │
└────┬─────────────────────────┘
     │
     │ 6. Submit Form
     ▼
┌──────────────────────────────┐
│ Stripe Processes             │
│ • Verify identity            │
│ • Verify bank account        │
│ • Enable capabilities        │
└────┬─────────────────────────┘
     │
     │ 7. Redirect to app
     │    wrenchgo://stripe-connect-return
     ▼
┌──────────────────────────────┐
│ Deep Link Handler            │
│ • Detect return URL          │
│ • Call refreshPayoutStatus() │
└────┬─────────────────────────┘
     │
     │ 8. POST /refresh-status
     ▼
┌──────────────────────────────┐
│ Edge Function                │
│ • Fetch Stripe account       │
│ • Update DB with status      │
└────┬─────────────────────────┘
     │
     │ 9. Return updated status
     ▼
┌──────────────────────────────┐
│ Profile Screen Updates       │
│ ✓ Status: Complete           │
│ ✓ Charges Enabled            │
│ ✓ Payouts Enabled            │
└──────────────────────────────┘
```

## Data Flow

```
┌─────────────┐
│   Mechanic  │
│   Profile   │
└──────┬──────┘
       │
       │ Load Profile
       ▼
┌─────────────────────────────────────┐
│  SELECT * FROM profiles             │
│  WHERE id = auth.uid()              │
└──────┬──────────────────────────────┘
       │
       │ Load Payout Account
       ▼
┌─────────────────────────────────────┐
│  SELECT * FROM                      │
│  mechanic_payout_accounts           │
│  WHERE mechanic_id = auth.uid()     │
└──────┬──────────────────────────────┘
       │
       ├─ No Record ──────────────────┐
       │                              │
       │                              ▼
       │                    ┌──────────────────┐
       │                    │ Show "ADD BANK   │
       │                    │ INFO" Button     │
       │                    └──────────────────┘
       │
       └─ Has Record ─────────────────┐
                                      │
                                      ▼
                            ┌──────────────────┐
                            │ Show Status:     │
                            │ • Complete       │
                            │ • Incomplete     │
                            │ • Pending        │
                            │ • Restricted     │
                            └──────────────────┘
```

## Security Flow

```
┌──────────────┐
│ App Request  │
└──────┬───────┘
       │
       │ Include JWT in Authorization header
       ▼
┌─────────────────────────────────────┐
│ Edge Function                       │
│ supabaseClient.auth.getUser()       │
└──────┬──────────────────────────────┘
       │
       ├─ Invalid JWT ────────────────┐
       │                              │
       │                              ▼
       │                    ┌──────────────────┐
       │                    │ Return 401       │
       │                    │ Unauthorized     │
       │                    └──────────────────┘
       │
       └─ Valid JWT ──────────────────┐
                                      │
                                      ▼
                            ┌──────────────────┐
                            │ Extract user.id  │
                            └──────┬───────────┘
                                   │
                                   ▼
                            ┌──────────────────┐
                            │ Query Database   │
                            │ RLS enforces:    │
                            │ auth.uid() =     │
                            │ mechanic_id      │
                            └──────────────────┘
```

## Payment Flow with Fee Structure

```
┌──────────┐
│ Customer │
│ Requests │
│ Service  │
└────┬─────┘
     │
     │ 1. Job Completed - Labor: $500
     ▼
┌──────────────────────────────────────────┐
│ Calculate Fees                           │
│ labor_cents = 50000                      │
│ percent_fee = min(50000 * 0.12, 5000)   │
│             = min(6000, 5000) = 5000    │
│ customer_total = 50000 + 1500 = 51500   │
│ mechanic_payout = 50000 - 5000 = 45000  │
└────┬─────────────────────────────────────┘
     │
     │ 2. Create Payment Intent
     ▼
┌──────────────────────────────────────────┐
│ stripe.paymentIntents.create({          │
│   amount: 51500,        // $515 total   │
│   currency: 'usd',                       │
│   customer: cus_xxx,                     │
│   payment_method: pm_xxx,                │
│   confirm: true,                         │
│   transfer_data: {                       │
│     amount: 45000,      // $450 payout  │
│     destination: acct_xxx // mechanic   │
│   }                                      │
│ })                                       │
│                                          │
│ Platform keeps: $65                      │
│ ($15 flat + $50 commission)              │
└────┬─────────────────────────────────────┘
     │
     │ 3. Charge Customer
     ▼
┌──────────────────────────────────────────┐
│ Stripe Processes Payment                 │
│ • Charge customer card: $515             │
│ • Platform receives: $65                 │
│ • Transfer to mechanic: $450             │
└────┬─────────────────────────────────────┘
     │
     ├─ Success ────────────────────────────┐
     │                                      │
     │                                      ▼
     │                        ┌──────────────────────┐
     │                        │ Funds to Mechanic    │
     │                        │ Bank: $450           │
     │                        │ (2-7 business days)  │
     │                        └──────────────────────┘
     │
     └─ Failure ────────────────────────────┐
                                            │
                                            ▼
                              ┌──────────────────────┐
                              │ Notify Customer      │
                              │ & Mechanic           │
                              │ Retry payment        │
                              └──────────────────────┘
```

## Fee Calculation Examples

```
Example 1: Small Job ($100 labor)
─────────────────────────────────
Labor:              $100.00
Commission (12%):    $12.00
Flat fee:            $15.00
─────────────────────────────────
Customer pays:      $115.00
Mechanic receives:   $88.00
Platform keeps:      $27.00


Example 2: Medium Job ($500 labor)
─────────────────────────────────
Labor:              $500.00
Commission (12%):    $50.00 (capped)
Flat fee:            $15.00
─────────────────────────────────
Customer pays:      $515.00
Mechanic receives:  $450.00
Platform keeps:      $65.00


Example 3: Large Job ($1000 labor)
─────────────────────────────────
Labor:             $1000.00
Commission (12%):    $50.00 (capped at max)
Flat fee:            $15.00
─────────────────────────────────
Customer pays:     $1015.00
Mechanic receives:  $950.00
Platform keeps:      $65.00
```

## Status State Machine

```
┌─────────────┐
│   No        │
│   Account   │
└──────┬──────┘
       │
       │ Create Account
       ▼
┌─────────────┐
│ Incomplete  │◄─────────┐
└──────┬──────┘          │
       │                 │
       │ Start           │ Abandon
       │ Onboarding      │ Onboarding
       ▼                 │
┌─────────────┐          │
│  Pending    │──────────┘
└──────┬──────┘
       │
       │ Complete All
       │ Requirements
       ▼
┌─────────────┐
│  Complete   │
│  ✓ Charges  │
│  ✓ Payouts  │
└──────┬──────┘
       │
       │ Verification
       │ Failed
       ▼
┌─────────────┐
│ Restricted  │
│  ✗ Charges  │
│  ✗ Payouts  │
└─────────────┘
```

## Database Relationships

```
┌──────────────────────┐
│      profiles        │
│  ┌────────────────┐  │
│  │ id (PK)        │──┼──┐
│  │ full_name      │  │  │
│  │ email          │  │  │
│  │ phone          │  │  │
│  │ photo_url      │  │  │
│  └────────────────┘  │  │
└──────────────────────┘  │
                          │ FK
                          │
┌─────────────────────────▼────────────────┐
│      mechanic_payout_accounts            │
│  ┌────────────────────────────────────┐  │
│  │ mechanic_id (PK, FK)               │  │
│  │ stripe_account_id (unique)         │  │
│  │ onboarding_status                  │  │
│  │ charges_enabled                    │  │
│  │ payouts_enabled                    │  │
│  │ requirements_due                   │  │
│  │ created_at                         │  │
│  │ updated_at                         │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
                          │
                          │ References
                          ▼
                    ┌──────────┐
                    │  Stripe  │
                    │  Account │
                    │ acct_xxx │
                    └──────────┘
```

## Error Handling Flow

```
┌──────────────┐
│ User Action  │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Try Operation                       │
└──────┬──────────────────────────────┘
       │
       ├─ Network Error ──────────────┐
       │                              │
       │                              ▼
       │                    ┌──────────────────┐
       │                    │ Show Alert:      │
       │                    │ "Network error"  │
       │                    │ Retry button     │
       │                    └──────────────────┘
       │
       ├─ Auth Error ─────────────────┐
       │                              │
       │                              ▼
       │                    ┌──────────────────┐
       │                    │ Show Alert:      │
       │                    │ "Please sign in" │
       │                    │ Redirect to auth │
       │                    └──────────────────┘
       │
       ├─ Stripe Error ───────────────┐
       │                              │
       │                              ▼
       │                    ┌──────────────────┐
       │                    │ Show Alert:      │
       │                    │ Error message    │
       │                    │ Contact support  │
       │                    └──────────────────┘
       │
       └─ Success ───────────────────┐
                                     │
                                     ▼
                           ┌──────────────────┐
                           │ Update UI        │
                           │ Show success     │
                           └──────────────────┘
```

## Webhook Flow (Future)

```
┌──────────────┐
│   Stripe     │
│   Event      │
└──────┬───────┘
       │
       │ POST /stripe-connect-webhook
       ▼
┌─────────────────────────────────────┐
│ Webhook Handler                     │
│ • Verify signature                  │
│ • Parse event type                  │
└──────┬──────────────────────────────┘
       │
       ├─ account.updated ────────────┐
       │                              │
       │                              ▼
       │                    ┌──────────────────┐
       │                    │ Update DB:       │
       │                    │ • status         │
       │                    │ • capabilities   │
       │                    └──────────────────┘
       │
       ├─ payout.paid ────────────────┐
       │                              │
       │                              ▼
       │                    ┌──────────────────┐
       │                    │ Notify mechanic: │
       │                    │ "Payout sent"    │
       │                    └──────────────────┘
       │
       └─ payout.failed ──────────────┐
                                      │
                                      ▼
                            ┌──────────────────┐
                            │ Alert mechanic:  │
                            │ "Update bank"    │
                            └──────────────────┘
```

---

These diagrams illustrate the complete architecture and flow of the Stripe Connect implementation. Use them as reference when implementing, debugging, or explaining the system to others.
