# WrenchGo Database Migrations

## Overview

This directory contains the **authoritative** Supabase migrations for WrenchGo. These migrations are applied in lexicographic order by filename.

## Migration Strategy

### Baseline Migrations (20250111000001-00004)

The baseline migrations consolidate the original development history into a clean starting point for new environments. They are designed to be **idempotent** (safe to re-run) using `IF NOT EXISTS` and `ON CONFLICT` patterns.

| File | Purpose | Dependencies |
|------|---------|--------------|
| `20250111000001_baseline_consolidated.sql` | Extensions, ENUMs, ALL tables | None |
| `20250111000002_baseline_rls_policies.sql` | RLS enablement and policies | 00001 |
| `20250111000003_baseline_functions.sql` | Functions, triggers, RPCs | 00001, 00002 |
| `20250111000004_baseline_storage.sql` | Storage buckets and policies | 00001 |

**Order rationale:**
1. **Extensions/Types/Tables** - Foundation must exist first
2. **RLS Policies** - Tables must exist before policies
3. **Functions** - Tables and policies must exist for SECURITY DEFINER functions
4. **Storage** - Can be applied last as it's independent

### Incremental Migrations (20250213000001+)

These migrations add features and fixes on top of the baseline. Each is atomic and should be applied in order.

| File | Purpose | Risk |
|------|---------|------|
| `20250213000001_service_hubs.sql` | Service hubs, launch metrics, PostGIS | Low |
| `20250213000002_fix_rating_prompt_state.sql` | Add columns to user_rating_prompt_state | Low |
| `20250213000003_add_payment_method_status.sql` | Add payment_method_status enum/column | Low |
| `20250213000004_fix_handle_new_user_role.sql` | Allow NULL role in handle_new_user | Low |
| `20250213000005_fix_get_mechanic_leads.sql` | Update get_mechanic_leads signature | Low |
| `20250213000006_fix_job_status_in_leads.sql` | Remove 'open' from job_status filter | Low |
| `20250213000007_fix_launch_metrics_mechanic_count.sql` | Fix mechanic counting with LEFT JOIN | Low |
| `20250213000008_add_customers_to_launch_metrics.sql` | Add active_customers to metrics | Low |
| `20250213000009_add_check_mechanic_service_area.sql` | Service area check for mechanics | Low |
| `20250213000010_add_check_customer_service_area.sql` | Service area check for customers | Low |
| `20250213000011_add_get_nearest_hub.sql` | Get nearest hub RPC function | Low |
| `20250213000012_add_missing_from_backup.sql` | Financial functions from backup | Low |

## How to Add New Migrations

### Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Example: `20250214120000_add_user_preferences.sql`

### Template

```sql
-- ============================================================================
-- Migration: YYYYMMDDHHMMSS_descriptive_name.sql
-- ============================================================================
-- Purpose: Brief description of what this migration does
-- Dependencies: List any migrations this depends on
-- Risk Level: Low/Medium/High
-- Rollback: Describe rollback strategy or "N/A - additive only"
-- ============================================================================

BEGIN;

-- Your SQL here

COMMIT;
```

### Best Practices

1. **Always use transactions** - Wrap in `BEGIN;`/`COMMIT;`
2. **Be idempotent** - Use `IF NOT EXISTS`, `DROP ... IF EXISTS`, `ON CONFLICT`
3. **Test locally first** - Run `supabase db reset` before pushing
4. **Never modify applied migrations** - Create new migrations for fixes
5. **Document dependencies** - Note which tables/functions must exist

## Verifying Migration Status

### Check Applied Migrations

```bash
# List migrations applied to remote database
npx supabase migration list

# Check specific migration status
npx supabase db diff --linked
```

### Local Testing

```bash
# Reset local database and apply all migrations
npx supabase db reset

# Push to linked remote database
npx supabase db push
```

### Schema Diff

```bash
# Compare local schema to remote
npx supabase db diff --linked --schema public

# Generate migration from diff
npx supabase db diff --linked --schema public -f new_migration
```

## Related Directories

| Directory | Purpose | Status |
|-----------|---------|--------|
| `migrations/` | **Active migrations** - Applied by Supabase CLI | AUTHORITATIVE |
| `migrations_backup/` | Historical reference from earlier development | REFERENCE ONLY |
| `migrations_archive/` | Archived migrations replaced by baseline | REFERENCE ONLY |
| `migrations_backup_20250212/` | Backup before baseline consolidation | REFERENCE ONLY |
| `migrations_launch_ready/` | Pre-launch staging migrations | REFERENCE ONLY |

**WARNING:** Only files in `migrations/` are applied. Other directories are for reference and should NOT be moved into `migrations/`.

## Troubleshooting

### Migration Failed

1. Check the error message in Supabase dashboard or CLI output
2. Do NOT modify the failed migration if already applied elsewhere
3. Create a new migration to fix the issue

### Schema Drift

If local and remote schemas differ:

```bash
# See what's different
npx supabase db diff --linked

# Generate corrective migration
npx supabase db diff --linked -f fix_schema_drift
```

### Rollback Strategy

Supabase does not support automatic rollbacks. For each migration:

1. **Additive changes** (new tables/columns): Usually safe, no rollback needed
2. **Destructive changes** (drops): Create a new migration to restore
3. **Data migrations**: Keep backup and create restore migration if needed

## Contact

For migration issues, contact the database team or check the project documentation.
