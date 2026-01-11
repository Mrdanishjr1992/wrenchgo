# Launch-Ready Migration Plan

## Findings

### Critical Issues

1. **Duplicate Migrations (MUST FIX)**
   - `0051_add_payout_method_status.sql` and `0071_add_payout_method_status.sql` are **IDENTICAL**
   - `0060_postgis_service_areas.sql`, `0063_fix_postgis_optional.sql`, and `0065_fix_postgis_optional.sql` are **IDENTICAL**
   - **Impact**: Will fail on re-run; wastes migration slots

2. **Missing Migration Number**
   - `0012` is missing from the sequence (jumps from 0011 to 0013)
   - **Impact**: Confusing; may indicate lost migration

3. **PostGIS Extension in Baseline**
   - `0001_baseline_schema.sql` creates PostGIS extension unconditionally
   - Later migrations (0060, 0063, 0065) try to create it again
   - **Impact**: Redundant; may fail in environments without PostGIS

4. **SECURITY DEFINER Functions Missing search_path**
   - Several functions use SECURITY DEFINER but don't set `search_path`
   - Examples: `sync_payout_method_status()`, `update_support_requests_updated_at()`
   - **Impact**: Security vulnerability - search_path injection possible

5. **RLS Not Enabled on New Tables**
   - Tables created after 0002 may not have RLS enabled:
     - `badge_history`, `review_media`, `review_reports`, `skill_verifications`, `trust_scores`
     - `message_audit_logs`, `user_violations`, `chat_restrictions`, `preferred_mechanics`
     - `chat_lifecycle_config`, `support_requests`, `user_rating_prompt_state`
   - **Impact**: Data exposure risk

6. **Storage Policies Overwrite Each Other**
   - `0049_support_phase1.sql` creates generic storage policies that may conflict
   - Policy names like "Users can upload own screenshots" are too generic
   - **Impact**: May break avatar uploads or other storage features

7. **Function References Non-Existent Columns**
   - `0068_fix_job_status_enum.sql` references `j.job_lat` and `j.job_lng` which don't exist in jobs table
   - Also references `calculate_distance_km()` function that may not exist
   - **Impact**: Function will fail at runtime

8. **Inconsistent Transaction Handling**
   - Some migrations use `BEGIN;`/`COMMIT;`, others don't
   - **Impact**: Partial failures may leave DB in inconsistent state

### Medium Issues

9. **Enum Modifications**
   - `job_status` enum has `work_in_progress` which may be redundant with `in_progress`
   - Quote status uses text CHECK constraint in `quotes` table but enum in `quote_requests`
   - **Impact**: Inconsistency; potential bugs

10. **Grants Not Comprehensive**
    - New tables after 0002 may not have proper grants
    - **Impact**: Access denied errors for authenticated users

11. **Seed Data in Migration**
    - `0014_seed_data.sql` contains seed data mixed with migrations
    - **Impact**: Seed data runs in production; not idempotent

12. **Multiple Promo Grant Migrations**
    - `0040_promo_grants.sql`, `0041_promo_grants2.sql`, `0042_promo_grants3.sql`
    - **Impact**: Indicates iterative fixes; should be consolidated

### Low Issues

13. **Redundant Indexes**
    - Some indexes may be redundant or suboptimal
    - **Impact**: Performance overhead

14. **Missing Comments**
    - Many tables/columns lack documentation
    - **Impact**: Maintainability

---

## Recommended Migration Order

### Phase 1: Deprecate Duplicates
Mark these as deprecated (rename with `_DEPRECATED` suffix):
- `0065_fix_postgis_optional.sql` → `0065_DEPRECATED_duplicate_of_0063.sql`
- `0071_add_payout_method_status.sql` → `0071_DEPRECATED_duplicate_of_0051.sql`

### Phase 2: Fill Gap
Create placeholder for missing migration:
- `0012_placeholder.sql` (empty migration with comment)

### Phase 3: Consolidated Baseline
For **new environments**, use a single consolidated baseline that represents the final schema state.

### Final Migration Order (Cleaned)
```
0001_baseline_schema.sql          # Extensions, enums, core tables
0002_rls_policies.sql             # RLS enable + policies for core tables
0003_functions_triggers.sql       # Core functions and triggers
0004_stripe_marketplace.sql       # Stripe integration
0005_indexes_performance.sql      # Performance indexes
0006_job_lifecycle.sql            # Job lifecycle additions
0007_job_lifecycle_functions.sql  # Job lifecycle RPCs
0008_quotes_customer_update.sql   # Quote updates
0009_notify_user_function.sql     # Notification function
0010_trust_system.sql             # Trust system tables
0011_trust_system_rls.sql         # Trust system RLS
0012_placeholder.sql              # [NEW] Placeholder for missing migration
0013_update_profile_card.sql      # Profile card updates
0014_seed_data.sql                # Seed data (make idempotent)
... (continue with remaining migrations)
0063_fix_postgis_optional.sql     # PostGIS (keep this one)
0064_rating_prompt_system.sql     # Rating prompts
0065_DEPRECATED.sql               # [DEPRECATED] Duplicate of 0063
... 
0071_DEPRECATED.sql               # [DEPRECATED] Duplicate of 0051
...
0080_update_get_public_profile_card.sql
```

---

## Action Items

### Immediate Fixes Required

1. **Create `0012_placeholder.sql`**
2. **Rename duplicate migrations**
3. **Add missing RLS to new tables**
4. **Fix SECURITY DEFINER functions**
5. **Fix `0068` function to use correct column names**
6. **Make storage policies bucket-specific**

---

## Verification Checklist

See `verification_checklist.sql` for queries to validate:
- Extensions installed
- Tables exist
- RLS enabled
- Policies present
- Grants correct
- Functions/triggers present
- Critical RPCs executable

---

## CI Script

See `ci_migrate.sh` for Supabase CLI migration script.
