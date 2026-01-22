# Data Integrity Runbook

## Overview

This runbook describes how to handle data integrity issues in the `public.profiles` table and related mechanic tables, including how to safely create profiles manually and how to diagnose/repair issues.

---

## 1. NEVER Do Manual Inserts Like This

```sql
-- ❌ BAD: This will create orphan profiles and data issues
INSERT INTO public.profiles (id, email, role, payout_method_status)
VALUES (
  'some-random-uuid',  -- ❌ No matching auth.users record
  'test@example.com',
  'mechanic',
  'active'  -- ❌ No stripe account exists
);
```

### Why This Breaks Things:
1. **Orphan profiles**: `id` must reference an existing `auth.users(id)` record
2. **Invalid status**: `payout_method_status='active'` requires a valid Stripe account
3. **Missing data**: Mechanics need location data to receive leads

---

## 2. Safe Manual Profile Creation

If you MUST create a test profile manually:

```sql
-- Step 1: Create auth.users record first (via Supabase Dashboard or API)
-- Use the Supabase Dashboard > Authentication > Users > Add User

-- Step 2: After the auth user exists, create the profile
INSERT INTO public.profiles (id, email, full_name, role, payout_method_status)
VALUES (
  '<auth-user-uuid>',  -- Must match auth.users.id
  'test@example.com',
  'Test User',
  'customer',  -- Start as customer, not mechanic
  'none'  -- Always start with 'none'
);

-- Step 3: If creating a mechanic, add mechanic_profiles record
INSERT INTO public.mechanic_profiles (id, tier, is_available)
VALUES (
  '<auth-user-uuid>',
  'probation',  -- Always start in probation
  false  -- Don't make available until location is set
);

-- Step 4: Update role to mechanic
UPDATE public.profiles SET role = 'mechanic' WHERE id = '<auth-user-uuid>';
```

---

## 3. Running Diagnostics

### Via SQL Editor (Supabase Dashboard)

```sql
-- Run the admin diagnostic RPC
SELECT public.admin_run_data_integrity_diagnostics();
```

Expected output:
```json
{
  "orphan_profiles": 0,
  "payout_status_mismatches": 0,
  "mechanics_available_without_location": 0,
  "invalid_coordinates": 0,
  "quarantined_unresolved": 0
}
```

### Manual Diagnostic Queries

See `supabase/migrations/20260125000001_data_integrity_repair.sql` Section 1 for detailed diagnostic queries.

---

## 4. Running Repairs

### Via SQL Editor (Supabase Dashboard)

```sql
-- Run the admin repair RPC (requires admin role)
SELECT public.admin_run_data_integrity_repairs();
```

Expected output:
```json
{
  "orphans_quarantined": 2,
  "payout_statuses_fixed": 1,
  "mechanics_marked_unavailable": 3,
  "invalid_coordinates_cleared": 0
}
```

### What Each Repair Does:

| Repair | Action |
|--------|--------|
| `orphans_quarantined` | Profiles without auth.users are soft-deleted and moved to quarantine table |
| `payout_statuses_fixed` | `payout_method_status` reset to 'none' for mechanics without valid Stripe |
| `mechanics_marked_unavailable` | `is_available` set to false for mechanics missing location |
| `invalid_coordinates_cleared` | Out-of-range lat/lng values cleared to NULL |

---

## 5. Reviewing Quarantined Profiles

```sql
-- View all unresolved quarantined profiles
SELECT 
  q.id,
  q.profile_id,
  q.reason,
  q.detected_at,
  q.snapshot->>'email' AS email,
  q.snapshot->>'full_name' AS full_name
FROM public.orphan_profiles_quarantine q
WHERE q.resolved_at IS NULL
ORDER BY q.detected_at DESC;

-- Mark a quarantined profile as resolved
UPDATE public.orphan_profiles_quarantine
SET 
  resolved_at = now(),
  resolved_by = auth.uid(),
  resolution_action = 'deleted',  -- or 'restored', 'merged', etc.
  notes = 'Confirmed orphan from manual insert test'
WHERE id = '<quarantine-record-id>';
```

---

## 6. Verification Checklist

After running repairs, verify:

- [ ] `admin_run_data_integrity_diagnostics()` returns all zeros
- [ ] No orphan profiles exist: `SELECT COUNT(*) FROM profiles p LEFT JOIN auth.users u ON p.id = u.id WHERE u.id IS NULL AND p.deleted_at IS NULL` = 0
- [ ] All active payout statuses have Stripe: 
  ```sql
  SELECT COUNT(*) FROM profiles p 
  LEFT JOIN mechanic_stripe_accounts msa ON p.id = msa.mechanic_id 
  WHERE p.payout_method_status = 'active' 
  AND (msa.id IS NULL OR NOT msa.payouts_enabled)
  ``` = 0
- [ ] Available mechanics have locations:
  ```sql
  SELECT COUNT(*) FROM profiles p 
  JOIN mechanic_profiles mp ON p.id = mp.id 
  WHERE mp.is_available = true 
  AND (p.home_lat IS NULL OR p.home_lng IS NULL)
  ``` = 0
- [ ] App functions normally (test mechanic leads, payments, etc.)

---

## 7. Guardrails in Place

The following triggers/constraints now prevent future issues:

| Guardrail | What It Does |
|-----------|--------------|
| `trg_check_payout_status` | Auto-corrects `payout_method_status='active'` to 'none' if no valid Stripe account |
| `trg_check_mechanic_availability` | Auto-corrects `is_available=true` to false if no location set |
| `trg_verify_profile_auth` | Quarantines and soft-deletes profiles inserted without auth.users |
| `profiles_valid_lat` | CHECK constraint preventing lat outside [-90, 90] |
| `profiles_valid_lng` | CHECK constraint preventing lng outside [-180, 180] |

---

## 8. Audit Trail

All repairs and auto-corrections are logged to `public.audit_log`. To review:

```sql
-- View recent data integrity actions
SELECT 
  created_at,
  action,
  entity_type,
  entity_id,
  metadata
FROM public.audit_log
WHERE action IN ('DATA_REPAIR', 'AUTO_CORRECT_PAYOUT_STATUS', 'AUTO_CORRECT_AVAILABILITY', 'ORPHAN_PROFILE_BLOCKED')
ORDER BY created_at DESC
LIMIT 50;
```

---

## 9. Emergency: Restoring a Quarantined Profile

If a profile was incorrectly quarantined:

```sql
-- 1. Get the snapshot
SELECT snapshot FROM public.orphan_profiles_quarantine WHERE profile_id = '<profile-id>';

-- 2. Ensure auth.users exists first!
-- If it doesn't, you CANNOT restore - the profile is truly orphaned

-- 3. If auth.users exists, un-delete the profile
UPDATE public.profiles
SET 
  deleted_at = NULL,
  deleted_reason = NULL,
  can_reapply = true,
  updated_at = now()
WHERE id = '<profile-id>';

-- 4. Mark quarantine record as resolved
UPDATE public.orphan_profiles_quarantine
SET 
  resolved_at = now(),
  resolved_by = auth.uid(),
  resolution_action = 'restored',
  notes = 'Auth user was created after profile - restored'
WHERE profile_id = '<profile-id>';
```

---

## 10. Contact

For issues with this process, contact the backend team or check:
- `audit_log` for recent changes
- `orphan_profiles_quarantine` for flagged profiles
- Supabase Dashboard > Logs for errors
