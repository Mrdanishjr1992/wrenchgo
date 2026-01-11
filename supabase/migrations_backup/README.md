# WrenchGo Migrations Backup - REFERENCE ONLY

> **WARNING: DO NOT APPLY THESE MIGRATIONS**
> 
> This directory contains historical migrations from earlier development phases.
> They are preserved for reference only and should NOT be applied to any database.

## Purpose

This directory contains the original migration files from the development phase before the baseline consolidation on 2025-02-11. These files document the evolution of the schema but have been superseded by the consolidated baseline migrations in `supabase/migrations/`.

## Why These Exist

1. **Historical Reference** - Understand how the schema evolved
2. **Code Archaeology** - Find original implementations of features
3. **Debugging** - Compare current schema to historical versions
4. **Documentation** - See the reasoning behind certain design decisions

## Migration History

| File | Original Purpose |
|------|------------------|
| `0001_baseline_schema.sql` | Original schema baseline |
| `0002_rls_policies.sql` | Original RLS policies |
| `0003_functions_triggers.sql` | Original functions |
| `0004_stripe_marketplace.sql` | Stripe integration |
| `0005_indexes_performance.sql` | Performance indexes |
| `0006_seed_data.sql` | Seed data |
| `0007_cleanup_and_validation.sql` | Cleanup scripts |
| ... | Additional incremental migrations |

## DO NOT

- Move these files to `supabase/migrations/`
- Run `supabase db push` from this directory
- Copy SQL from here without verifying against current schema
- Assume these migrations are compatible with current database

## Instead

Use the authoritative migrations in `supabase/migrations/`:

```bash
# Apply migrations from the correct directory
cd /path/to/project
npx supabase db push
```

## Related Directories

| Directory | Status |
|-----------|--------|
| `supabase/migrations/` | **AUTHORITATIVE** - Use this |
| `supabase/migrations_backup/` | Reference only (this directory) |
| `supabase/migrations_archive/` | Reference only |
| `supabase/migrations_backup_20250212/` | Reference only |
| `supabase/migrations_launch_ready/` | Reference only |

## Contact

If you need to understand historical schema decisions, consult the git history or contact the database team.
