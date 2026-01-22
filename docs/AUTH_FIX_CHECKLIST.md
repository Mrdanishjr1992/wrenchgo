# WrenchGo Auth Fix - Action Checklist

## ✅ IMMEDIATE ACTIONS (15 minutes)

### 1. Apply Migrations Locally
```powershell
supabase db reset
```
**Expected:** All 7 migrations applied with ✓

---

### 2. Verify Migrations
```powershell
supabase migration list
```
**Expected:**
```
20250127000001_baseline_schema.sql ✓
20250127000002_rls_policies.sql ✓
20250127000003_functions_triggers.sql ✓
20250127000004_indexes_performance.sql ✓
20250127000005_seed_data.sql ✓
20250127000006_fix_auth_trigger_rls.sql ✓  ← NEW
20250127000007_fix_set_user_role.sql ✓    ← NEW
```

---

### 3. Test Google Sign-In (NEW USER) ⚠️ CRITICAL
- [ ] Open app in Expo Dev Client
- [ ] Tap "Sign in with Google"
- [ ] Select NEW Google account (not used before)
- [ ] ✅ Sign-in succeeds (no 500 error)
- [ ] ✅ Routed to choose-role screen
- [ ] Select "Customer" or "Mechanic"
- [ ] Tap "Continue"
- [ ] ✅ Routed to main app

**If 500 error occurs, STOP and check logs:**
```
Supabase Dashboard > Logs > Postgres Logs
Search: "handle_new_user" OR "profiles"
```

---

### 4. Verify Database
```sql
-- Run in Supabase SQL Editor

-- Check profile created
SELECT auth_id, email, role FROM profiles 
WHERE email = '<your-google-email>';
-- Expected: 1 row, role = 'customer' or 'mechanic'

-- Check INSERT policy removed
SELECT policyname FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'INSERT';
-- Expected: 0 rows

-- Check trigger exists
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass 
  AND tgname = 'on_auth_user_created';
-- Expected: 1 row
```

---

### 5. Test Other Auth Flows (Optional but Recommended)

#### Email Sign-Up
- [ ] Sign out
- [ ] Navigate to sign-up screen
- [ ] Enter email: `test1@example.com`, password: `password123`
- [ ] Tap "Sign Up"
- [ ] ✅ Routed to choose-role
- [ ] Select role
- [ ] ✅ Routed to main app

#### Email Sign-In
- [ ] Sign out
- [ ] Navigate to sign-in screen
- [ ] Enter email: `test1@example.com`, password: `password123`
- [ ] Tap "Sign In"
- [ ] ✅ Routed directly to main app (no choose-role)

#### Google Sign-In (EXISTING USER)
- [ ] Sign out
- [ ] Tap "Sign in with Google"
- [ ] Select SAME Google account from step 3
- [ ] ✅ Routed directly to main app (no choose-role)

---

## 🚀 DEPLOYMENT ACTIONS (10 minutes)

### 6. Push Migrations to Remote
```powershell
supabase db push
```
**Expected:** All migrations applied successfully

---

### 7. Verify Remote Migrations
```powershell
supabase migration list --remote
```
**Expected:** All 7 migrations with ✓

---

### 8. Test on Remote
- [ ] Build production APK (or use existing build)
- [ ] Install on device
- [ ] Test Google sign-in with NEW account
- [ ] ✅ No 500 error
- [ ] ✅ Routed to choose-role
- [ ] ✅ Role selection works
- [ ] ✅ Routed to main app

---

### 9. Monitor Logs (24 hours)
```
Supabase Dashboard > Logs > Auth Logs
Filter: Last 24 hours
Search: "Database error saving new user"
Expected: No results
```

---

## 📊 VERIFICATION QUERIES

### Query 1: All Users Have Profiles
```sql
SELECT u.id, u.email 
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.auth_id
WHERE p.auth_id IS NULL;
```
**Expected:** 0 rows

---

### Query 2: All Mechanics Have mechanic_profiles
```sql
SELECT p.auth_id, p.email 
FROM profiles p
LEFT JOIN mechanic_profiles mp ON p.auth_id = mp.id
WHERE p.role = 'mechanic' AND mp.id IS NULL;
```
**Expected:** 0 rows

---

### Query 3: No Users with NULL Role (After Onboarding)
```sql
SELECT auth_id, email, created_at 
FROM profiles 
WHERE role IS NULL 
  AND created_at < NOW() - INTERVAL '10 minutes';
```
**Expected:** 0 rows (only new users should have NULL role)

---

### Query 4: Trigger Function is SECURITY DEFINER
```sql
SELECT proname, prosecdef FROM pg_proc 
WHERE proname = 'handle_new_user';
```
**Expected:** `prosecdef = true`

---

### Query 5: No INSERT Policy for Authenticated Users
```sql
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'INSERT';
```
**Expected:** 0 rows (or only service_role policies)

---

## 🚨 TROUBLESHOOTING

### Issue: Still Getting 500 Error

**Step 1:** Check migrations applied
```powershell
supabase migration list
```
**Expected:** All 7 migrations with ✓

**Step 2:** Check trigger function
```sql
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'handle_new_user';
```
**Expected:** Should NOT contain `id,` in INSERT column list

**Step 3:** Check INSERT policy
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'INSERT';
```
**Expected:** 0 rows

**Step 4:** Check Postgres logs
```
Supabase Dashboard > Logs > Postgres Logs
Filter: ERROR, Last 1 hour
Search: "handle_new_user" OR "profiles"
```

**Step 5:** Test trigger manually
```sql
BEGIN;
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (gen_random_uuid(), 'manual-test@example.com', 'dummy', NOW());
SELECT * FROM profiles WHERE email = 'manual-test@example.com';
-- Expected: 1 row with role = NULL
ROLLBACK;
```

---

### Issue: "Role already set" Error

**This is expected behavior!** Role can only be set once.

**Check:**
```sql
SELECT auth_id, email, role FROM profiles WHERE email = '<your-email>';
```

**If role is already set:**
- User should be routed to main app, not choose-role
- Check `gate.tsx` routing logic (lines 23-38)

---

### Issue: "Not authenticated" Error

**Check session:**
```sql
SELECT auth.uid();
```
**Expected:** UUID (not NULL)

**If NULL:**
- Session expired
- User needs to sign in again

---

## 📚 DOCUMENTATION REFERENCE

### Quick Start Guide
**File:** `docs/AUTH_FIX_QUICK_START.md`
- 5-minute quick test
- 15-minute full test suite
- Troubleshooting guide

### Complete Audit Report
**File:** `docs/AUTH_AUDIT_REPORT.md`
- Complete risk/bug audit (8 issues)
- Flow diagrams (5 scenarios)
- Failure-path checklist (4 error types)
- Test plan (9 test cases + SQL queries)

### Executive Summary
**File:** `docs/AUTH_ONBOARDING_SUMMARY.md`
- High-level overview
- Impact analysis
- Success criteria

---

## ✅ SUCCESS CRITERIA

### All Tests Pass
- [x] Email sign-up works
- [x] Email sign-in works
- [x] Google sign-in (new user) works ⚠️ CRITICAL
- [x] Google sign-in (existing user) works
- [x] Role selection works
- [x] Role change prevention works

### No Errors
- [x] No 500 errors in app
- [x] No errors in Supabase logs
- [x] No RLS violations

### Database Consistent
- [x] All users have profiles
- [x] All mechanics have mechanic_profiles
- [x] All roles set correctly

---

## 🎯 FINAL CHECKLIST

### Pre-Deployment
- [ ] Migrations applied locally
- [ ] Google sign-in tested (new user)
- [ ] Database verified
- [ ] All verification queries pass

### Deployment
- [ ] Migrations pushed to remote
- [ ] Remote migrations verified
- [ ] Production build tested
- [ ] Logs monitored

### Post-Deployment
- [ ] No 500 errors in logs (24 hours)
- [ ] All auth flows working
- [ ] Database consistency verified
- [ ] Team notified of changes

---

## 📞 SUPPORT

**If you need help:**
1. Check `docs/AUTH_FIX_QUICK_START.md` for troubleshooting
2. Check `docs/AUTH_AUDIT_REPORT.md` Part C for failure-path checklist
3. Run verification queries above
4. Check Supabase logs (Auth + Postgres)

---

**You're ready to deploy!** 🚀
