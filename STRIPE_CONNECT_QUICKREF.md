# Stripe Connect Quick Reference

## File Structure
```
wrenchgo/
├── supabase/
│   ├── migrations/
│   │   └── 20250116000000_create_mechanic_payout_accounts.sql
│   └── functions/
│       ├── stripe-connect-create-account-link/
│       │   └── index.ts
│       └── stripe-connect-refresh-status/
│           └── index.ts
├── app/
│   └── (mechanic)/(tabs)/
│       └── profile.tsx (modified)
├── STRIPE_CONNECT_SETUP.md
├── STRIPE_CONNECT_TESTING.md
└── STRIPE_CONNECT_QUICKREF.md (this file)
```

## Database Schema

### Table: `mechanic_payout_accounts`
```sql
mechanic_id          UUID PRIMARY KEY (FK to profiles.id)
stripe_account_id    TEXT NOT NULL UNIQUE
onboarding_status    TEXT NOT NULL (incomplete|pending|complete|restricted)
charges_enabled      BOOLEAN NOT NULL DEFAULT false
payouts_enabled      BOOLEAN NOT NULL DEFAULT false
requirements_due     JSONB DEFAULT '[]'
created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

## API Endpoints

### 1. Create Account Link
**Endpoint**: `POST /functions/v1/stripe-connect-create-account-link`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Response**:
```json
{
  "onboardingUrl": "https://connect.stripe.com/setup/...",
  "stripeAccountId": "acct_..."
}
```

**Behavior**:
- Creates new Stripe Express account if none exists
- Generates fresh account link (expires in minutes)
- Upserts record in `mechanic_payout_accounts`
- Returns URL to open in browser

### 2. Refresh Status
**Endpoint**: `POST /functions/v1/stripe-connect-refresh-status`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Response**:
```json
{
  "stripeAccountId": "acct_...",
  "onboardingStatus": "complete",
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "requirementsDue": [],
  "detailsSubmitted": true
}
```

**Behavior**:
- Fetches latest account status from Stripe
- Updates database record
- Returns current status

## React Native Integration

### State Variables
```typescript
const [payoutAccount, setPayoutAccount] = useState<any>(null);
const [loadingPayout, setLoadingPayout] = useState(false);
```

### Functions
```typescript
setupPayoutAccount()      // Opens Stripe onboarding
refreshPayoutStatus()     // Syncs status from Stripe
```

### Deep Link Handling
```typescript
// Listens for: wrenchgo://stripe-connect-return
// Listens for: wrenchgo://stripe-connect-refresh
// Auto-calls: refreshPayoutStatus()
```

## Environment Variables

### Supabase Secrets (Edge Functions)
```bash
STRIPE_SECRET_KEY=sk_test_...
APP_SCHEME=wrenchgo
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

### App Environment (.env)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Deployment Commands

### Deploy Edge Functions
```bash
# Deploy both functions
supabase functions deploy stripe-connect-create-account-link
supabase functions deploy stripe-connect-refresh-status

# Set secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set APP_SCHEME=wrenchgo
```

### Apply Migration
```bash
# Push to Supabase
supabase db push

# Or apply directly
supabase migration up
```

### Test Functions Locally
```bash
# Start Supabase locally
supabase start

# Serve functions
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/stripe-connect-create-account-link \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json"
```

## Stripe Test Data

### Test Bank Account
- Routing number: `110000000`
- Account number: `000123456789`

### Test Personal Info
- SSN: `000-00-0000`
- DOB: `01/01/1990`
- Address: `123 Test St, San Francisco, CA 94102`

### Test Scenarios
- Success: Use routing `110000000` + account `000123456789`
- Verification required: Use routing `110000000` + account `000111111116`
- Failure: Use routing `110000000` + account `000222222227`

## Status Flow

```
1. No Account
   ↓ (Tap "ADD BANK INFO")
2. Creating Account
   ↓ (Stripe API call)
3. Onboarding Started (status: incomplete)
   ↓ (Open Stripe URL)
4. User Fills Form
   ↓ (Submit)
5. Onboarding Complete (status: complete)
   ↓ (Deep link return)
6. Status Refreshed
   ↓
7. Payouts Enabled ✓
```

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "No Stripe account found" | Mechanic hasn't started onboarding | Call create-account-link |
| "Onboarding link expired" | Links expire after ~5 minutes | Generate new link |
| "Payouts not enabled" | Incomplete information | Check requirements_due field |
| Deep link not working | Scheme not registered | Update app.json, rebuild |
| 401 Unauthorized | Invalid/expired JWT | Re-authenticate user |
| Account restricted | Failed verification | Contact Stripe support |

## RLS Policies

```sql
-- Mechanics can only see their own account
SELECT: auth.uid() = mechanic_id

-- Mechanics can create their own account
INSERT: auth.uid() = mechanic_id

-- Mechanics can update their own account
UPDATE: auth.uid() = mechanic_id
```

## Webhook Events (Future)

When implementing webhooks, listen for:
- `account.updated` - Sync status changes
- `account.application.deauthorized` - Handle disconnections
- `payout.paid` - Track successful payouts
- `payout.failed` - Handle failures

## Support Contacts

- Stripe Support: https://support.stripe.com
- Stripe Connect Docs: https://stripe.com/docs/connect
- Supabase Support: https://supabase.com/support
- Edge Functions Docs: https://supabase.com/docs/guides/functions

## Quick Test

```bash
# 1. Deploy functions
supabase functions deploy stripe-connect-create-account-link
supabase functions deploy stripe-connect-refresh-status

# 2. Apply migration
supabase db push

# 3. Set secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set APP_SCHEME=wrenchgo

# 4. Build app
npm run ios  # or npm run android

# 5. Test flow
# - Sign in as mechanic
# - Go to Profile tab
# - Tap "ADD BANK INFO"
# - Complete Stripe form
# - Verify status shows "Complete"
```

## Production Checklist

- [ ] Switch to live Stripe keys
- [ ] Update redirect URLs in Stripe Dashboard
- [ ] Test with real bank account
- [ ] Configure webhooks
- [ ] Set up monitoring
- [ ] Update privacy policy
- [ ] Train support team
- [ ] Test on iOS and Android
- [ ] Verify deep links on physical devices
- [ ] Load test with multiple mechanics
