# Identity Verification & Payment Method Gating - Refactor Summary

## Date: 2025-02-05

## Overview
Simplified identity verification from a complex, slow 3rd-party integration to a simple 30-second timer-based verification. Added hard enforcement of payment method requirements before customers can request or accept quotes.

---

## What Was Changed

### 1. Database Schema Changes

**Removed (from `profiles` table):**
- `id_photo_path` - stored path to uploaded ID photo
- `id_status` - enum: 'none', 'pending', 'verified', 'rejected'
- `id_uploaded_at` - timestamp of photo upload
- `id_rejected_reason` - admin rejection reason
- `id_verified_by` - admin user who verified

**Added (to `profiles` table):**
- `id_verified` (boolean, default false) - simple flag indicating verification complete
- `id_verified_at` (timestamptz) - when verification was completed

**Migration:** `supabase/migrations/20250205000001_simplify_id_verification.sql`

### 2. Backend Functions

**Created RPC Functions:**
- `check_customer_eligibility(customer_auth_id uuid)` - Returns eligibility status
  - Returns: `{ eligible: boolean, id_verified: boolean, has_payment_method: boolean, missing: string[] }`
  - Checks both ID verification AND payment method existence
  
- `mark_id_verified()` - Marks current user as verified
  - Sets `id_verified = true` and `id_verified_at = now()`
  - Called after 30-second timer completes

**Migration:** `supabase/migrations/20250205000002_customer_eligibility_functions.sql`

### 3. RLS Policy Enforcement

**Updated Policies:**
- `jobs` table INSERT policy - now requires `check_customer_eligibility()` to return `eligible = true`
- `quote_requests` table UPDATE policy - requires eligibility check when accepting quotes (status = 'accepted')

**Migration:** `supabase/migrations/20250205000003_enforce_customer_eligibility_rls.sql`

### 4. Removed Code

**Deleted Edge Functions:**
- `supabase/functions/verify-id-photo/` - complex ID verification with 3rd-party service
- `supabase/functions/verify-id-photo-simple/` - simplified version (still too complex)

**Why:** These functions were slow, overbuilt, and not needed for MVP. Real ID verification can be re-introduced later.

### 5. New Frontend Components

**Created:**
- `app/(customer)/verify-identity.tsx` - 30-second timer screen
  - Persists start time to AsyncStorage (survives app backgrounding)
  - Shows countdown timer
  - Calls `mark_id_verified()` RPC when complete
  - Redirects back to account screen

**Updated:**
- `app/(customer)/(tabs)/account.tsx`
  - Added ID verification status section
  - Shows "Verified" badge if `id_verified = true`
  - Shows "Verify Identity" CTA button if not verified
  - Fetches `id_verified` and `id_verified_at` in profile query

- `app/(customer)/request-service.tsx`
  - Added eligibility check before job creation
  - Shows clear error message listing missing requirements
  - Offers "Go to Account" button to complete requirements

- `app/(customer)/job/[id].tsx`
  - Added eligibility check before accepting quotes
  - Same error handling as request-service

### 6. Enforcement Points

**Backend (Hard Blocks):**
1. RLS policy on `jobs` INSERT - prevents job creation if not eligible
2. RLS policy on `quote_requests` UPDATE - prevents quote acceptance if not eligible
3. RPC function returns detailed eligibility status

**Frontend (UI Gating + Clear Messaging):**
1. Request service flow - checks eligibility before submitting
2. Accept quote flow - checks eligibility before accepting
3. Account screen - shows verification status and CTAs

---

## What Was Removed & Why

### Removed Features:
1. **Real ID photo upload** - Too slow, not needed for MVP
2. **Admin verification workflow** - Overbuilt for current scale
3. **ID verification status states** - Simplified to boolean flag
4. **3rd-party verification service integration** - Not needed yet

### Why These Were Removed:
- **Speed:** Real verification took minutes; timer takes 30 seconds
- **Simplicity:** Boolean flag vs. complex state machine
- **Product decision:** Fake verification is acceptable for MVP
- **Easy to replace:** Clean separation makes real verification easy to add later

---

## How to Re-Introduce Real ID Verification

When you're ready to add real ID verification back, follow these steps:

### 1. Database Changes
```sql
-- Add back verification columns
ALTER TABLE public.profiles
  ADD COLUMN id_photo_path text,
  ADD COLUMN id_verification_provider text, -- e.g., 'stripe_identity', 'persona', etc.
  ADD COLUMN id_verification_session_id text,
  ADD COLUMN id_verification_status text CHECK (id_verification_status IN ('pending', 'verified', 'failed')),
  ADD COLUMN id_verification_failed_reason text;

-- Keep id_verified boolean for backward compatibility
-- Update it based on id_verification_status
```

### 2. Create New Edge Function
```typescript
// supabase/functions/verify-identity-real/index.ts
// Integrate with Stripe Identity, Persona, or similar
// Return session URL for user to complete verification
// Webhook handler to update id_verified when complete
```

### 3. Update Frontend
```typescript
// app/(customer)/verify-identity.tsx
// Replace timer logic with:
// 1. Call edge function to create verification session
// 2. Open verification URL in WebView or browser
// 3. Poll for completion or handle webhook callback
// 4. Update UI when verification completes
```

### 4. Update RPC Function
```sql
-- Modify check_customer_eligibility to check id_verification_status
-- instead of just id_verified boolean
```

### 5. Testing Checklist
- [ ] Verification session creation works
- [ ] User can complete verification flow
- [ ] Webhook updates database correctly
- [ ] Eligibility checks still work
- [ ] Failed verifications are handled gracefully
- [ ] Retry flow works for failed verifications

### 6. Recommended Providers
- **Stripe Identity** - Best if already using Stripe
- **Persona** - Comprehensive, good UX
- **Onfido** - Enterprise-grade
- **Jumio** - Global coverage

---

## Current Eligibility Rules

### Customers Must Have:
1. ✅ `id_verified = true` (completed 30-second timer)
2. ✅ At least one row in `customer_payment_methods` table

### Mechanics Must Have:
- ✅ Stripe Connect account with:
  - `charges_enabled = true`
  - `payouts_enabled = true`
  - `details_submitted = true`
- (No changes to mechanic requirements)

---

## Testing the Changes

### Manual Test Flow:
1. **New customer signs up**
   - Go to Account tab
   - Should see "Not Verified" status
   - Should see "Verify Identity" button

2. **Start verification**
   - Tap "Verify Identity"
   - Should see 30-second countdown
   - Background the app (timer should persist)
   - Return to app (timer should continue)
   - Wait for completion

3. **After verification**
   - Should see "Verified" badge in account
   - Should see green checkmark icon

4. **Try to request quote without payment method**
   - Go to request service flow
   - Fill out form
   - Submit
   - Should see error: "Before requesting quotes, you need to: • Add a payment method"
   - Should offer "Go to Account" button

5. **Add payment method**
   - Go to Account tab
   - Tap "Add Payment Method"
   - Complete Stripe payment sheet
   - Should see card details in account

6. **Request quote (should work now)**
   - Go to request service flow
   - Fill out form
   - Submit
   - Should succeed and create job

7. **Accept quote (should work now)**
   - Receive quote from mechanic
   - Tap "Accept Quote"
   - Should proceed to payment screen

### Database Verification:
```sql
-- Check eligibility for a user
SELECT * FROM check_customer_eligibility('USER_AUTH_ID_HERE');

-- Check profiles table
SELECT id, full_name, id_verified, id_verified_at 
FROM profiles 
WHERE auth_id = 'USER_AUTH_ID_HERE';

-- Check payment methods
SELECT * FROM customer_payment_methods 
WHERE customer_id = (SELECT id FROM profiles WHERE auth_id = 'USER_AUTH_ID_HERE');
```

---

## Migration Checklist

Before deploying to production:
- [ ] Run all 3 migrations in order
- [ ] Verify RPC functions are created
- [ ] Verify RLS policies are updated
- [ ] Test eligibility checks work
- [ ] Test timer-based verification works
- [ ] Test payment method requirement works
- [ ] Verify existing customers are not broken
- [ ] Update any admin dashboards that reference old columns

---

## Notes

- **Timer is intentionally simple:** No actual verification happens. This is a product decision.
- **Payment method check is real:** We verify a row exists in `customer_payment_methods`.
- **Backend enforcement is critical:** RLS policies prevent circumventing UI checks.
- **Clear error messages:** Users know exactly what's missing and how to fix it.
- **Easy to replace:** When ready for real verification, the structure is in place.

---

## Questions?

If you need to:
- Add real ID verification → See "How to Re-Introduce Real ID Verification" section
- Change verification duration → Update `VERIFICATION_DURATION_MS` in `verify-identity.tsx`
- Add more eligibility requirements → Update `check_customer_eligibility()` RPC function
- Change error messages → Update Alert.alert calls in request-service.tsx and job/[id].tsx
