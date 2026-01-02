# Role Selection Flow - Verification Checklist

## Pre-Deployment Verification

- [ ] Migration file created: `supabase/migrations/20250127000000_fix_role_selection_flow.sql`
- [ ] App code updated: `app/(auth)/sign-up.tsx` (role removed)
- [ ] App code updated: `app/(auth)/choose-role.tsx` (uses RPC)
- [ ] Code review completed
- [ ] Backup database before migration

## Deployment Verification

### 1. Database Migration Applied
```sql
-- Run these queries to verify migration success:

-- ✓ Role column allows NULL
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'role';
-- Expected: is_nullable = 'YES', column_default = NULL

-- ✓ RPC function exists
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'set_user_role';
-- Expected: 1 row with function definition

-- ✓ Trigger updated
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
-- Expected: Should NOT contain "coalesce(..., 'customer')"

-- ✓ RLS policy exists
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles' AND policyname LIKE '%role%null%';
-- Expected: Policy allowing UPDATE when role IS NULL
```

- [ ] All database checks passed

### 2. App Deployment
- [ ] App code deployed to staging/production
- [ ] No build errors
- [ ] No runtime errors in logs

## Functional Testing

### Test Case 1: New User Signup (Happy Path)
**Steps:**
1. Open app (not signed in)
2. Tap "Sign Up"
3. Fill in: Name, Email, Password
4. Tap "CREATE ACCOUNT"
5. Verify: Alert "Account created"
6. Tap "SIGN IN"
7. Enter email/password, sign in
8. **Expected: Redirected to "Choose your role" screen**
9. Verify: No role is pre-selected
10. Tap "Customer" card
11. Verify: Customer card shows "Selected"
12. Tap "CONTINUE"
13. **Expected: Navigates to customer home screen `/(customer)/(tabs)`**
14. Close app, reopen
15. **Expected: Still on customer home (role persisted)**

**Verification:**
```sql
-- Check user's profile
SELECT auth_id, role, full_name, created_at
FROM public.profiles
WHERE auth_id = '<user_id>';
-- Expected: role = 'customer'
```

- [ ] Test Case 1 passed

### Test Case 2: New User Chooses Mechanic Role
**Steps:**
1. Sign up new user (follow steps 1-8 from Test Case 1)
2. On "Choose your role" screen, tap "Mechanic"
3. Verify: Mechanic card shows "Selected"
4. Tap "CONTINUE"
5. **Expected: Navigates to mechanic home screen `/(mechanic)/(tabs)/leads`**
6. Close app, reopen
7. **Expected: Still on mechanic home**

**Verification:**
```sql
-- Check user's profile and mechanic_profile
SELECT p.auth_id, p.role, mp.id
FROM public.profiles p
LEFT JOIN public.mechanic_profiles mp ON mp.id = p.auth_id
WHERE p.auth_id = '<user_id>';
-- Expected: role = 'mechanic', mechanic_profile row exists
```

- [ ] Test Case 2 passed

### Test Case 3: Role Selection is Required (No Default)
**Steps:**
1. Sign up new user
2. Sign in
3. On "Choose your role" screen, verify:
   - Neither card is pre-selected
   - "CONTINUE" button is disabled (grayed out)
4. Try tapping "CONTINUE" without selecting
5. **Expected: Button does nothing (disabled)**
6. Select a role
7. **Expected: Button becomes enabled**

- [ ] Test Case 3 passed

### Test Case 4: Back Button / App Reload Before Role Chosen
**Steps:**
1. Sign up new user
2. Sign in
3. On "Choose your role" screen, close app (don't choose role)
4. Reopen app
5. **Expected: Redirected back to "Choose your role" screen**
6. Verify: No role pre-selected
7. Choose role and continue
8. **Expected: Navigation works correctly**

- [ ] Test Case 4 passed

### Test Case 5: Cannot Change Role After Selection
**Steps:**
1. Sign up new user, choose "Customer" role
2. Navigate to customer home
3. In database, try to change role:
```sql
-- This should FAIL
UPDATE public.profiles
SET role = 'mechanic'
WHERE auth_id = '<user_id>';
-- Expected: RLS policy blocks this
```
4. Try calling RPC again:
```sql
SELECT public.set_user_role('mechanic');
-- Expected: ERROR "Role already set. Cannot change role after initial selection."
```

- [ ] Test Case 5 passed

### Test Case 6: Invalid Role Value Rejected
**Steps:**
1. Sign up new user
2. In choose-role screen, open browser console (if web) or use direct RPC call:
```sql
SELECT public.set_user_role('admin');
-- Expected: ERROR "Invalid role: must be customer or mechanic"
```

- [ ] Test Case 6 passed

### Test Case 7: Slow Network / Race Condition
**Steps:**
1. Sign up new user
2. On choose-role screen, enable network throttling (slow 3G)
3. Select "Customer"
4. Tap "CONTINUE"
5. Verify: Loading spinner shows
6. Wait for completion
7. **Expected: Role saved correctly, navigation works**
8. Check database:
```sql
SELECT role FROM public.profiles WHERE auth_id = '<user_id>';
-- Expected: role = 'customer' (no duplicate/partial writes)
```

- [ ] Test Case 7 passed

### Test Case 8: Multiple Tabs/Devices (Race Condition)
**Steps:**
1. Sign up new user
2. Sign in on Device A and Device B simultaneously
3. On Device A: Choose "Customer", tap CONTINUE
4. On Device B: Choose "Mechanic", tap CONTINUE
5. **Expected: First request succeeds, second fails with error**
6. Verify: Only one role is set in database

- [ ] Test Case 8 passed

### Test Case 9: Existing User (Already Has Role)
**Steps:**
1. Sign in with existing user who already has role='customer'
2. **Expected: Directly navigates to customer home (skips choose-role)**
3. Sign out
4. Sign in with existing mechanic user
5. **Expected: Directly navigates to mechanic home**

- [ ] Test Case 9 passed

### Test Case 10: Auth Session Restoration
**Steps:**
1. Sign up new user, choose role
2. Force-quit app
3. Reopen app after 5 minutes
4. **Expected: Session restored, navigates to correct home screen**
5. Sign out, sign in again
6. **Expected: Navigates to correct home (role persisted)**

- [ ] Test Case 10 passed

## Error Monitoring

### Check Logs for Errors
- [ ] No errors in app logs related to role selection
- [ ] No errors in Supabase logs for `set_user_role` RPC
- [ ] No RLS policy violations in database logs

### Database Health Check
```sql
-- Users without role (should only be very recent signups)
SELECT COUNT(*), MAX(created_at) as most_recent
FROM public.profiles
WHERE role IS NULL AND deleted_at IS NULL;
-- Expected: 0 or very small number (< 5 minutes old)

-- Users with role
SELECT role, COUNT(*)
FROM public.profiles
WHERE deleted_at IS NULL
GROUP BY role;
-- Expected: Counts for 'customer', 'mechanic', and possibly NULL (recent signups)

-- Mechanic profiles match mechanic role
SELECT COUNT(*)
FROM public.profiles p
WHERE p.role = 'mechanic'
  AND NOT EXISTS (
    SELECT 1 FROM public.mechanic_profiles mp WHERE mp.id = p.auth_id
  );
-- Expected: 0 (all mechanics have mechanic_profile row)
```

- [ ] Database health checks passed

## Rollback Criteria

If ANY of these occur, consider rollback:
- [ ] More than 10% of new signups fail to complete role selection
- [ ] Users report being stuck on choose-role screen
- [ ] Database errors spike for `set_user_role` RPC
- [ ] RLS policy blocks legitimate role updates
- [ ] App crashes during role selection

## Sign-Off

- [ ] All test cases passed
- [ ] No critical errors in logs
- [ ] Database health checks passed
- [ ] Product owner approval
- [ ] Ready for production

**Tested by:** _______________  
**Date:** _______________  
**Environment:** [ ] Staging [ ] Production  
**Notes:**
