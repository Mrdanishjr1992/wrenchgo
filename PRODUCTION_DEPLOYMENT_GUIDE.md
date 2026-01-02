# 🚀 SUPABASE DEPLOYMENT GUIDE - PRODUCTION READY

## 📋 OVERVIEW

This guide covers deploying your Supabase migrations to production with comprehensive verification to ensure zero downtime and no schema drift.

**Current Migration Structure:** 7 migrations (20250127000000 through 20250127000006)

---

## ⚠️ PREREQUISITES

Before deploying, ensure:
- [ ] You have access to Supabase Dashboard
- [ ] Supabase CLI is installed and logged in
- [ ] Project is linked: `supabase link --project-ref YOUR_PROJECT_REF`
- [ ] All migrations are committed to git
- [ ] You have 30-60 minutes for deployment and verification

---

## 🎯 DEPLOYMENT PROCESS

### PHASE 1: PRE-DEPLOYMENT VERIFICATION

#### 1.1 Verify Local Environment

```powershell
# Check migration list
supabase migration list

# Expected: 7 migrations
# 20250127000000_fix_role_selection_flow.sql
# 20250127000001_baseline_schema.sql
# 20250127000002_rls_policies.sql
# 20250127000003_functions_triggers.sql
# 20250127000004_indexes_performance.sql
# 20250127000005_seed_data.sql
# 20250127000006_project_b_integration.sql
```

#### 1.2 Test Local Reset

```powershell
# CRITICAL: This must work before deploying to production
supabase db reset

# Verify tables exist
supabase db remote exec --local "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';"

# Expected: ~20 tables
```

**If reset fails, DO NOT proceed to production!** Fix the migration issues first.

#### 1.3 Check for Schema Drift

```powershell
# Check if local and remote are in sync
supabase db diff --schema public

# Expected: "No schema differences detected."
```

**If drift detected:**
- Review the differences
- Decide: pull from production or push local changes
- See `SUPABASE_VERIFICATION_GUIDE.md` Part 3.3 for handling drift

---

### PHASE 2: BACKUP PRODUCTION

#### 2.1 Create Production Backup

```powershell
# Backup entire database (schema + data)
supabase db dump -f "backup_production_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Expected: Creates backup file in current directory
```

**Store this backup safely!** You'll need it if rollback is required.

#### 2.2 Document Current State

```powershell
# Check current migration history
supabase db remote exec "SELECT version, name, inserted_at FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;"

# Save this output for comparison after deployment
```

---

### PHASE 3: DEPLOY TO PRODUCTION

#### 3.1 Push Migrations

```powershell
# Deploy all pending migrations
supabase db push

# Expected output:
# - "Remote database is up to date." (if already deployed)
# - OR "Applying migration..." for each new migration
```

**Watch for errors!** If any migration fails:
1. Note the error message
2. DO NOT continue
3. Review the failing migration
4. Fix and retry

#### 3.2 Verify Migrations Applied

```powershell
# Check remote migration history
supabase db remote exec "SELECT version, name, inserted_at FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;"

# Expected: All 7 migrations present with recent timestamps
```

---

### PHASE 4: POST-DEPLOYMENT VERIFICATION

#### 4.1 Run Automated Verification Script

```powershell
# Run comprehensive verification
.\verify_deployment.ps1

# This checks:
# - Migration status
# - Schema drift
# - Remote migrations
# - Critical tables
# - RLS enabled
# - Seed data
# - Critical functions
# - Role selection flow
# - Messages table structure
# - Jobs table structure
```

**Review the output carefully!** All checks should pass.

#### 4.2 Manual Schema Verification

```powershell
# Verify critical tables exist
supabase db remote exec "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"

# Expected tables (partial list):
# - profiles
# - mechanic_profiles
# - messages
# - jobs
# - quotes
# - reviews
# - skills
# - symptoms
# - symptom_mappings
# - symptom_questions
# - tools
# - safety_measures
```

#### 4.3 Verify RLS Enabled

```powershell
# Check RLS on core tables
supabase db remote exec "
SELECT 
  tablename, 
  rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'messages', 'jobs', 'quotes', 'reviews', 'mechanic_profiles')
ORDER BY tablename;
"

# Expected: rls_enabled = true for all tables
```

#### 4.4 Verify Seed Data Loaded

```powershell
# Check seed data counts
supabase db remote exec "
SELECT 'skills' as table_name, COUNT(*) as count FROM skills
UNION ALL SELECT 'tools', COUNT(*) FROM tools
UNION ALL SELECT 'safety_measures', COUNT(*) FROM safety_measures
UNION ALL SELECT 'symptoms', COUNT(*) FROM symptoms
UNION ALL SELECT 'symptom_mappings', COUNT(*) FROM symptom_mappings
UNION ALL SELECT 'symptom_questions', COUNT(*) FROM symptom_questions
ORDER BY table_name;
"

# Expected counts:
# - skills: 18
# - tools: 19
# - safety_measures: 10
# - symptoms: 100+
# - symptom_mappings: 100+
# - symptom_questions: 50+
```

#### 4.5 Verify Critical Functions

```powershell
# Check functions exist
supabase db remote exec "
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_user', 'set_user_role', 'handle_updated_at', 'get_public_profile_card', 'cancel_quote_by_customer')
ORDER BY routine_name;
"

# Expected: All 5 functions present
```

#### 4.6 Verify Role Selection Flow

```powershell
# Check profiles.role configuration
supabase db remote exec "
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'role';
"

# Expected:
# - is_nullable: YES
# - column_default: NULL (or empty)
```

#### 4.7 Verify Messages Table (No recipient_id)

```powershell
# Check messages table columns
supabase db remote exec "
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
ORDER BY ordinal_position;
"

# Expected: Should NOT see 'recipient_id' in the list
```

#### 4.8 Verify Jobs Table (Has accepted_mechanic_id)

```powershell
# Check jobs table for accepted_mechanic_id
supabase db remote exec "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'jobs'
  AND column_name = 'accepted_mechanic_id';
"

# Expected: Column exists with type 'uuid'
```

---

### PHASE 5: APPLICATION TESTING

#### 5.1 Test User Signup Flow

1. Open your app (development or production)
2. Sign up a new user
3. Verify:
   - [ ] User created in `auth.users`
   - [ ] Profile created in `profiles` table
   - [ ] `profiles.role` is NULL (not 'customer')
   - [ ] User redirected to role selection screen

#### 5.2 Test Role Selection

1. Choose "Customer" or "Mechanic" role
2. Verify:
   - [ ] `set_user_role` RPC called successfully
   - [ ] `profiles.role` updated to chosen role
   - [ ] If mechanic: `mechanic_profiles` record created
   - [ ] User redirected to appropriate dashboard

#### 5.3 Test Messaging System

1. Create a job as customer
2. Send message to mechanic
3. Verify:
   - [ ] Message created in `messages` table
   - [ ] No errors about `recipient_id`
   - [ ] Message appears in conversation

#### 5.4 Test Job Acceptance

1. As mechanic, accept a job
2. Verify:
   - [ ] `jobs.accepted_mechanic_id` updated
   - [ ] Job status changed
   - [ ] No errors

#### 5.5 Test Symptom Diagnosis

1. As customer, start symptom diagnosis
2. Verify:
   - [ ] Symptoms load from database
   - [ ] Symptom questions appear
   - [ ] Refinements work
   - [ ] No errors

---

## ✅ DEPLOYMENT CHECKLIST

Copy this checklist and mark items as you complete them:

### Pre-Deployment
- [ ] All migrations committed to git
- [ ] `supabase migration list` shows 7 migrations
- [ ] `supabase db reset` works locally without errors
- [ ] `supabase db diff` shows no drift
- [ ] App tested locally with reset database
- [ ] Team notified of deployment window

### Backup
- [ ] Production backup created: `supabase db dump -f backup.sql`
- [ ] Backup file saved securely
- [ ] Current migration history documented

### Deployment
- [ ] `supabase db push` executed
- [ ] All migrations applied successfully
- [ ] No error messages in output
- [ ] Remote migration history verified

### Verification - Automated
- [ ] `.\verify_deployment.ps1` executed
- [ ] All 10 checks passed
- [ ] No warnings or errors

### Verification - Schema
- [ ] All tables exist (~20 tables)
- [ ] RLS enabled on all core tables
- [ ] Seed data loaded (skills, symptoms, tools, etc.)
- [ ] Critical functions exist (handle_new_user, set_user_role, etc.)
- [ ] Triggers attached (on_auth_user_created, set_updated_at)

### Verification - Role Selection
- [ ] `profiles.role` allows NULL
- [ ] `profiles.role` has no default value
- [ ] `set_user_role` function exists
- [ ] `handle_new_user` sets role = NULL
- [ ] RLS policy for role update exists

### Verification - Schema Fixes
- [ ] Messages table has NO `recipient_id` column
- [ ] Jobs table HAS `accepted_mechanic_id` column
- [ ] No schema drift detected

### Application Testing
- [ ] User signup creates profile with role = NULL
- [ ] Role selection screen appears
- [ ] Role selection works (customer and mechanic)
- [ ] Messaging works without recipient_id errors
- [ ] Job acceptance works with accepted_mechanic_id
- [ ] Symptom diagnosis loads data correctly
- [ ] All critical user flows tested

### Post-Deployment
- [ ] No errors in Supabase logs
- [ ] No user-reported issues
- [ ] Monitoring shows normal operation
- [ ] Team notified of successful deployment
- [ ] Documentation updated (if needed)

---

## 🔄 ROLLBACK PLAN

If something goes wrong during deployment:

### Option 1: Rollback via Backup (Nuclear Option)

```powershell
# Restore from backup
supabase db remote exec < backup_production_20250127_123456.sql

# Verify restoration
supabase db remote exec "SELECT COUNT(*) FROM profiles;"
```

**⚠️ WARNING:** This will restore ALL data to backup state. Any data created after backup will be lost!

### Option 2: Rollback Specific Migration

```powershell
# Create a new migration to undo changes
supabase migration new rollback_issue

# Edit the migration to reverse the problematic changes
# Then push
supabase db push
```

### Option 3: Manual Fix

If only a specific issue (e.g., RLS policy too restrictive):

```powershell
# Fix via SQL in dashboard or CLI
supabase db remote exec "
-- Your fix here
ALTER TABLE your_table ...;
"

# Then create migration to capture the fix
supabase db pull
```

---

## 🚫 NO-DRIFT WORKFLOW (Going Forward)

### Creating New Migrations

```powershell
# ALWAYS use this command (never create .sql files manually)
supabase migration new add_new_feature

# Edit the generated file in supabase/migrations/

# Test locally
supabase db reset

# Push to production
supabase db push
```

### Handling Production Changes

**❌ NEVER:**
- Make manual changes in Supabase Dashboard SQL Editor
- Create migration files manually
- Skip local testing with `db reset`

**✅ ALWAYS:**
- Use `supabase migration new` for new migrations
- Test with `supabase db reset` before pushing
- Check for drift with `supabase db diff`
- Keep migrations idempotent (use `IF NOT EXISTS`, `CREATE OR REPLACE`)

### Regular Maintenance

```powershell
# Weekly: Check for drift
supabase db diff --schema public

# Before any deployment: Test reset
supabase db reset

# After any deployment: Verify
.\verify_deployment.ps1
```

---

## 📊 SUCCESS CRITERIA

After deployment, you should have:

| Criteria | Expected | Status |
|----------|----------|--------|
| Migrations applied | 7 migrations | ⬜ |
| Schema drift | None | ⬜ |
| Tables exist | ~20 tables | ⬜ |
| RLS enabled | All core tables | ⬜ |
| Seed data | Skills, symptoms, tools loaded | ⬜ |
| Functions | handle_new_user, set_user_role, etc. | ⬜ |
| Triggers | on_auth_user_created, set_updated_at | ⬜ |
| Role selection | role=NULL, no default | ⬜ |
| Messages table | No recipient_id | ⬜ |
| Jobs table | Has accepted_mechanic_id | ⬜ |
| User signup | Creates profile with role=NULL | ⬜ |
| Role selection | Works for customer & mechanic | ⬜ |
| Messaging | Works without errors | ⬜ |
| Job acceptance | Works with accepted_mechanic_id | ⬜ |
| App flows | All critical flows working | ⬜ |

---

## 🆘 TROUBLESHOOTING

### Issue: Migration fails during push

**Symptoms:** Error message during `supabase db push`

**Solution:**
1. Read the error message carefully
2. Check the failing migration file
3. Fix syntax or dependency issues
4. Test locally: `supabase db reset`
5. Retry: `supabase db push`

### Issue: Schema drift detected

**Symptoms:** `supabase db diff` shows differences

**Solution:**
```powershell
# See what's different
supabase db diff --schema public

# If production has changes you want:
supabase db pull

# If local has changes you want:
supabase db push
```

### Issue: Seed data not loading

**Symptoms:** Verification shows 0 rows in seed tables

**Solution:**
1. Check seed data migration: `cat supabase/migrations/20250127000005_seed_data.sql`
2. Look for errors (duplicate keys, syntax errors)
3. Test locally: `supabase db reset`
4. Fix and redeploy

### Issue: RLS blocking access

**Symptoms:** App shows "permission denied" errors

**Solution:**
```powershell
# Check RLS policies
supabase db remote exec "SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'your_table';"

# Review policies in migration file
# Fix policies and create new migration
supabase migration new fix_rls_policies
```

### Issue: Role selection not working

**Symptoms:** Users still get default role or can't select role

**Solution:**
```powershell
# Verify role configuration
supabase db remote exec "SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name='profiles' AND column_name='role';"

# Should be: is_nullable=YES, column_default=NULL

# If not, check if migration 20250127000000 was applied
supabase db remote exec "SELECT * FROM supabase_migrations.schema_migrations WHERE version='20250127000000';"
```

---

## 📚 ADDITIONAL RESOURCES

- **Full Verification Guide:** `SUPABASE_VERIFICATION_GUIDE.md`
- **Quick Reference:** `SUPABASE_VERIFICATION_QUICK_REF.md`
- **Verification Script:** `verify_deployment.ps1`
- **Migration Action Plan:** `MIGRATION_ACTION_PLAN.md`
- **Supabase CLI Docs:** https://supabase.com/docs/guides/cli

---

## 📝 DEPLOYMENT LOG TEMPLATE

Use this template to document your deployment:

```markdown
## Deployment: [Date] [Time]

### Pre-Deployment
- Backup created: backup_production_YYYYMMDD_HHMMSS.sql
- Migrations to apply: [list migration files]
- Local reset: ✅ Success

### Deployment
- Started: [timestamp]
- Command: supabase db push
- Result: [Success/Failed]
- Errors: [none or list errors]
- Completed: [timestamp]

### Verification
- Automated checks: ✅ All passed
- Schema verification: ✅ All tables exist
- RLS verification: ✅ Enabled on all tables
- Seed data: ✅ Loaded correctly
- Functions: ✅ All exist
- Role selection: ✅ Working

### Application Testing
- User signup: ✅ Working
- Role selection: ✅ Working
- Messaging: ✅ Working
- Job acceptance: ✅ Working
- Symptom diagnosis: ✅ Working

### Issues Encountered
- [None or list issues and resolutions]

### Rollback Required
- [No or Yes with reason]

### Notes
- [Any additional notes]
```

---

**Last Updated:** 2025-01-27
**Version:** 2.0 (Production Ready)
