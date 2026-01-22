# MIGRATION VERIFICATION CHECKLIST

## Overview
This document provides step-by-step verification for the clean migration setup.

## Pre-Migration Checklist
- [ ] Backup existing database (if production)
- [ ] Ensure Supabase CLI is installed: `supabase --version`
- [ ] Ensure project is linked: `supabase link --project-ref YOUR_PROJECT_REF`
- [ ] Review all 8 migration files in `supabase/migrations/`

## Migration Files (in order)
1. `20250212000001_extensions_enums.sql` - Extensions and enums
2. `20250212000002_core_tables.sql` - Core tables (profiles, jobs, vehicles, reviews, quote_requests)
3. `20250212000003_mechanic_symptom_tables.sql` - Mechanic and symptom tables
4. `20250212000004_messaging_media.sql` - Messages, notifications, media_assets
5. `20250212000005_payments_stripe.sql` - Stripe and payment tables
6. `20250212000006_functions_triggers.sql` - Functions and triggers
7. `20250212000007_rls_grants.sql` - RLS policies and grants
8. `20250212000008_seed_data.sql` - Symptom seed data

## Step 1: Reset and Push Migrations

```bash
# Reset the database (WARNING: This deletes all data)
supabase db reset

# Or push to remote without reset
supabase db push
```

Expected output:
- All 8 migrations should apply successfully
- No errors about missing tables or columns

## Step 2: Verify Schema in Supabase Dashboard

### Tables to verify exist:
- [ ] `public.profiles` (with columns: id, email, full_name, phone, avatar_url, role, theme_preference, **city**, home_lat, home_lng)
- [ ] `public.jobs` (with column: **preferred_time**)
- [ ] `public.notifications` (with columns: **type**, **entity_type**, **entity_id**, data)
- [ ] `public.media_assets` (with columns: **key**, **public_url**, storage_path)
- [ ] `public.symptoms` (master symptom list)
- [ ] `public.symptom_mappings` (detailed symptom info)
- [ ] `public.mechanic_profiles`
- [ ] `public.vehicles`
- [ ] `public.quote_requests`
- [ ] `public.reviews`
- [ ] `public.messages`
- [ ] `public.mechanic_skills`
- [ ] `public.mechanic_tools`
- [ ] `public.mechanic_safety`
- [ ] `public.mechanic_stripe_accounts`
- [ ] `public.customer_payment_methods`
- [ ] `public.payments`

### Functions to verify exist:
- [ ] `public.handle_new_user()` - Auto-creates profile on Google sign-in
- [ ] `public.set_user_role(new_role)` - Allows user to set role once
- [ ] `public.get_mechanic_leads(...)` - Returns job leads for mechanics
- [ ] `public.update_mechanic_rating()` - Updates mechanic rating
- [ ] `public.increment_mechanic_job_count()` - Increments job count
- [ ] `public.update_updated_at_column()` - Generic updated_at trigger

## Step 3: Test SQL Queries

Run these queries in Supabase SQL Editor:

### Test 1: Check symptom data exists
```sql
SELECT COUNT(*) FROM public.symptoms;
-- Expected: 15 rows

SELECT COUNT(*) FROM public.symptom_mappings;
-- Expected: 15 rows
```

### Test 2: Check get_mechanic_leads function signature
```sql
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'get_mechanic_leads';
```

Expected arguments:
```
p_mechanic_id uuid, p_filter text, p_mechanic_lat numeric DEFAULT NULL, p_mechanic_lng numeric DEFAULT NULL, p_radius_miles numeric DEFAULT 25, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_sort_by text DEFAULT 'newest'
```

### Test 3: Check RLS is enabled
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'jobs', 'notifications', 'media_assets')
ORDER BY tablename;
```

Expected: All tables should have `rowsecurity = true`

### Test 4: Check table ownership (for SECURITY DEFINER functions)
```sql
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'mechanic_profiles')
ORDER BY tablename;
```

Expected: Both should be owned by `postgres`

### Test 5: Check grants
```sql
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'media_assets'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
```

Expected:
- `anon` should have `SELECT`
- `authenticated` should have `SELECT, INSERT, UPDATE, DELETE`

## Step 4: Test App Flows

### Test 1: Google Sign-In
1. Open app: `npx expo start -c`
2. Sign in with Google
3. Check logs for: `✅ Google sign-in successful`
4. Verify profile is created in `public.profiles`

**Expected behavior:**
- No "permission denied for table profiles" error
- Profile row created with `id = auth.users.id`
- `role` is NULL initially

### Test 2: Role Selection
1. After sign-in, choose role (customer or mechanic)
2. Check logs for successful role update
3. Verify in database: `SELECT id, role FROM public.profiles WHERE email = 'your@email.com';`

**Expected behavior:**
- Role is set to 'customer' or 'mechanic'
- If mechanic, `mechanic_profiles` row is auto-created
- No "Role already set to postgres" error

### Test 3: Symptoms Loading
1. Navigate to job creation screen
2. Check symptoms list loads

**Expected behavior:**
- No "Could not find table symptom_mappings" error
- 15 symptoms displayed with icons
- Symptoms sorted by risk level (high → medium → low)

### Test 4: Media Assets
1. Navigate to home screen (should show ads)
2. Check logs for media asset queries

**Expected behavior:**
- No "column media_assets.public_url does not exist" error
- No "column media_assets.key does not exist" error
- Public assets (ads) load for anon users

### Test 5: Notifications
1. Trigger a notification (e.g., receive a quote)
2. Check notifications screen

**Expected behavior:**
- No "column notifications.type does not exist" error
- Notifications display correctly

### Test 6: Jobs with Preferred Time
1. Create a new job
2. Set preferred time (e.g., "Morning")
3. Save job

**Expected behavior:**
- No "column jobs.preferred_time does not exist" error
- Job saves successfully with preferred_time

### Test 7: Mechanic Leads (for mechanics only)
1. Sign in as mechanic
2. Navigate to leads screen
3. Check leads load

**Expected behavior:**
- No "Could not find function get_mechanic_leads" error
- Leads display with distance, quote count, etc.
- Filtering (all/new/quoted/nearby) works
- Sorting (newest/oldest/distance) works

## Step 5: Check for Common Errors

Run app and check logs for these errors (should NOT appear):

- ❌ `permission denied for table profiles`
- ❌ `Could not find the function public.set_user_role`
- ❌ `Could not find the function public.get_mechanic_leads`
- ❌ `column media_assets.public_url does not exist`
- ❌ `column media_assets.key does not exist`
- ❌ `column notifications.type does not exist`
- ❌ `column jobs.preferred_time does not exist`
- ❌ `Could not find tables in schema cache: public.symptom_mappings`
- ❌ `Could not find tables in schema cache: public.symptom_education`

## Step 6: Storage Bucket Setup (Manual)

See `STORAGE_SETUP.md` for instructions to create the `media` storage bucket.

This is required for:
- User avatar uploads
- Job photo uploads
- Public ad assets

## Troubleshooting

### Issue: "permission denied for table profiles" during Google sign-in

**Cause:** `handle_new_user` trigger not working or RLS blocking insert

**Fix:**
1. Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
2. Check function owner: `SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE proname = 'handle_new_user';`
3. Should be owned by `postgres`

### Issue: "Could not find function get_mechanic_leads"

**Cause:** Function not created or wrong signature

**Fix:**
1. Check function exists: `SELECT * FROM pg_proc WHERE proname = 'get_mechanic_leads';`
2. Check signature matches app call (8 parameters)
3. Re-run migration 6 if needed

### Issue: "column does not exist" errors

**Cause:** Migration didn't apply or column name mismatch

**Fix:**
1. Check table schema: `\d public.TABLE_NAME` in psql
2. Verify column exists in migration file
3. Re-run `supabase db reset` if needed

### Issue: Symptoms not loading

**Cause:** Seed data not inserted

**Fix:**
1. Check row count: `SELECT COUNT(*) FROM public.symptoms;`
2. Should be 15 rows
3. Re-run migration 8 if needed

## Success Criteria

✅ All 8 migrations applied without errors
✅ All tables exist with correct columns
✅ All functions exist with correct signatures
✅ RLS is enabled on all tables
✅ Google sign-in creates profile successfully
✅ Role selection works (customer/mechanic)
✅ Symptoms load in app
✅ Media assets queries work
✅ Notifications work
✅ Jobs with preferred_time work
✅ Mechanic leads RPC works
✅ No schema cache errors in app logs

## Post-Migration Cleanup

After successful verification:

1. Delete backup migrations: `rm -rf supabase/migrations_backup_20250212/`
2. Delete temporary fix files: `rm HOTFIX_*.sql TEMP_*.sql FIX_*.sql RESTORE_*.sql`
3. Delete old documentation: `rm CRITICAL_FIXES_*.md QUICK_FIX_*.md RLS_*.md`
4. Commit clean migrations to git

## Summary

This migration setup provides:
- ✅ Clean, production-ready schema
- ✅ All missing columns added (preferred_time, type, entity_type, entity_id, city, key, public_url)
- ✅ Symptom tables with seed data
- ✅ get_mechanic_leads RPC function
- ✅ Fixed RLS policies for Google sign-in
- ✅ Proper table ownership for SECURITY DEFINER functions
- ✅ Comprehensive grants and policies
- ✅ Updated_at triggers on all tables
- ✅ Rating and job count auto-updates

The app should now work end-to-end without runtime errors.
