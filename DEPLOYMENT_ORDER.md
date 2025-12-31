# Deployment Order for Simplified Profile System

## Step 1: Run Cleanup (Remove Old Logic)
**File:** `CLEANUP_OLD_PROFILE_LOGIC.sql`

This removes:
- Old triggers
- Old functions
- Self-healing logic
- Role enum (if exists)

**Run in:** Supabase SQL Editor

---

## Step 2: Fix Profiles Table (If Role is Enum)
**Check first:**
```sql
SELECT data_type 
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'role';
```

**If result is `USER-DEFINED`**, run this:
```sql
-- Convert role from enum to TEXT
ALTER TABLE public.profiles 
  ALTER COLUMN role TYPE TEXT;

-- Add check constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('customer', 'mechanic'));

-- Set default
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'customer';
```

**If result is `text`**, skip this step.

---

## Step 3: Deploy Final Trigger
**File:** `FINAL_PROFILE_TRIGGER.sql`

This creates:
- `handle_new_user()` function
- `on_auth_user_created` trigger

**Run in:** Supabase SQL Editor

---

## Step 4: Backfill Missing Profiles (If Any)
**Check first:**
```sql
SELECT COUNT(*) 
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

**If count > 0**, run this:
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

**If count = 0**, skip this step.

---

## Step 5: Verify Deployment
**File:** `VERIFICATION_CHECKLIST.md`

Run the comprehensive validation query:
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

**Expected:** `✅ ALL CHECKS PASSED`

---

## Step 6: Test Signup Flow
**Test customer signup:**
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'test-customer@example.com',
  password: 'test123456'
});

// Check profile created
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', data.user.id)
  .single();

console.log(profile.role); // Should be "customer"
```

**Test mechanic signup:**
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'test-mechanic@example.com',
  password: 'test123456',
  options: {
    data: { role: 'mechanic' }
  }
});

// Check profile created
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', data.user.id)
  .single();

console.log(profile.role); // Should be "mechanic"
```

---

## ✅ Deployment Complete

Your profile creation system is now:
- ✅ Simplified (ONE trigger, ONE function)
- ✅ Reliable (fail-fast, no silent failures)
- ✅ Predictable (TEXT role, default fallback)
- ✅ Maintainable (no self-healing, no cascading logic)

---

## 📁 Files Created

1. **FINAL_PROFILE_TRIGGER.sql** - Deploy this (Step 3)
2. **CLEANUP_OLD_PROFILE_LOGIC.sql** - Run first (Step 1)
3. **PROFILES_TABLE_SPEC.md** - Reference for table structure
4. **VERIFICATION_CHECKLIST.md** - Post-deployment tests
5. **DEPLOYMENT_ORDER.md** - This file

---

## 🔄 Rollback (If Needed)

```sql
-- Drop new trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Restore from backup (if you have one)
```

---

## 📞 Support

If issues arise:
1. Check Supabase logs for trigger errors
2. Run verification queries from `VERIFICATION_CHECKLIST.md`
3. Check for orphaned users (auth.users without profiles)
4. Verify role column is TEXT (not enum)
