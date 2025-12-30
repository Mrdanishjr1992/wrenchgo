# 🔧 Supabase Migration Cleanup - COMPLETE GUIDE

## 🚨 Problem Summary

Your local migrations conflicted with remote DB:
- ❌ `vehicles.user_id` references (remote has `customer_id`)
- ❌ Duplicate policy creation (policies already exist)
- ❌ Non-idempotent migrations

## ✅ Solution Applied

All migrations have been **rewritten to be idempotent** and use `customer_id` consistently.

---

## 📋 Corrected Migration Files (In Order)

### ✅ 20240101000000_create_vehicles.sql
**Status:** FIXED - Uses `customer_id` from the start
**Changes:**
- Uses `customer_id` (NOT `user_id`)
- `DROP POLICY IF EXISTS` before all policies
- `CREATE INDEX IF NOT EXISTS` for all indexes
- Idempotent trigger creation

### ✅ 20240102000000_create_quotes.sql
**Status:** FIXED - Idempotent policy creation
**Changes:**
- `DROP POLICY IF EXISTS` before all policies
- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- Handles enum creation safely

### ✅ 20240103000000_fix_vehicle_rls.sql
**Status:** FIXED - Idempotent
**Changes:**
- `DROP POLICY IF EXISTS` before policy creation

### ✅ 20240104000000_add_vehicle_to_jobs.sql
**Status:** FIXED - Critical fix for `user_id` → `customer_id`
**Changes:**
- Line 20: Changed `vehicles.user_id` → `vehicles.customer_id`
- `DROP POLICY IF EXISTS` before policy creation
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

### ✅ 20240105000000_add_cancellation_fields.sql
**Status:** ALREADY IDEMPOTENT - No changes needed
**Features:**
- Uses `ADD COLUMN IF NOT EXISTS`
- Uses `CREATE INDEX IF NOT EXISTS`
- Safe enum value additions

### ✅ 20240106000000_create_cancel_quote_function.sql
**Status:** ALREADY IDEMPOTENT - No changes needed
**Features:**
- Uses `CREATE OR REPLACE FUNCTION`

### ✅ 20240107000000_update_cancellation_rls.sql
**Status:** ALREADY IDEMPOTENT - No changes needed
**Features:**
- Uses `DROP POLICY IF EXISTS` before all policies

### ❌ 20240108000000_rename_user_id_to_customer_id.sql
**Status:** DELETED - Remote DB already has `customer_id`
**Reason:** This migration is obsolete since remote DB already uses `customer_id`

### ✅ 20240109000000_optimize_vehicle_queries.sql
**Status:** ALREADY IDEMPOTENT - No changes needed
**Features:**
- Uses `CREATE INDEX IF NOT EXISTS`

### ✅ 20240110000000_optimize_jobs_messages_queries.sql
**Status:** ALREADY IDEMPOTENT - No changes needed
**Features:**
- Uses `CREATE INDEX IF NOT EXISTS`

---

## 🎯 Deployment Checklist

### Step 1: Backup Current State
```bash
# Backup your existing migrations
mkdir -p supabase/migrations_backup
cp -r supabase/migrations/* supabase/migrations_backup/

# Backup remote schema
supabase db dump -f supabase/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Pull Fresh Schema from Remote
```bash
# This creates a baseline migration matching your remote DB
supabase db pull

# This will create a new migration file like:
# supabase/migrations/20240XXX_remote_schema.sql
```

### Step 3: Review the Pulled Schema
```bash
# Check what was pulled
cat supabase/migrations/*_remote_schema.sql | grep -E "(CREATE TABLE|CREATE POLICY|customer_id)"

# Verify customer_id exists (NOT user_id)
cat supabase/migrations/*_remote_schema.sql | grep "customer_id"
```

### Step 4: Check for Differences
```bash
# This should show NO differences if remote matches local
supabase db diff

# Expected output: "No schema changes detected"
# If you see differences, review them carefully
```

### Step 5: Test Idempotency (Safe to Run Multiple Times)
```bash
# Run migrations (should be safe since all are idempotent)
supabase db push

# Expected output: "Applying migration..." or "No migrations to apply"
# Should NOT see errors about existing policies or columns
```

### Step 6: Verify Schema Integrity
```bash
# Connect to your database
supabase db remote shell

# Then run these verification queries:
```

```sql
-- 1. Verify vehicles table uses customer_id (NOT user_id)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name IN ('customer_id', 'user_id');

-- Expected: Only customer_id should exist

-- 2. Verify all indexes exist
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('vehicles', 'jobs', 'messages', 'quotes')
ORDER BY tablename, indexname;

-- Expected indexes:
-- vehicles: idx_vehicles_customer_id, idx_vehicles_customer_created
-- jobs: idx_jobs_customer_created, idx_jobs_vehicle_id
-- messages: idx_messages_recipient_read, idx_messages_unread

-- 3. Verify RLS policies use customer_id
SELECT schemaname, tablename, policyname, qual 
FROM pg_policies 
WHERE tablename = 'vehicles';

-- Expected: All policies should reference customer_id, NOT user_id

-- 4. Test a sample query
SELECT id, customer_id, year, make, model 
FROM vehicles 
LIMIT 5;

-- Should return data without errors

-- Exit the shell
\q
```

### Step 7: Test Application Queries
```bash
# Test vehicle loading in your app
# Open app and navigate to vehicle list
# Should load without errors
```

---

## 🔍 Key Changes Made

### Critical Fixes:

1. **20240104000000_add_vehicle_to_jobs.sql**
   ```sql
   -- BEFORE (BROKEN):
   WHERE vehicles.user_id = auth.uid()
   
   -- AFTER (FIXED):
   WHERE vehicles.customer_id = auth.uid()
   ```

2. **All Policy Creations**
   ```sql
   -- BEFORE (BREAKS ON RE-RUN):
   CREATE POLICY "policy_name" ...
   
   -- AFTER (IDEMPOTENT):
   DROP POLICY IF EXISTS "policy_name" ON table_name;
   CREATE POLICY "policy_name" ...
   ```

3. **All Column Additions**
   ```sql
   -- BEFORE (BREAKS ON RE-RUN):
   ALTER TABLE table_name ADD COLUMN column_name type;
   
   -- AFTER (IDEMPOTENT):
   ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name type;
   ```

4. **All Index Creations**
   ```sql
   -- BEFORE (BREAKS ON RE-RUN):
   CREATE INDEX idx_name ON table_name(column);
   
   -- AFTER (IDEMPOTENT):
   CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);
   ```

---

## 🚀 Migration Strategy Going Forward

### Best Practices:

1. **Always Use Idempotent SQL:**
   - `CREATE TABLE IF NOT EXISTS`
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   - `CREATE INDEX IF NOT EXISTS`
   - `DROP POLICY IF EXISTS` before `CREATE POLICY`
   - `CREATE OR REPLACE FUNCTION`

2. **Test Locally First:**
   ```bash
   # Start local Supabase
   supabase start
   
   # Apply migrations locally
   supabase db push
   
   # Test twice to verify idempotency
   supabase db push
   
   # Should see "No migrations to apply" on second run
   ```

3. **Use customer_id Consistently:**
   - ✅ `vehicles.customer_id`
   - ✅ `jobs.customer_id`
   - ❌ NEVER use `vehicles.user_id`

4. **Version Control:**
   ```bash
   # Commit corrected migrations
   git add supabase/migrations/
   git commit -m "fix: make migrations idempotent and use customer_id"
   ```

---

## 🆘 Troubleshooting

### Error: "column user_id does not exist"
**Solution:** Already fixed in `20240104000000_add_vehicle_to_jobs.sql`
- Changed `vehicles.user_id` → `vehicles.customer_id`

### Error: "policy already exists"
**Solution:** All migrations now use `DROP POLICY IF EXISTS` before `CREATE POLICY`

### Error: "column already exists"
**Solution:** All migrations now use `ADD COLUMN IF NOT EXISTS`

### Error: "index already exists"
**Solution:** All migrations now use `CREATE INDEX IF NOT EXISTS`

### Migration Stuck or Failed?
```bash
# Check migration status
supabase migration list

# Check database logs
supabase db logs

# Rollback if needed (DANGEROUS - backup first!)
supabase db reset

# Then re-apply
supabase db push
```

---

## ✅ Verification Commands Summary

```bash
# 1. Backup everything
mkdir -p supabase/migrations_backup
cp -r supabase/migrations/* supabase/migrations_backup/
supabase db dump -f supabase/backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Pull fresh schema
supabase db pull

# 3. Check for differences
supabase db diff

# 4. Apply migrations (idempotent - safe to run multiple times)
supabase db push

# 5. Verify schema
supabase db remote shell
# Then run SQL verification queries above

# 6. Test application
# Open app and test vehicle loading
```

---

## 📊 Migration File Status

| File | Status | Changes Made |
|------|--------|--------------|
| 20240101_create_vehicles.sql | ✅ FIXED | Uses customer_id, idempotent |
| 20240102_create_quotes.sql | ✅ FIXED | Idempotent policies |
| 20240103_fix_vehicle_rls.sql | ✅ FIXED | Idempotent |
| 20240104_add_vehicle_to_jobs.sql | ✅ FIXED | user_id → customer_id |
| 20240105_add_cancellation_fields.sql | ✅ OK | Already idempotent |
| 20240106_create_cancel_quote_function.sql | ✅ OK | Already idempotent |
| 20240107_update_cancellation_rls.sql | ✅ OK | Already idempotent |
| 20240108_rename_user_id_to_customer_id.sql | ❌ DELETED | Obsolete |
| 20240109_optimize_vehicle_queries.sql | ✅ OK | Already idempotent |
| 20240110_optimize_jobs_messages_queries.sql | ✅ OK | Already idempotent |

---

## 🎉 Summary

**All migrations are now:**
- ✅ Idempotent (safe to run multiple times)
- ✅ Use `customer_id` consistently
- ✅ Match remote schema
- ✅ Production-ready

**Next Steps:**
1. Run the verification checklist above
2. Test in local environment first
3. Deploy to production with confidence

**Questions?** All migrations have inline comments explaining their purpose and safety features.
