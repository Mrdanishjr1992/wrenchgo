# WrenchGo Migration Verification Checklist

Run these SQL queries in Supabase SQL Editor after `supabase db push` to verify everything is correct.

## 1. Verify Extensions and Enums

```sql
-- Check extensions
SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_trgm');

-- Check enums
SELECT typname FROM pg_type WHERE typname IN ('user_role', 'job_status', 'quote_status', 'payment_status', 'theme_mode');
```

**Expected:** All 3 extensions and 5 enums should exist.

---

## 2. Verify Core Tables Exist

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected tables:**
- profiles, vehicles, jobs, quote_requests, reviews
- mechanic_profiles, mechanic_skills, mechanic_tools, mechanic_safety
- messages, notifications, media_assets
- mechanic_stripe_accounts, customer_payment_methods, payments, webhook_events

---

## 3. Verify profiles.id == auth.users.id (Identity Model)

```sql
-- Check profiles primary key references auth.users
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'profiles'
  AND kcu.column_name = 'id';
```

**Expected:** profiles.id → auth.users.id foreign key exists.

---

## 4. Verify media_assets Has Required Columns

```sql
-- Check media_assets columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'media_assets'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id`, `key`, `bucket`, `storage_path`, `public_url`, `content_type`, `size_bytes`, `duration_seconds`, `uploaded_by`, `job_id`, `deleted_at`, `created_at`, `updated_at`

---

## 5. Verify Foreign Key Relationships (Schema Cache)

```sql
-- Check all foreign keys to profiles.id
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'profiles'
  AND ccu.column_name = 'id'
ORDER BY tc.table_name, kcu.column_name;
```

**Expected:** 19 relationships to profiles.id

---

## 6. Verify NO ID Verification Artifacts

```sql
-- Check for any id_verification columns (should return 0 rows)
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name LIKE '%id_verif%' OR column_name LIKE '%id_photo%');

-- Check for any id_verification functions (should return 0 rows)
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%id_verif%' OR routine_name LIKE '%id_photo%');

-- Check for any id_verification triggers (should return 0 rows)
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%id_verif%' OR trigger_name LIKE '%id_photo%');
```

**Expected:** All queries return 0 rows.

---

## 7. Verify RLS is Enabled

```sql
-- Check RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'vehicles', 'jobs', 'quote_requests', 'reviews',
    'mechanic_profiles', 'mechanic_skills', 'mechanic_tools', 'mechanic_safety',
    'messages', 'notifications', 'media_assets',
    'mechanic_stripe_accounts', 'customer_payment_methods', 'payments', 'webhook_events'
  )
ORDER BY tablename;
```

**Expected:** `rowsecurity` = `true` for all tables.

---

## 8. Verify RLS Policies Exist

```sql
-- Count policies per table
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

**Expected:** Each table should have at least 1 policy.

---

## 9. Verify Triggers Exist

```sql
-- Check critical triggers
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

**Expected triggers:**
- `on_auth_user_created` on `auth.users` (AFTER INSERT)
- `set_updated_at` on multiple tables (BEFORE UPDATE)
- `update_mechanic_rating_trigger` on `reviews`
- `increment_mechanic_job_count_trigger` on `jobs`

---

## 10. Verify Functions Exist (INCLUDING set_user_role)

```sql
-- Check critical functions
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'handle_new_user',
    'set_user_role',
    'update_updated_at_column',
    'update_mechanic_rating',
    'increment_mechanic_job_count'
  )
ORDER BY routine_name;
```

**Expected:**
- `handle_new_user` (FUNCTION, DEFINER) ✅ SECURITY DEFINER is critical
- `set_user_role` (FUNCTION, DEFINER) ✅ SECURITY DEFINER is critical
- `update_updated_at_column` (FUNCTION)
- `update_mechanic_rating` (FUNCTION, DEFINER)
- `increment_mechanic_job_count` (FUNCTION, DEFINER)

---

## 11. Verify Grants (INCLUDING anon for media_assets)

```sql
-- Check table privileges for authenticated role
SELECT 
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND table_name IN ('profiles', 'jobs', 'media_assets', 'messages')
ORDER BY table_name, privilege_type;

-- Check anon role has SELECT on media_assets (CRITICAL FIX)
SELECT 
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND table_name = 'media_assets';
```

**Expected:** 
- authenticated role should have SELECT, INSERT, UPDATE, DELETE on most tables
- **anon role should have SELECT on media_assets** ✅ Critical for public assets

---

## 12. Test Google Sign-In Flow (Simulated)

```sql
-- Check if handle_new_user function exists and is SECURITY DEFINER
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- Check if trigger exists
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'on_auth_user_created';
```

**Expected:** Both exist with correct settings.

---

## 13. Verify theme_preference Column

```sql
-- Check theme_preference exists on profiles
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'theme_preference';
```

**Expected:** Column exists with type `USER-DEFINED` (theme_mode enum), default `'system'::theme_mode`

---

## 14. Test set_user_role Function (NEW)

```sql
-- Verify function signature
SELECT 
  routine_name,
  routine_type,
  security_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'set_user_role';
```

**Expected:**
- routine_name: `set_user_role`
- routine_type: `FUNCTION`
- security_type: `DEFINER` ✅ Critical
- data_type: `void`

---

## 15. Test Media Asset Public Access (NEW)

```sql
-- Test that public assets are accessible (simulate anon access)
SET ROLE anon;
SELECT key, public_url
FROM public.media_assets
WHERE key IN ('wrenchgo_ad_1', 'logo_video');
RESET ROLE;
```

**Expected:** Returns rows without permission denied error.

---

## Summary Checklist

- [ ] All extensions installed (uuid-ossp, pgcrypto, pg_trgm)
- [ ] All enums created (user_role, job_status, quote_status, payment_status, theme_mode)
- [ ] All 16 tables exist
- [ ] profiles.id references auth.users.id
- [ ] media_assets has key, bucket, storage_path, public_url, content_type, size_bytes, duration_seconds
- [ ] All foreign keys to profiles.id exist (19 relationships)
- [ ] NO id_verification artifacts (columns, functions, triggers)
- [ ] RLS enabled on all tables
- [ ] RLS policies exist and are correct
- [ ] handle_new_user trigger exists with SECURITY DEFINER
- [ ] **set_user_role function exists with SECURITY DEFINER** ✅ NEW
- [ ] updated_at triggers exist on all tables
- [ ] Grants exist for authenticated role
- [ ] **anon role has SELECT on media_assets** ✅ NEW
- [ ] theme_preference column exists on profiles
- [ ] Google sign-in creates profile without "permission denied"
- [ ] Media assets accessible without "column does not exist" errors
- [ ] **Public media assets accessible without authentication** ✅ NEW
- [ ] **Role selection works without "function not found" error** ✅ NEW

---

## Deployment Commands

```bash
# Reset remote database (DESTRUCTIVE - deletes all data)
supabase db reset --db-url "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# OR reset local and push
supabase db reset
supabase db push

# Verify migrations applied
supabase migration list
```

---

## Troubleshooting

### "permission denied for table profiles"
- Check RLS policies exist
- Check grants for authenticated role
- Verify handle_new_user is SECURITY DEFINER

### "permission denied for table media_assets"
- **Check anon role has SELECT grant** ✅ NEW FIX
- Check RLS policy allows public assets (job_id IS NULL AND uploaded_by IS NULL)

### "Could not find the function public.set_user_role"
- **Verify set_user_role function exists** ✅ NEW FIX
- Check function is SECURITY DEFINER
- Re-apply migration 6 if missing

### "column does not exist"
- Run column verification queries
- Check migration files were applied in order

### "Could not find relationship"
- Run foreign key verification query
- Ensure `supabase db push` completed without errors
- Restart Supabase Studio to refresh schema cache
