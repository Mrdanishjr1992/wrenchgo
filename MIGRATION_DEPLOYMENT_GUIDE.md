# Migration Restructure - Deployment Guide

## 📋 Overview

This guide walks you through replacing 58+ fragmented migrations with 5 clean, reset-safe migration files.

**New Structure:**
```
supabase/migrations/
├── 20250127000001_baseline_schema.sql      # Tables, types, FKs
├── 20250127000002_rls_policies.sql         # Row-level security
├── 20250127000003_functions_triggers.sql   # Functions, triggers, RPCs
├── 20250127000004_indexes_performance.sql  # Indexes, constraints
└── 20250127000005_seed_data.sql            # Lookup table data
```

**Benefits:**
- ✅ Reset-safe (proper dependency ordering)
- ✅ Role fix integrated (no default role)
- ✅ Idempotent seed data
- ✅ Easy to maintain and debug
- ✅ Clear separation of concerns

---

## ⚠️ CRITICAL: Before You Start

### 1. Backup Your Database

```powershell
# Full database backup
supabase db dump -f "backup_before_restructure_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Verify backup file exists and has content
Get-Item backup_before_restructure_*.sql | Select-Object Name, Length
```

### 2. Archive Old Migrations

```powershell
# Create archive directory
$archiveDir = "supabase/migrations/archive_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $archiveDir -Force

# Move all old migrations
Move-Item -Path "supabase/migrations/*.sql" -Destination $archiveDir -ErrorAction SilentlyContinue

# Verify only 5 new files remain
Get-ChildItem supabase/migrations/*.sql | Measure-Object
# Expected: Count = 5
```

### 3. Complete Seed Data

**IMPORTANT:** The file `20250127000005_seed_data.sql` has TODO placeholders for:
- `symptoms` (100 rows)
- `symptom_mappings` (100 rows)
- `symptom_questions` (your data)
- `symptom_refinements` (your data)
- `education_cards` (your data)

**You must paste your full seed data before deploying!**

---

## 🚀 Deployment Steps

### Step 1: Verify Migration Files

```powershell
# Check all 5 files exist
$files = @(
  "20250127000001_baseline_schema.sql",
  "20250127000002_rls_policies.sql",
  "20250127000003_functions_triggers.sql",
  "20250127000004_indexes_performance.sql",
  "20250127000005_seed_data.sql"
)

foreach ($file in $files) {
  $path = "supabase/migrations/$file"
  if (Test-Path $path) {
    Write-Host "✅ $file exists" -ForegroundColor Green
  } else {
    Write-Host "❌ $file MISSING!" -ForegroundColor Red
  }
}
```

### Step 2: Test Locally (RECOMMENDED)

```powershell
# Reset local database
supabase db reset

# Check for errors
# Expected: No errors, all migrations applied successfully

# Verify tables created
supabase db diff --schema public

# Test role selection flow
# 1. Sign up new user
# 2. Check profile.role IS NULL
# 3. Call set_user_role('customer')
# 4. Verify role persisted
```

### Step 3: Deploy to Production

```powershell
# Push migrations to production
supabase db push

# Monitor for errors
# If errors occur, check logs:
supabase functions logs --tail
```

### Step 4: Verify Deployment

Run the verification checklist (see MIGRATION_VERIFICATION.md)

---

## 🔍 Verification Checklist

### Database Structure

```sql
-- 1. Check table count
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: ~20 tables

-- 2. Check RLS enabled
SELECT COUNT(*) FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
-- Expected: ~20 (all tables)

-- 3. Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;
-- Expected: set_user_role, handle_new_user, get_public_profile_card, etc.

-- 4. Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
-- Expected: on_auth_user_created, set_updated_at, etc.
```

### Role Fix Verification

```sql
-- 1. Check role column allows NULL
SELECT is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'role';
-- Expected: is_nullable = 'YES', column_default = NULL

-- 2. Check set_user_role function exists
SELECT routine_name, routine_type 
FROM information_schema.routines
WHERE routine_name = 'set_user_role';
-- Expected: 1 row, routine_type = 'FUNCTION'

-- 3. Test role selection
-- Sign up new user → role should be NULL
-- Call set_user_role('customer') → role should be 'customer'
-- Try calling set_user_role('mechanic') → should ERROR
```

### Seed Data Verification

```sql
-- 1. Check symptoms
SELECT COUNT(*) FROM public.symptoms;
-- Expected: 100

-- 2. Check symptom_mappings
SELECT COUNT(*) FROM public.symptom_mappings;
-- Expected: 100

-- 3. Check skills
SELECT COUNT(*) FROM public.skills;
-- Expected: 18

-- 4. Check tools
SELECT COUNT(*) FROM public.tools;
-- Expected: 19

-- 5. Check safety_measures
SELECT COUNT(*) FROM public.safety_measures;
-- Expected: 10

-- 6. Check symptom_questions
SELECT COUNT(*) FROM public.symptom_questions;
-- Expected: (your count)

-- 7. Check symptom_refinements
SELECT COUNT(*) FROM public.symptom_refinements;
-- Expected: (your count)

-- 8. Check education_cards
SELECT COUNT(*) FROM public.education_cards;
-- Expected: (your count)
```

---

## 🧪 Testing Flows

### Test 1: New User Signup

```typescript
// 1. Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'password123'
});

// 2. Check profile created with role = NULL
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('auth_id', data.user.id)
  .single();

console.log(profile.role); // Expected: null

// 3. Set role
const { error: roleError } = await supabase.rpc('set_user_role', {
  new_role: 'customer'
});

console.log(roleError); // Expected: null

// 4. Verify role persisted
const { data: updatedProfile } = await supabase
  .from('profiles')
  .select('role')
  .eq('auth_id', data.user.id)
  .single();

console.log(updatedProfile.role); // Expected: 'customer'

// 5. Try changing role (should fail)
const { error: changeError } = await supabase.rpc('set_user_role', {
  new_role: 'mechanic'
});

console.log(changeError); // Expected: 'Role already set. Cannot change role after initial selection.'
```

### Test 2: Mechanic Profile Creation

```typescript
// 1. Sign up as mechanic
const { data } = await supabase.auth.signUp({
  email: 'mechanic@example.com',
  password: 'password123'
});

// 2. Set role to mechanic
await supabase.rpc('set_user_role', { new_role: 'mechanic' });

// 3. Check mechanic_profiles created
const { data: mechanicProfile } = await supabase
  .from('mechanic_profiles')
  .select('*')
  .eq('id', data.user.id)
  .single();

console.log(mechanicProfile); // Expected: row exists with default values
```

### Test 3: Job Creation & Quotes

```typescript
// 1. Create job as customer
const { data: job } = await supabase
  .from('jobs')
  .insert({
    title: 'Oil change',
    description: 'Need oil change',
    customer_id: customerId,
    status: 'searching'
  })
  .select()
  .single();

// 2. Mechanic views searching jobs
const { data: searchingJobs } = await supabase
  .from('jobs')
  .select('*')
  .eq('status', 'searching');

console.log(searchingJobs.length); // Expected: >= 1

// 3. Mechanic submits quote
const { data: quote } = await supabase
  .from('quote_requests')
  .insert({
    job_id: job.id,
    mechanic_id: mechanicId,
    customer_id: customerId,
    price_cents: 5000,
    estimated_hours: 1
  })
  .select()
  .single();

// 4. Customer views quotes
const { data: quotes } = await supabase
  .from('quote_requests')
  .select('*')
  .eq('job_id', job.id);

console.log(quotes.length); // Expected: >= 1
```

---

## 🔄 Rollback Plan

If something goes wrong:

### Option 1: Restore from Backup

```powershell
# Find your backup file
Get-ChildItem backup_before_restructure_*.sql

# Restore database
psql $env:DATABASE_URL -f backup_before_restructure_YYYYMMDD_HHMMSS.sql
```

### Option 2: Restore Old Migrations

```powershell
# Find archive directory
$archiveDir = Get-ChildItem supabase/migrations/archive_* | Sort-Object -Descending | Select-Object -First 1

# Restore old migrations
Copy-Item "$archiveDir/*.sql" -Destination "supabase/migrations/" -Force

# Delete new migrations
Remove-Item supabase/migrations/20250127*.sql

# Reset database
supabase db reset
```

---

## 📊 Success Criteria

After deployment, verify:

- ✅ All 5 migration files applied successfully
- ✅ No errors in Supabase logs
- ✅ All tables created (20+)
- ✅ RLS enabled on all tables
- ✅ All functions exist (set_user_role, handle_new_user, etc.)
- ✅ All triggers attached
- ✅ Seed data loaded (symptoms, skills, tools, etc.)
- ✅ New users see choose-role screen
- ✅ Role persists correctly
- ✅ Role cannot be changed after selection
- ✅ Mechanic profile auto-created when role = 'mechanic'
- ✅ Jobs, quotes, messages work correctly

---

## 🆘 Troubleshooting

### Error: "relation already exists"

**Cause:** Old schema objects still present

**Fix:**
```sql
-- Drop all tables (CAUTION: data loss!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then run: supabase db reset
```

### Error: "foreign key constraint violation"

**Cause:** Dependency ordering issue

**Fix:** Check that foreign keys are added AFTER all tables are created in `20250127000001_baseline_schema.sql`

### Error: "function does not exist"

**Cause:** Functions not created or wrong schema

**Fix:** Verify `20250127000003_functions_triggers.sql` ran successfully

### Seed Data Not Loading

**Cause:** Missing data in `20250127000005_seed_data.sql`

**Fix:** Paste your full seed data into the TODO sections

---

## 📞 Support

If you encounter issues:

1. Check Supabase logs: `supabase functions logs --tail`
2. Verify migration order: `supabase migrations list`
3. Check database state: Run verification queries above
4. Restore from backup if needed

---

## 🎉 Next Steps

After successful deployment:

1. ✅ Test all app flows (signup, role selection, job creation, quotes)
2. ✅ Monitor for errors in production
3. ✅ Update documentation
4. ✅ Delete archived migrations after 30 days
5. ✅ Celebrate clean migrations! 🎊
