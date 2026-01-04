# Archived Migrations - 2026-01-04

This folder contains patch migrations that were created during debugging and have been merged into the main migration files.

## Archived Files

### 20260104012628_add_symptom_mappings_seed_data.sql
- **Purpose**: Added symptom_mappings seed data
- **Merged into**: `20250127000005_seed_data.sql`
- **Status**: Symptom mappings already existed in seed data

### 20260104014322_fix_handle_new_user_function.sql
- **Purpose**: Fixed handle_new_user to not explicitly set id column
- **Merged into**: `20250127000003_functions_triggers.sql`
- **Status**: Function already correct in baseline

### 20260104014713_grant_trigger_permissions.sql
- **Purpose**: Added grants and exception handling to handle_new_user
- **Merged into**: `20250127000003_functions_triggers.sql`
- **Status**: Permissions and error handling incorporated

### 20260104015503_make_set_user_role_idempotent.sql
- **Purpose**: Made set_user_role idempotent (allow same role to be set multiple times)
- **Merged into**: `20250127000003_functions_triggers.sql`
- **Status**: Idempotency logic incorporated

### 20260104015933_fix_corrupted_role_data.sql
- **Purpose**: Reset corrupted role values to NULL
- **Status**: One-time data fix, not needed in baseline

### 20260104022103_ensure_profiles_for_auth_users.sql
- **Purpose**: Create profiles for auth users missing them
- **Status**: One-time data fix, not needed in baseline

### 20260104022508_add_missing_profile_columns.sql
- **Purpose**: Added email and phone columns to profiles table
- **Merged into**: `20250127000001_baseline_schema.sql`
- **Status**: Columns already in baseline schema

### 20260104022623_recreate_missing_profiles.sql
- **Purpose**: Recreate profiles for users who got stuck during schema mismatch
- **Status**: One-time data fix, not needed in baseline

### 20260104023541_fix_postgres_role_corruption.sql
- **Purpose**: Reset invalid role values (like 'postgres') to NULL
- **Status**: One-time data fix, not needed in baseline

### 20260104023656_force_reset_specific_user_role.sql
- **Purpose**: Force reset role for specific user with corrupted data
- **Status**: One-time data fix, not needed in baseline

### 20260104023747_recreate_set_user_role_function.sql
- **Purpose**: Updated set_user_role to handle enum types with dynamic SQL
- **Merged into**: `20250127000003_functions_triggers.sql`
- **Status**: Enum handling incorporated

### 20260104024053_fix_role_column_type_mismatch.sql
- **Purpose**: Ensure user_role enum exists and update set_user_role to handle it
- **Merged into**: 
  - `20250127000001_baseline_schema.sql` (user_role enum type)
  - `20250127000003_functions_triggers.sql` (function with enum handling)
- **Status**: Enum type and handling fully incorporated

## Key Changes Merged

1. **user_role enum type**: Added to baseline schema (20250127000001)
2. **profiles.role column**: Changed from `text CHECK` to `user_role` enum type
3. **set_user_role function**: Updated to handle enum type with dynamic SQL and better validation
4. **handle_new_user function**: Already correct, no changes needed
5. **Idempotency**: set_user_role now allows setting the same role multiple times

## Migration Order (Final)

1. `20250127000000_fix_role_selection_flow.sql` - No-op placeholder
2. `20250127000001_baseline_schema.sql` - All tables, types, extensions
3. `20250127000002_rls_policies.sql` - Row Level Security policies
4. `20250127000003_functions_triggers.sql` - Functions and triggers
5. `20250127000004_indexes_performance.sql` - Performance indexes
6. `20250127000005_seed_data.sql` - Seed data
7. `20250127000006_project_b_integration.sql` - Project B integration
8. `20250202000000_create_media_assets.sql` - Media assets table
9. `20250202000001_repair_reserved_word_columns.sql` - Repair reserved word columns

## Testing

All migrations have been tested with `supabase db reset` and run successfully without errors.
