# Migration Test Plan & Command Checklist

## Overview

This document provides a comprehensive test plan for validating WrenchGo database migrations.

---

## Test Plan

### (A) Fresh Database Apply from Scratch

**Purpose:** Verify all migrations apply cleanly to a new database.

```powershell
# 1. Reset local database (applies all migrations)
npx supabase db reset

# 2. Verify no errors in output
# Expected: "Finished supabase db reset" with no errors

# 3. Check migration status
npx supabase migration list

# Expected output:
# LOCAL    REMOTE   NAME
# ✓        ✓        20250111000001_baseline_consolidated.sql
# ✓        ✓        20250111000002_baseline_rls_policies.sql
# ✓        ✓        20250111000003_baseline_functions.sql
# ✓        ✓        20250111000004_baseline_storage.sql
# ✓        ✓        20250213000001_service_hubs.sql
# ... (all 20250213* migrations)
```

**Validation Queries:**

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check all functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Check storage buckets
SELECT id, name, public FROM storage.buckets;
```

---

### (B) Apply on Restored Staging/Prod Dump

**Purpose:** Verify migrations apply correctly to an existing database.

```powershell
# 1. Link to staging/prod project
npx supabase link --project-ref <project-ref>

# 2. Check current migration status
npx supabase migration list

# 3. Push pending migrations (with confirmation)
npx supabase db push

# 4. Verify all migrations applied
npx supabase migration list
```

**Pre-flight Checks:**

```sql
-- Before pushing, verify schema state
-- Check if baseline tables exist
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles');
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_hubs');

-- Check if key functions exist
SELECT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user');
SELECT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_mechanic_leads');
```

---

### (C) Verify Schema Diff

**Purpose:** Ensure local and remote schemas match.

```powershell
# 1. Generate diff between local and remote
npx supabase db diff --linked

# Expected: No output (schemas match)
# If there's output, it shows what's different

# 2. Generate diff for specific schema
npx supabase db diff --linked --schema public

# 3. If differences exist, generate corrective migration
npx supabase db diff --linked -f fix_schema_drift
```

**Manual Schema Comparison:**

```sql
-- Compare table counts
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';

-- Compare function counts
SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';

-- Compare enum types
SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e';
```

---

## Command Checklist

### Daily Development

```powershell
# Check migration status
npx supabase migration list

# Apply pending migrations to local
npx supabase db reset

# Push to remote (with confirmation)
npx supabase db push
```

### Creating New Migrations

```powershell
# 1. Create new migration file
npx supabase migration new descriptive_name

# 2. Edit the generated file in supabase/migrations/

# 3. Test locally
npx supabase db reset

# 4. Push to remote
npx supabase db push
```

### Debugging Migration Issues

```powershell
# View migration history
npx supabase migration list

# Check for schema drift
npx supabase db diff --linked

# View remote database logs
npx supabase db logs

# Connect to remote database directly
npx supabase db remote commit
```

### Emergency Procedures

```powershell
# If migration fails mid-way:
# 1. Check Supabase dashboard for error details
# 2. DO NOT modify the failed migration
# 3. Create a new migration to fix the issue

# If schema is corrupted:
# 1. Restore from backup (Supabase dashboard)
# 2. Re-apply migrations from known good state
```

---

## Validation Checklist

After applying migrations, verify:

- [ ] All 16 migrations show as applied (`npx supabase migration list`)
- [ ] No schema drift (`npx supabase db diff --linked` returns empty)
- [ ] Core tables exist: profiles, vehicles, jobs, quote_requests, reviews
- [ ] Service hubs table exists with data
- [ ] Key functions work: `get_mechanic_leads`, `handle_new_user`, `get_nearest_hub`
- [ ] RLS policies are active on all tables
- [ ] Storage buckets are configured

---

## Files Modified in This Cleanup

### New Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/README.md` | Migration strategy documentation |
| `supabase/migrations_backup/README.md` | Reference-only warning |
| `supabase/migrations_archive/README.md` | Reference-only warning |
| `supabase/migrations_backup/DO_NOT_APPLY.txt` | Safety marker |
| `supabase/migrations_archive/DO_NOT_APPLY.txt` | Safety marker |
| `supabase/MIGRATION_TEST_PLAN.md` | This file |

### Files Modified (Headers Added)

| File | Change |
|------|--------|
| `20250111000001_baseline_consolidated.sql` | Added standardized header |
| `20250111000002_baseline_rls_policies.sql` | Added standardized header |
| `20250111000003_baseline_functions.sql` | Added standardized header |
| `20250111000004_baseline_storage.sql` | Added standardized header |
| `20250213000001_service_hubs.sql` | Added standardized header |
| `20250213000002_fix_rating_prompt_state.sql` | Added standardized header |
| `20250213000003_add_payment_method_status.sql` | Added standardized header |
| `20250213000004_fix_handle_new_user_role.sql` | Added standardized header |
| `20250213000005_fix_get_mechanic_leads.sql` | Added standardized header |
| `20250213000006_fix_job_status_in_leads.sql` | Added standardized header |
| `20250213000007_fix_launch_metrics_mechanic_count.sql` | Added standardized header |
| `20250213000008_add_customers_to_launch_metrics.sql` | Added standardized header |
| `20250213000009_add_check_mechanic_service_area.sql` | Added standardized header |
| `20250213000010_add_check_customer_service_area.sql` | Added standardized header |
| `20250213000011_add_get_nearest_hub.sql` | Added standardized header |
| `20250213000012_add_missing_from_backup.sql` | Added standardized header |

---

## Notes

1. **Baseline Order Validation:** The baseline migrations are correctly ordered:
   - 00001: Extensions, ENUMs, Tables (foundation)
   - 00002: RLS Policies (requires tables)
   - 00003: Functions & Triggers (requires tables + policies)
   - 00004: Storage (independent, can be last)

2. **No Reordering Needed:** The current order is sensible and follows best practices.

3. **Reference Directories:** `migrations_backup/` and `migrations_archive/` are clearly marked as reference-only with README files and warning markers.
