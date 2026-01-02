# 🔍 SUPABASE RELEASE VERIFICATION GUIDE

## 📋 CURRENT MIGRATION STRUCTURE

Your migrations (in order):
1. `20250127000000_fix_role_selection_flow.sql` - Role selection fix
2. `20250127000001_baseline_schema.sql` - Core schema
3. `20250127000002_rls_policies.sql` - RLS policies
4. `20250127000003_functions_triggers.sql` - Functions & triggers
5. `20250127000004_indexes_performance.sql` - Indexes
6. `20250127000005_seed_data.sql` - Seed data
7. `20250127000006_project_b_integration.sql` - Project B integration

---

## ✅ PART 1: VERIFICATION COMMANDS (PowerShell)

### 1.1 Check Migration Status

```powershell
# View local migration history
supabase migration list

# Check remote migration history
supabase db remote exec "SELECT version, name, inserted_at FROM supabase_migrations.schema_migrations ORDER BY version;"

# Check for schema drift (should show no differences)
supabase db diff --schema public
```

**Expected output for `supabase db diff`:**
```
No schema differences detected.
```

If you see differences, there's drift!

---

### 1.2 Verify Local Reset Works

```powershell
# Test local reset (CRITICAL - this must work!)
supabase db reset

# Verify tables exist after reset
supabase db remote exec --local "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

# Verify seed data loaded
supabase db remote exec --local "SELECT COUNT(*) as skill_count FROM skills;"
```

**Expected output:**
- Reset completes without errors
- All tables exist
- Seed data loaded (skills count > 0)

---

### 1.3 Check Production Status

```powershell
# Verify production is up to date
supabase db push

# Check production migration history
supabase db remote exec "SELECT version, name, inserted_at FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;"

# Verify no pending migrations
supabase migration list
```

**Expected output:**
```
Remote database is up to date.
```

---

## ✅ PART 2: SQL VERIFICATION CHECKS

### 2.1 Critical Schema Verification

Run these on **remote** database:

```powershell
# Save this as verify_schema.sql
supabase db remote exec "
-- =====================================================
-- SCHEMA VERIFICATION CHECKS
-- =====================================================

-- Check 1: Messages table structure (NO recipient_id)
SELECT 
  'messages_columns' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- Check 2: Jobs table has accepted_mechanic_id
SELECT 
  'jobs_accepted_mechanic_id' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'jobs'
  AND column_name = 'accepted_mechanic_id';

-- Check 3: Profiles role column (should allow NULL, no default)
SELECT 
  'profiles_role_config' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'role';

-- Check 4: RLS enabled on core tables
SELECT 
  'rls_enabled' as check_name,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'messages', 'jobs', 'quotes', 'reviews', 'mechanic_profiles')
ORDER BY tablename;

-- Check 5: Critical functions exist
SELECT 
  'functions_exist' as check_name,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_user', 'set_user_role', 'handle_updated_at', 'get_public_profile_card')
ORDER BY routine_name;

-- Check 6: Critical triggers exist
SELECT 
  'triggers_exist' as check_name,
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('on_auth_user_created', 'set_updated_at')
ORDER BY trigger_name;
"
```

---

### 2.2 Seed Data Verification

```powershell
supabase db remote exec "
-- =====================================================
-- SEED DATA VERIFICATION
-- =====================================================

-- Check 1: Skills count
SELECT 'skills' as table_name, COUNT(*) as row_count FROM skills
UNION ALL
-- Check 2: Tools count
SELECT 'tools', COUNT(*) FROM tools
UNION ALL
-- Check 3: Safety measures count
SELECT 'safety_measures', COUNT(*) FROM safety_measures
UNION ALL
-- Check 4: Symptoms count
SELECT 'symptoms', COUNT(*) FROM symptoms
UNION ALL
-- Check 5: Symptom mappings count
SELECT 'symptom_mappings', COUNT(*) FROM symptom_mappings
UNION ALL
-- Check 6: Symptom questions count
SELECT 'symptom_questions', COUNT(*) FROM symptom_questions
UNION ALL
-- Check 7: Symptom refinements count
SELECT 'symptom_refinements', COUNT(*) FROM symptom_refinements
ORDER BY table_name;
"
```

**Expected output:**
```
table_name            | row_count
----------------------|----------
safety_measures       | 10
skills                | 18
symptom_mappings      | 100+
symptom_questions     | 50+
symptom_refinements   | 30+
symptoms              | 100+
tools                 | 19
```

---

### 2.3 RLS Policy Verification

```powershell
supabase db remote exec "
-- =====================================================
-- RLS POLICY VERIFICATION
-- =====================================================

-- Check all RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual IS NOT NULL as has_using,
  with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
"
```

**Expected:** Multiple policies per table (SELECT, INSERT, UPDATE, DELETE)

---

### 2.4 Role Selection Flow Verification

```powershell
supabase db remote exec "
-- =====================================================
-- ROLE SELECTION FLOW VERIFICATION
-- =====================================================

-- Check 1: Profiles role configuration
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'role';

-- Check 2: set_user_role function exists
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'set_user_role';

-- Check 3: handle_new_user function (should set role = NULL)
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = 'public'::regnamespace;

-- Check 4: RLS policy for role update exists
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
  AND policyname LIKE '%role%';
"
```

**Expected:**
- `role` column: `is_nullable = YES`, `column_default = NULL`
- `set_user_role` function exists with `SECURITY DEFINER`
- `handle_new_user` sets `role = NULL`
- RLS policy exists for role updates

---

## ✅ PART 3: NO-DRIFT WORKFLOW

### 3.1 Golden Rules

| Scenario | Command | When |
|----------|---------|------|
| **Creating new migration** | `supabase migration new <name>` | Always use this, never create files manually |
| **Local changes → Production** | `supabase db push` | After testing locally with `db reset` |
| **Production changes → Local** | `supabase db pull` | If someone made manual changes in production (AVOID!) |
| **Check for drift** | `supabase db diff` | Before pushing, after pulling |
| **Test migrations** | `supabase db reset` | Before every push to production |

---

### 3.2 Workflow: Creating New Migrations

```powershell
# 1. Create new migration file
supabase migration new add_new_feature

# 2. Edit the generated file in supabase/migrations/

# 3. Test locally
supabase db reset

# 4. Verify no errors
supabase status

# 5. Check for drift
supabase db diff

# 6. Push to production
supabase db push

# 7. Verify production
supabase db remote exec "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;"
```

---

### 3.3 Workflow: Handling Manual Production Changes (AVOID!)

If someone made manual changes in production dashboard:

```powershell
# 1. Check for drift
supabase db diff --schema public

# 2. If drift detected, pull changes
supabase db pull

# 3. Review the generated migration file

# 4. Test locally
supabase db reset

# 5. Commit the pulled migration
git add supabase/migrations/
git commit -m "Pull production schema changes"
```

**⚠️ PREVENTION:** Never make manual changes in production. Always use migrations!

---

### 3.4 Workflow: Preventing Manual Scripts

**❌ DON'T:**
- Create `.sql` files directly in `supabase/migrations/`
- Run manual SQL in production dashboard
- Copy/paste SQL from docs without migration

**✅ DO:**
- Always use `supabase migration new <name>`
- Test with `supabase db reset` before pushing
- Keep migrations idempotent (use `IF NOT EXISTS`, `CREATE OR REPLACE`)
- Document migrations with comments

---

### 3.5 Migration Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql

Examples:
20250127120000_add_payment_table.sql
20250127120100_add_payment_rls.sql
20250127120200_add_payment_indexes.sql
```

**Supabase CLI generates this automatically with `supabase migration new`**

---

## ✅ PART 4: DEPLOYMENT CHECKLIST

### Pre-Deployment Checklist

```markdown
## 🚀 PRE-DEPLOYMENT CHECKLIST

### Local Verification
- [ ] All migrations in `supabase/migrations/` are committed to git
- [ ] `supabase db reset` completes without errors
- [ ] All tables exist after reset
- [ ] Seed data loads correctly
- [ ] `supabase db diff` shows no drift
- [ ] App works locally with reset database

### Migration Review
- [ ] Migrations are in correct order (check timestamps)
- [ ] Migrations are idempotent (can run multiple times safely)
- [ ] No hardcoded UUIDs or sensitive data
- [ ] All migrations have comments explaining purpose
- [ ] Rollback plan documented (if needed)

### Production Verification
- [ ] Backup production database: `supabase db dump -f backup.sql`
- [ ] Check production status: `supabase db push` (should say "up to date")
- [ ] Verify migration history matches local: `supabase migration list`
- [ ] No manual changes in production dashboard

### Deployment
- [ ] Run: `supabase db push`
- [ ] Verify: "Remote database is up to date" or migrations applied
- [ ] Check migration history: `SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;`
- [ ] Run schema verification SQL (Part 2.1)
- [ ] Run seed data verification SQL (Part 2.2)
- [ ] Run RLS verification SQL (Part 2.3)

### Post-Deployment Verification
- [ ] All tables exist in production
- [ ] RLS enabled on all tables
- [ ] Seed data loaded correctly
- [ ] Critical functions exist (handle_new_user, set_user_role, etc.)
- [ ] Triggers attached (on_auth_user_created, set_updated_at)
- [ ] App can connect to production
- [ ] User signup works (creates profile with role = NULL)
- [ ] Role selection works (set_user_role RPC)
- [ ] Messaging works (no recipient_id errors)
- [ ] Job acceptance works (accepted_mechanic_id exists)

### Rollback Plan (If Needed)
- [ ] Have backup file ready: `backup_YYYYMMDD_HHMMSS.sql`
- [ ] Know how to restore: `supabase db remote exec < backup.sql`
- [ ] Have old migration files archived (if you cleaned up)
- [ ] Document what went wrong for future reference
```

---

## ✅ PART 5: QUICK VERIFICATION SCRIPT

Save this as `verify_deployment.ps1`:

```powershell
# =====================================================
# SUPABASE DEPLOYMENT VERIFICATION SCRIPT
# =====================================================

Write-Host "🔍 Starting Supabase Deployment Verification..." -ForegroundColor Cyan

# 1. Check migration status
Write-Host "`n1️⃣ Checking migration status..." -ForegroundColor Yellow
supabase migration list

# 2. Check for drift
Write-Host "`n2️⃣ Checking for schema drift..." -ForegroundColor Yellow
supabase db diff --schema public

# 3. Verify remote migrations
Write-Host "`n3️⃣ Verifying remote migration history..." -ForegroundColor Yellow
supabase db remote exec "SELECT version, name, inserted_at FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;"

# 4. Verify critical tables
Write-Host "`n4️⃣ Verifying critical tables exist..." -ForegroundColor Yellow
supabase db remote exec "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

# 5. Verify RLS enabled
Write-Host "`n5️⃣ Verifying RLS enabled on core tables..." -ForegroundColor Yellow
supabase db remote exec "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'messages', 'jobs', 'quotes', 'reviews') ORDER BY tablename;"

# 6. Verify seed data
Write-Host "`n6️⃣ Verifying seed data loaded..." -ForegroundColor Yellow
supabase db remote exec "SELECT 'skills' as table_name, COUNT(*) as count FROM skills UNION ALL SELECT 'symptoms', COUNT(*) FROM symptoms UNION ALL SELECT 'tools', COUNT(*) FROM tools;"

# 7. Verify critical functions
Write-Host "`n7️⃣ Verifying critical functions exist..." -ForegroundColor Yellow
supabase db remote exec "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('handle_new_user', 'set_user_role', 'handle_updated_at') ORDER BY routine_name;"

# 8. Verify role selection flow
Write-Host "`n8️⃣ Verifying role selection flow..." -ForegroundColor Yellow
supabase db remote exec "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role';"

Write-Host "`n✅ Verification complete!" -ForegroundColor Green
Write-Host "Review the output above for any issues." -ForegroundColor Cyan
```

Run with:
```powershell
.\verify_deployment.ps1
```

---

## ✅ PART 6: COMMON ISSUES & FIXES

### Issue 1: "Schema drift detected"

**Cause:** Manual changes in production or local changes not pushed

**Fix:**
```powershell
# Check what's different
supabase db diff --schema public

# If production has changes you want:
supabase db pull

# If local has changes you want:
supabase db push
```

---

### Issue 2: "Migration already applied"

**Cause:** Trying to push a migration that's already in production

**Fix:**
```powershell
# Check migration history
supabase migration list

# If migration is already applied, skip it or create a new one
supabase migration new fix_issue_v2
```

---

### Issue 3: "supabase db reset fails"

**Cause:** Migration order issue, missing dependencies, or syntax error

**Fix:**
```powershell
# Check which migration fails
supabase db reset

# Review the failing migration file
# Fix syntax or dependency order
# Test again
supabase db reset
```

---

### Issue 4: "RLS blocking access"

**Cause:** RLS policies too restrictive or missing

**Fix:**
```powershell
# Check RLS policies
supabase db remote exec "SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'your_table';"

# Temporarily disable RLS for testing (NEVER in production!)
supabase db remote exec "ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;"

# Fix policies in migration, then re-enable
supabase db remote exec "ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;"
```

---

### Issue 5: "Seed data not loading"

**Cause:** Seed data migration has errors or conflicts

**Fix:**
```powershell
# Check seed data migration
cat supabase/migrations/20250127000005_seed_data.sql

# Test locally
supabase db reset

# Check for conflicts (duplicate keys, etc.)
# Fix migration and test again
```

---

## 📊 VERIFICATION SUMMARY

After running all checks, you should have:

| Check | Expected Result | Status |
|-------|----------------|--------|
| Migration list | 7 migrations | ⬜ |
| Schema drift | No differences | ⬜ |
| Local reset | Completes without errors | ⬜ |
| Remote migrations | All 7 applied | ⬜ |
| Tables exist | ~20 tables | ⬜ |
| RLS enabled | All core tables | ⬜ |
| Seed data | Skills, symptoms, tools loaded | ⬜ |
| Functions exist | handle_new_user, set_user_role, etc. | ⬜ |
| Triggers exist | on_auth_user_created, set_updated_at | ⬜ |
| Role selection | role = NULL, no default | ⬜ |
| Messages table | No recipient_id column | ⬜ |
| Jobs table | accepted_mechanic_id exists | ⬜ |

---

## 🎯 NEXT STEPS

1. **Run verification commands** (Part 1)
2. **Run SQL checks** (Part 2)
3. **Review no-drift workflow** (Part 3)
4. **Save deployment checklist** (Part 4)
5. **Run verification script** (Part 5)
6. **Test app end-to-end**

---

**Last Updated:** 2025-01-27
**Version:** 1.0
