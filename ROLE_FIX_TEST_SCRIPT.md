# Role Selection Fix - Manual Test Script

## Prerequisites
- [ ] Database migration deployed
- [ ] App code deployed
- [ ] Test device/emulator ready
- [ ] Database access for verification queries

---

## Test 1: New User - Customer Role (Happy Path)

### Steps
1. **Open app** (not signed in)
2. **Tap "Sign Up"**
3. **Fill in:**
   - Name: `Test Customer`
   - Email: `testcustomer@example.com`
   - Password: `password123`
4. **Tap "CREATE ACCOUNT"**
5. **Verify:** Alert shows "Account created"
6. **Tap "SIGN IN"**
7. **Enter credentials and sign in**

### Expected Results
- ✅ **Redirected to "Choose your role" screen**
- ✅ **No role is pre-selected** (both cards are unselected)
- ✅ **"CONTINUE" button is disabled** (grayed out)

### Continue
8. **Tap "Customer" card**
9. **Verify:** Customer card shows "Selected" with filled radio button
10. **Verify:** "CONTINUE" button is now enabled
11. **Tap "CONTINUE"**

### Expected Results
- ✅ **Navigates to customer home screen** `/(customer)/(tabs)`
- ✅ **No errors in console**

### Persistence Test
12. **Close app completely**
13. **Reopen app**

### Expected Results
- ✅ **Still on customer home screen** (role persisted)
- ✅ **Does NOT show choose-role screen again**

### Database Verification
```sql
SELECT auth_id, role, full_name, created_at
FROM public.profiles
WHERE full_name = 'Test Customer';
```
**Expected:** `role = 'customer'`

**Status:** [ ] PASS [ ] FAIL  
**Notes:** _______________

---

## Test 2: New User - Mechanic Role

### Steps
1. **Sign up new user:**
   - Name: `Test Mechanic`
   - Email: `testmechanic@example.com`
   - Password: `password123`
2. **Sign in**
3. **On "Choose your role" screen, tap "Mechanic"**
4. **Tap "CONTINUE"**

### Expected Results
- ✅ **Navigates to mechanic home screen** `/(mechanic)/(tabs)/leads`
- ✅ **No errors**

### Database Verification
```sql
SELECT p.auth_id, p.role, mp.id as mechanic_profile_id
FROM public.profiles p
LEFT JOIN public.mechanic_profiles mp ON mp.id = p.auth_id
WHERE p.full_name = 'Test Mechanic';
```
**Expected:** 
- `role = 'mechanic'`
- `mechanic_profile_id` is NOT NULL

**Status:** [ ] PASS [ ] FAIL  
**Notes:** _______________

---

## Test 3: Role Selection is Required (No Default)

### Steps
1. **Sign up new user:**
   - Name: `Test NoDefault`
   - Email: `testnodefault@example.com`
   - Password: `password123`
2. **Sign in**
3. **On "Choose your role" screen:**
   - **Verify:** Neither card is selected
   - **Verify:** "CONTINUE" button is disabled
   - **Try tapping "CONTINUE"** (should do nothing)
4. **Select "Customer"**
5. **Verify:** Button becomes enabled

### Expected Results
- ✅ **No role is pre-selected**
- ✅ **Button is disabled until role chosen**
- ✅ **Button enables after selection**

**Status:** [ ] PASS [ ] FAIL  
**Notes:** _______________

---

## Test 4: Back Button / App Reload Before Role Chosen

### Steps
1. **Sign up new user:**
   - Name: `Test Reload`
   - Email: `testreload@example.com`
   - Password: `password123`
2. **Sign in**
3. **On "Choose your role" screen, close app** (don't choose role)
4. **Reopen app**

### Expected Results
- ✅ **Redirected back to "Choose your role" screen**
- ✅ **No role is pre-selected**

### Continue
5. **Choose "Customer"**
6. **Tap "CONTINUE"**

### Expected Results
- ✅ **Navigation works correctly**
- ✅ **Lands on customer home**

**Status:** [ ] PASS [ ] FAIL  
**Notes:** _______________

---

## Test 5: Cannot Change Role After Selection

### Steps
1. **Sign up new user:**
   - Name: `Test NoChange`
   - Email: `testnochange@example.com`
   - Password: `password123`
2. **Sign in, choose "Customer"**
3. **Navigate to customer home**
4. **In database, get user ID:**
```sql
SELECT auth_id FROM public.profiles WHERE full_name = 'Test NoChange';
```
5. **Try to call RPC to change role:**
```sql
-- First, set the auth context (replace with actual user ID)
SELECT set_config('request.jwt.claims', '{"sub":"<user_id>"}', true);

-- Try to change role
SELECT public.set_user_role('mechanic');
```

### Expected Results
- ✅ **ERROR:** "Role already set. Cannot change role after initial selection."

**Status:** [ ] PASS [ ] FAIL  
**Notes:** _______________

---

## Test 6: Invalid Role Value Rejected

### Steps
1. **Sign up new user:**
   - Name: `Test Invalid`
   - Email: `testinvalid@example.com`
   - Password: `password123`
2. **Sign in**
3. **In database, get user ID and try invalid role:**
```sql
SELECT auth_id FROM public.profiles WHERE full_name = 'Test Invalid';

-- Set auth context
SELECT set_config('request.jwt.claims', '{"sub":"<user_id>"}', true);

-- Try invalid role
SELECT public.set_user_role('admin');
```

### Expected Results
- ✅ **ERROR:** "Invalid role: must be customer or mechanic"

**Status:** [ ] PASS [ ] FAIL  
**Notes:** _______________

---

## Test 7: Slow Network (Simulated)

### Steps
1. **Enable network throttling** (Chrome DevTools: Slow 3G)
2. **Sign up new user:**
   - Name: `Test Slow`
   - Email: `testslow@example.com`
   - Password: `password123`
3. **Sign in**
4. **On "Choose your role" screen, select "Customer"**
5. **Tap "CONTINUE"**

### Expected Results
- ✅ **Loading spinner shows**
- ✅ **Wait for completion (may take 10-30 seconds)**
- ✅ **Eventually navigates to customer home**
- ✅ **No errors**

### Database Verification
```sql
SELECT role FROM public.profiles WHERE full_name = 'Test Slow';
```
**Expected:** `role = 'customer'` (no duplicate/partial writes)

**Status:** [ ] PASS [ ] FAIL  
**Notes:** _______________

---

## Test 8: Existing User (Already Has Role)

### Steps
1. **Use existing user from Test 1** (`testcustomer@example.com`)
2. **Sign out**
3. **Sign in again**

### Expected Results
- ✅ **Directly navigates to customer home**
- ✅ **Does NOT show choose-role screen**

### Repeat for Mechanic
4. **Sign out**
5. **Sign in with mechanic user** (`testmechanic@example.com`)

### Expected Results
- ✅ **Directly navigates to mechanic home**
- ✅ **Skips choose-role screen**

**Status:** [ ] PASS [ ] FAIL  
**Notes:** _______________

---

## Test 9: Auth Session Restoration

### Steps
1. **Sign up new user, choose role**
2. **Force-quit app** (swipe away from recent apps)
3. **Wait 5 minutes**
4. **Reopen app**

### Expected Results
- ✅ **Session restored automatically**
- ✅ **Navigates to correct home screen**
- ✅ **No need to sign in again**

**Status:** [ ] PASS [ ] FAIL  
**Notes:** _______________

---

## Test 10: Database Health Check

### Run These Queries

```sql
-- 1. Users without role (should only be very recent signups)
SELECT COUNT(*), MAX(created_at) as most_recent
FROM public.profiles
WHERE role IS NULL AND deleted_at IS NULL;
```
**Expected:** 0 or very small number (< 5 minutes old)

```sql
-- 2. Users with role distribution
SELECT role, COUNT(*)
FROM public.profiles
WHERE deleted_at IS NULL
GROUP BY role;
```
**Expected:** Counts for 'customer', 'mechanic', and possibly NULL

```sql
-- 3. Mechanic profiles match mechanic role
SELECT COUNT(*)
FROM public.profiles p
WHERE p.role = 'mechanic'
  AND NOT EXISTS (
    SELECT 1 FROM public.mechanic_profiles mp WHERE mp.id = p.auth_id
  );
```
**Expected:** 0 (all mechanics have mechanic_profile row)

```sql
-- 4. Check RPC function exists
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'set_user_role';
```
**Expected:** 1 row with function definition

```sql
-- 5. Check RLS policy exists
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles' AND policyname LIKE '%role%null%';
```
**Expected:** Policy allowing UPDATE when role IS NULL

**Status:** [ ] PASS [ ] FAIL  
**Notes:** _______________

---

## Summary

**Total Tests:** 10  
**Passed:** _____ / 10  
**Failed:** _____ / 10  

**Critical Issues Found:**
- [ ] None
- [ ] List issues here: _______________

**Tested By:** _______________  
**Date:** _______________  
**Environment:** [ ] Local [ ] Staging [ ] Production  

**Recommendation:**
- [ ] ✅ Ready for production
- [ ] ⚠️ Minor issues, can deploy with monitoring
- [ ] ❌ Critical issues, do not deploy

**Notes:**
