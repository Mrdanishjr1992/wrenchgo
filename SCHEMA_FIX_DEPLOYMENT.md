# Schema Fix Deployment Guide

## Overview
This migration fixes all 35 schema issues identified in `POST_RESET_VERIFICATION.sql`.

**CRITICAL:** This migration has been rewritten to work with the **actual current schema**:
- `symptom_mappings` has only `symptom_key` (text, PK) - no `id` column
- `symptom_questions` has only `symptom_key` (text, NOT NULL) - no `symptom_id` column
- All relationships use `symptom_key` as the foreign key

## What This Migration Does

### 1. RLS Policy Management
- **Drops** policies referencing `jobs.status` before type change
- **Recreates** them after type change with text comparisons

### 2. Column Fixes (14 issues)
- Adds missing columns: `profiles.role`, `vehicles.user_id`, `jobs.mechanic_id`, `jobs.quote_id`, `quote_requests.mechanic_id`, `messages.job_id`
- Fixes type mismatches: `jobs.status` (enum→text), `quote_requests.status` (enum→text)
- Fixes nullable mismatches: Sets NOT NULL on `profiles.created_at/updated_at`, `jobs.vehicle_id/created_at/updated_at`, `quote_requests.created_at`

### 3. Foreign Keys (10 issues)
- Adds all missing FK constraints
- **Uses `symptom_key` for symptom relationships** (not `id`/`symptom_id`)

### 4. Indexes (5 issues)
- Adds indexes on `jobs.user_id`, `jobs.mechanic_id`, `jobs.status`, `quote_requests.job_id`, `messages.job_id`

### 5. Triggers (4 issues)
- Creates `update_updated_at_column()` function
- Creates `handle_new_user()` function
- Adds triggers for `profiles`, `jobs`, `vehicles` updated_at
- Adds trigger for auth user creation

### 6. Seed Data (1 issue)
- Inserts 18 engine symptoms into `symptom_mappings`
- Inserts 15 questions into `symptom_questions` (3 questions × 5 symptoms)

## Deployment Steps

### Step 1: Backup Current State
```bash
# Export current schema
supabase db dump --schema public > backup_before_fix.sql

# Or use Supabase Dashboard: Database → Backups → Create backup
```

### Step 2: Review Migration
```bash
# View the migration file
cat supabase/migrations/20251231010000_fix_all_schema_issues.sql
```

### Step 3: Deploy Migration
```bash
# Push the migration to remote database
supabase db push
```

### Step 4: Verify Deployment
Run the verification queries at the end of the migration file:

```sql
-- Check all foreign keys are in place
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;

-- Check all indexes
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public';

-- Check all triggers
SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';

-- Check symptom_questions count (should be ≥15)
SELECT COUNT(*) FROM public.symptom_questions;
```

### Step 5: Re-run Verification Script
```bash
# Run POST_RESET_VERIFICATION.sql in Supabase SQL Editor
# All issues should now show 0 count
```

## Safety Features

1. **Transaction Wrapped**: Entire migration runs in a single transaction (BEGIN/COMMIT)
2. **IF NOT EXISTS**: All DDL uses IF NOT EXISTS/IF EXISTS to prevent errors
3. **ON CONFLICT DO NOTHING**: All seed data inserts are idempotent
4. **Policy Drop/Recreate**: Handles RLS dependencies on altered columns

## Rollback Plan

If the migration fails:

```bash
# The transaction will auto-rollback on error
# If you need to manually rollback after commit:
supabase db reset
supabase db push --include-all
```

## Expected Results

After successful deployment:
- ✅ All 14 column issues fixed
- ✅ All 10 foreign keys added
- ✅ All 5 indexes created
- ✅ All 4 triggers active
- ✅ 18 engine symptoms in `symptom_mappings`
- ✅ ≥15 questions in `symptom_questions`
- ✅ RLS policies recreated with correct text comparisons

## Troubleshooting

### Error: "cannot alter type of a column used in a policy definition"
**Status:** ✅ Fixed in current version
- Migration now drops policies before altering `jobs.status` type
- Recreates policies after type change

### Error: "there is no unique constraint matching given keys"
**Status:** ✅ Fixed in current version
- Migration now uses `symptom_key` (existing PK) for all relationships
- No longer attempts to add `id`/`symptom_id` columns

### Error: "null value in column violates not-null constraint"
**Status:** ✅ Fixed in current version
- All seed inserts now use `symptom_key` (which exists in current schema)
- No longer attempts to insert into non-existent `symptom_id` column

## Post-Deployment Testing

1. **Test symptom selection UI:**
   ```bash
   # Start the app
   npm start
   # Navigate to symptom selection
   # Verify "Engine" category appears with 18 symptoms
   ```

2. **Test job flow:**
   - Create a new job with an engine symptom
   - Verify questions appear
   - Verify job creation succeeds

3. **Test RLS policies:**
   - Log in as customer → verify can see own jobs
   - Log in as mechanic → verify can see searching jobs

## Notes

- This migration is **idempotent** - safe to run multiple times
- All changes are **backward compatible** with existing code
- No data loss - only adds columns, constraints, and seed data
- **Schema model:** Uses `symptom_key` (text) as primary relationship field, not `id` (uuid)
