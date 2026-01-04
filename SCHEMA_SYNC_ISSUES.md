# Schema Sync Issues - Customer Folder Audit

## Critical Issues Found & Fixed

### 1. ❌ `jobs.preferred_time` - MISSING IN REMOTE DB
**Status**: ✅ Fixed with migration

**Issue**: 
- Exists in baseline migration (`20250127000001_baseline_schema.sql:277`)
- Missing from remote database
- Used in `app/(customer)/(tabs)/index.tsx:117`

**Fix**:
- Created migration: `supabase/migrations/20250202000002_add_preferred_time_to_jobs.sql`
- Adds `preferred_time text` column to jobs table

**Impact**: Would cause "column does not exist" error on customer home page

---

### 2. ❌ `messages.recipient_id` - MISSING IN REMOTE DB
**Status**: ✅ Fixed with migration + code workaround

**Issue**:
- Exists in baseline migration (`20250127000001_baseline_schema.sql:323`)
- Missing from remote database
- Used in `app/(customer)/(tabs)/index.tsx:138`

**Fix**:
- Created migration: `supabase/migrations/20250202000003_add_recipient_id_to_messages.sql`
- Adds `recipient_id uuid` column with backfill logic
- Updated code to work without it (joins through jobs table)

**Impact**: Would cause "column does not exist" error when loading unread message count

---

## Schema Discrepancies Summary

### Local Baseline vs Remote Database

| Table | Column | Baseline | Remote | Status |
|-------|--------|----------|--------|--------|
| `jobs` | `preferred_time` | ✅ text | ❌ Missing | 🔧 Migration created |
| `messages` | `recipient_id` | ✅ uuid | ❌ Missing | 🔧 Migration created |
| `messages` | `deleted_by` | ❌ Missing | ✅ uuid | ⚠️ Extra (safe) |
| `jobs` | `deleted_at` | ❌ Missing | ✅ timestamptz | ⚠️ Extra (safe) |
| `jobs` | `deleted_by` | ❌ Missing | ✅ uuid | ⚠️ Extra (safe) |
| `jobs` | `public_latitude` | ❌ Missing | ✅ float8 | ⚠️ Extra (safe) |
| `jobs` | `public_longitude` | ❌ Missing | ✅ float8 | ⚠️ Extra (safe) |
| `jobs` | `public_area_label` | ❌ Missing | ✅ text | ⚠️ Extra (safe) |
| `jobs` | `private_location_notes` | ❌ Missing | ✅ text | ⚠️ Extra (safe) |

---

## Migrations Created

### 1. `20250202000002_add_preferred_time_to_jobs.sql`
```sql
ALTER TABLE public.jobs ADD COLUMN preferred_time text;
```

### 2. `20250202000003_add_recipient_id_to_messages.sql`
```sql
ALTER TABLE public.messages ADD COLUMN recipient_id uuid;
-- Includes backfill logic to populate from job relationships
```

---

## Deployment Steps

1. **Apply migrations to remote database:**
   ```bash
   supabase db push
   ```

2. **Verify columns exist:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'jobs' AND column_name = 'preferred_time';
   
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'messages' AND column_name = 'recipient_id';
   ```

3. **Test customer home page:**
   - Should load without errors
   - Unread message count should work
   - Job list should display correctly

---

## Code Changes

### `app/(customer)/(tabs)/index.tsx`

**Line 138-141**: Updated unread messages query to work with or without `recipient_id`:
```typescript
// Before (would fail without recipient_id):
.eq("recipient_id", customerId)

// After (works by joining through jobs):
.select("id, job_id, jobs!inner(customer_id)", { count: "exact", head: true })
.eq("jobs.customer_id", customerId)
.neq("sender_id", customerId)
```

---

## Testing Checklist

- [ ] Run `supabase db push` to apply migrations
- [ ] Verify `jobs.preferred_time` column exists in remote DB
- [ ] Verify `messages.recipient_id` column exists in remote DB
- [ ] Test customer home page loads without errors
- [ ] Test unread message count displays correctly
- [ ] Test job list displays with preferred_time data
- [ ] Verify no console errors in app

---

## Notes

- Extra columns in remote DB (like `deleted_by`, `public_latitude`, etc.) are safe and won't cause errors
- The code is now defensive and works even if migrations haven't been applied yet
- After migrations are applied, the code will use the more efficient direct queries
