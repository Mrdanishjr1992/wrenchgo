# Profile Creation Verification Checklist

## ✅ Post-Deployment Tests

### 1. Trigger Exists
```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```
**Expected:** 1 row, `event_manipulation = 'INSERT'`, `event_object_table = 'users'`

---

### 2. Function Exists
```sql
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';
```
**Expected:** 1 row, `routine_type = 'FUNCTION'`, `security_type = 'DEFINER'`

---

### 3. No Old Triggers Remain
```sql
SELECT 
  trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_schema = 'auth'
  AND trigger_name NOT IN ('on_auth_user_created');
```
**Expected:** 0 rows

---

### 4. No Old Functions Remain
```sql
SELECT 
  routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'ensure_profile_self_heal',
    'create_profile_for_new_user',
    'ensure_profile_exists',
    'auto_create_profile'
  );
```
**Expected:** 0 rows

---

### 5. Role Column is TEXT
```sql
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'role';
```
**Expected:** `data_type = 'text'` (NOT `'USER-DEFINED'`)

---

### 6. Test Customer Signup
```javascript
// In your app or Supabase SQL Editor
const { data, error } = await supabase.auth.signUp({
  email: 'test-customer@example.com',
  password: 'test123456',
  options: {
    data: {
      role: 'customer' // or omit for default
    }
  }
});

// Then check profile was created
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', data.user.id)
  .single();

console.log(profile.role); // Should be "customer"
```

---

### 7. Test Mechanic Signup
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'test-mechanic@example.com',
  password: 'test123456',
  options: {
    data: {
      role: 'mechanic'
    }
  }
});

// Check profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', data.user.id)
  .single();

console.log(profile.role); // Should be "mechanic"
```

---

### 8. Test Invalid Role Defaults to Customer
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'test-invalid@example.com',
  password: 'test123456',
  options: {
    data: {
      role: 'admin' // Invalid role
    }
  }
});

// Check profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', data.user.id)
  .single();

console.log(profile.role); // Should be "customer" (fallback)
```

---

### 9. Check Existing Users Have Profiles
```sql
-- Find auth users without profiles
SELECT 
  u.id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
```
**Expected:** 0 rows (all users should have profiles)

**If rows exist:** These are users created before the trigger. You can backfill:
```sql
INSERT INTO public.profiles (id, role, created_at, updated_at)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'role', 'customer'),
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

---

### 10. Test Signup Failure Behavior
```sql
-- Temporarily break the trigger to test fail-fast
DROP TRIGGER on_auth_user_created ON auth.users;

-- Try to sign up (should succeed but no profile created)
-- Then restore trigger:
-- Run FINAL_PROFILE_TRIGGER.sql again

-- Verify signup now creates profile
```

---

## 🚫 Failure Modes Now IMPOSSIBLE

### ❌ Silent Profile Creation Failures
**Before:** Self-healing logic could fail silently, leaving users without profiles  
**Now:** Trigger fails = signup fails. No silent failures.

---

### ❌ Duplicate Profile Creation
**Before:** Multiple triggers or app logic could create duplicate profiles  
**Now:** Single trigger, single INSERT. Postgres enforces uniqueness via primary key.

---

### ❌ Role Enum Casting Errors
**Before:** Enum casting could fail if invalid role provided  
**Now:** TEXT with validation. Invalid roles default to "customer".

---

### ❌ Profile Creation in Multiple Places
**Before:** Triggers, RPC functions, app code all creating profiles  
**Now:** ONE trigger. ONE place. Period.

---

### ❌ Metadata Assumptions
**Before:** Logic assumed metadata structure, failed if missing  
**Now:** Simple COALESCE with default. Always works.

---

### ❌ Cascading Logic
**Before:** Profile creation triggered other logic, creating dependencies  
**Now:** Trigger does ONE thing: insert profile. Nothing else.

---

### ❌ Self-Healing Complexity
**Before:** App boot checked/created profiles, adding latency and complexity  
**Now:** No self-healing. Profile exists or doesn't. Simple.

---

## 📊 Success Criteria

- ✅ ONE trigger on `auth.users`
- ✅ ONE function `handle_new_user()`
- ✅ TEXT-based role (no enum)
- ✅ Default role is "customer"
- ✅ No self-healing logic
- ✅ No RPC profile creation
- ✅ No app-side profile creation
- ✅ Signup fails if profile creation fails (fail-fast)
- ✅ All existing users have profiles
- ✅ New signups create profiles automatically

---

## 🔄 Rollback Plan (If Needed)

If something goes wrong:

```sql
-- 1. Drop new trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Restore old trigger (if you have backup)
-- Run your previous trigger SQL

-- 3. Check all users still have profiles
SELECT COUNT(*) FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

---

## 📝 Monitoring Queries

### Check Profile Creation Rate
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as profiles_created
FROM public.profiles
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Check Role Distribution
```sql
SELECT 
  role,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.profiles
GROUP BY role;
```

### Check for Orphaned Auth Users
```sql
SELECT COUNT(*) as orphaned_users
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
```
**Expected:** 0

---

## 🎯 Final Validation

Run this comprehensive check:

```sql
-- Comprehensive validation query
WITH trigger_check AS (
  SELECT COUNT(*) as trigger_count
  FROM information_schema.triggers
  WHERE trigger_name = 'on_auth_user_created'
),
function_check AS (
  SELECT COUNT(*) as function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name = 'handle_new_user'
),
orphan_check AS (
  SELECT COUNT(*) as orphan_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
),
role_check AS (
  SELECT 
    data_type,
    CASE 
      WHEN data_type = 'text' THEN 'PASS'
      ELSE 'FAIL'
    END as status
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'role'
)
SELECT 
  t.trigger_count = 1 as trigger_exists,
  f.function_count = 1 as function_exists,
  o.orphan_count = 0 as no_orphans,
  r.status = 'PASS' as role_is_text,
  CASE 
    WHEN t.trigger_count = 1 
      AND f.function_count = 1 
      AND o.orphan_count = 0 
      AND r.status = 'PASS'
    THEN '✅ ALL CHECKS PASSED'
    ELSE '❌ SOME CHECKS FAILED'
  END as overall_status
FROM trigger_check t, function_check f, orphan_check o, role_check r;
```

**Expected Output:**
```
trigger_exists | function_exists | no_orphans | role_is_text | overall_status
---------------|-----------------|------------|--------------|------------------
true           | true            | true       | true         | ✅ ALL CHECKS PASSED
```
