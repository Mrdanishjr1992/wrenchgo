# Migration Archive Plan

## Overview
This document outlines the plan for archiving old migrations and consolidating them into a clean baseline.

## Current State
The `supabase/migrations/` directory contains 50+ individual migration files created during development. These migrations include:
- Schema changes
- RLS policies
- Functions and triggers
- Stripe marketplace features
- ID verification features (now removed)
- Various bug fixes and enhancements

## New Consolidated Migrations

### 1. `20250210000001_baseline_schema.sql`
**Purpose**: Establishes the complete database schema
**Contents**:
- Extensions: `uuid-ossp`, `pg_trgm`, `btree_gin`, `pg_net`
- Enums: `job_status`, `quote_request_status`, `quote_status`
- All tables with proper constraints and foreign keys
- **Key Changes**:
  - Removed all ID verification columns from `profiles`
  - Added `city` and `state` as text columns
  - Added `home_lat` and `home_lng` for customer location
  - Added `theme_preference` for UI theme persistence

### 2. `20250210000002_rls_policies.sql`
**Purpose**: Implements Row Level Security
**Contents**:
- RLS enabled on all tables
- Policies for all user roles (customer, mechanic, admin)
- **Key Changes**:
  - Removed ID verification related policies

### 3. `20250210000003_functions_triggers.sql`
**Purpose**: Database functions and triggers
**Contents**:
- User role management functions
- Auto-update timestamp triggers
- Helper functions for mechanic leads and profiles
- **Key Changes**:
  - Removed all ID verification functions and triggers

### 4. `20250210000004_stripe_marketplace.sql`
**Purpose**: Stripe payment integration
**Contents**:
- Stripe account tables
- Payment and webhook tables
- RLS policies for payment data
- Payment processing functions

### 5. `20250210000005_indexes_performance.sql`
**Purpose**: Database performance optimization
**Contents**:
- Indexes on foreign keys
- Full-text search indexes
- Composite indexes for common queries

### 6. `20250210000006_seed_data.sql` (Optional)
**Purpose**: Initial lookup data
**Contents**:
- Symptoms
- Skills
- Tools
- Safety measures
**Note**: Uses `ON CONFLICT DO NOTHING` for safe re-runs

### 7. `20250210000007_cleanup_and_enhancements.sql`
**Purpose**: Final cleanup and new features
**Contents**:
- Drops all remaining ID verification artifacts
- Ensures theme and location fields exist
- Creates helpful views:
  - `jobs_with_customer_profile`: Jobs with customer details
  - `jobs_with_mechanic_profile`: Jobs with mechanic details
  - `get_job_with_profiles()`: Function to get job with both profiles

## Archive Process

### For Fresh Installations
1. Delete all old migrations from `supabase/migrations/`
2. Keep only the 7 new consolidated migrations
3. Run `supabase db reset` to apply clean schema

### For Existing Databases
**DO NOT** delete old migrations if your database has already applied them. Instead:

1. **Keep all existing migrations** in place
2. **Add the cleanup migration** only:
   ```bash
   # Copy only the cleanup migration
   cp supabase/migrations/20250210000007_cleanup_and_enhancements.sql supabase/migrations/
   ```
3. **Apply the cleanup**:
   ```bash
   supabase db push
   ```

### Archive Location
Move old migrations to `supabase/migrations/archive/` for reference:
```bash
mkdir -p supabase/migrations/archive
mv supabase/migrations/202501*.sql supabase/migrations/archive/
mv supabase/migrations/202502*.sql supabase/migrations/archive/
# Keep the 7 new consolidated migrations
```

## App Code Changes

### Removed Features
1. **ID Verification UI**: No screens or components for ID verification
2. **Eligibility Checks**: Removed `check_customer_eligibility` RPC calls from:
   - `app/(customer)/request-service.tsx`
   - `app/(customer)/job/[id].tsx`

### Updated Features
1. **Profile Management**: Uses `home_lat`, `home_lng`, `city`, `state` fields
2. **Theme Persistence**: `theme_preference` stored in profiles table
3. **Location Fields**: Consistent use of location fields across mechanic and customer profiles

### No Changes Needed
- Job queries work correctly with foreign key relationships
- Payment flows remain unchanged
- Message and notification systems unchanged

## Testing Checklist

### Fresh Installation
- [ ] Drop and recreate database
- [ ] Apply all 7 migrations in order
- [ ] Verify all tables exist
- [ ] Verify RLS policies work
- [ ] Test user registration (customer and mechanic)
- [ ] Test job creation and quote flow
- [ ] Test payment setup
- [ ] Verify no ID verification prompts appear

### Existing Database
- [ ] Backup production database
- [ ] Apply cleanup migration to staging
- [ ] Verify ID verification columns removed
- [ ] Verify new views work
- [ ] Test job creation without eligibility checks
- [ ] Test quote acceptance without ID verification
- [ ] Verify theme persistence works
- [ ] Test location features
- [ ] Apply to production after staging validation

## Rollback Plan

### If Issues Occur
1. **Fresh installations**: Restore from backup before migration
2. **Existing databases**: 
   - Revert the cleanup migration
   - Restore ID verification columns if needed
   - Re-enable eligibility checks in app code

### Rollback SQL (Emergency Only)
```sql
-- Add back ID verification columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS id_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS id_status text DEFAULT 'not_uploaded';

-- Re-enable old eligibility function (simplified)
CREATE OR REPLACE FUNCTION public.check_customer_eligibility(customer_auth_id uuid)
RETURNS jsonb AS $$
BEGIN
  RETURN jsonb_build_object('eligible', true, 'missing', '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Benefits of Consolidation

1. **Cleaner History**: Single source of truth for schema
2. **Faster Setup**: New developers can set up in minutes
3. **Easier Maintenance**: Changes are easier to track
4. **Better Documentation**: Each migration has clear purpose
5. **Reduced Complexity**: No need to understand 50+ migration files
6. **Feature Removal**: Clean removal of ID verification system

## Timeline

1. **Phase 1** (Completed): Create consolidated migrations
2. **Phase 2** (Completed): Update app code
3. **Phase 3** (Next): Test on fresh database
4. **Phase 4** (Next): Test cleanup migration on staging
5. **Phase 5** (Next): Archive old migrations
6. **Phase 6** (Final): Deploy to production

## Notes

- Old migrations are preserved in archive for reference
- Consolidated migrations are idempotent where possible
- Seed data migration can be run multiple times safely
- Views provide backward compatibility for common queries
- No breaking changes to existing app functionality (except ID verification removal)
