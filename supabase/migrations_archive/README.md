# WrenchGo Migrations Archive - REFERENCE ONLY

> **WARNING: DO NOT APPLY THESE MIGRATIONS**
> 
> This directory contains archived migrations that were replaced by the baseline consolidation.
> They are preserved for reference only and should NOT be applied to any database.

## Purpose

This directory contains migrations that were archived during the baseline consolidation on 2025-02-11. These migrations were applied to earlier versions of the database but have been superseded by the consolidated baseline in `supabase/migrations/`.

## Why These Exist

1. **Historical Reference** - Document the original migration sequence
2. **Rollback Reference** - Understand what was originally applied
3. **Audit Trail** - Maintain complete history of schema changes
4. **Debugging** - Compare implementations across versions

## Contents

These files represent the migration history from various development phases:

- `001_stripe_marketplace_schema.sql` - Early Stripe integration
- `20240101_*` - 2024 development migrations
- `20250127*` - January 2025 baseline attempt
- `20250202*` - February 2025 feature additions
- `20250204*` - February 2025 bug fixes
- `20250205*` - Customer eligibility features
- `20250206*` - ID verification removal
- `20260104*` - Role and profile fixes (note: future-dated for ordering)

## DO NOT

- Move these files to `supabase/migrations/`
- Run `supabase db push` from this directory
- Apply these migrations to any database
- Assume these are compatible with current schema

## Current Authoritative Migrations

Use the migrations in `supabase/migrations/`:

| Migration | Purpose |
|-----------|---------|
| `20250111000001_baseline_consolidated.sql` | Complete schema |
| `20250111000002_baseline_rls_policies.sql` | RLS policies |
| `20250111000003_baseline_functions.sql` | Functions & triggers |
| `20250111000004_baseline_storage.sql` | Storage buckets |
| `20250213000001+` | Incremental updates |

## Related Directories

| Directory | Status |
|-----------|--------|
| `supabase/migrations/` | **AUTHORITATIVE** - Use this |
| `supabase/migrations_backup/` | Reference only |
| `supabase/migrations_archive/` | Reference only (this directory) |
| `supabase/migrations_backup_20250212/` | Reference only |
| `supabase/migrations_launch_ready/` | Reference only |

## Contact

For questions about archived migrations, consult git history or the database team.
