# 🚀 Quick Migration Fix - Command Reference

## ⚡ TL;DR - Run These Commands

```bash
# 1. Backup (CRITICAL - Do this first!)
mkdir -p supabase/migrations_backup
cp -r supabase/migrations/* supabase/migrations_backup/

# 2. Pull fresh schema from remote
supabase db pull

# 3. Check for differences
supabase db diff

# 4. Apply migrations (now idempotent - safe!)
supabase db push

# 5. Verify (should see customer_id, NOT user_id)
supabase db remote shell
```

## 🔍 Quick Verification SQL

```sql
-- Check customer_id exists (NOT user_id)
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'vehicles' AND column_name IN ('customer_id', 'user_id');
-- Expected: Only 'customer_id'

-- Check all indexes exist
SELECT tablename, indexname FROM pg_indexes 
WHERE tablename IN ('vehicles', 'jobs', 'messages')
ORDER BY tablename;

-- Exit
\q
```

## ✅ What Was Fixed

| File | Issue | Fix |
|------|-------|-----|
| 20240104_add_vehicle_to_jobs.sql | `vehicles.user_id` | → `vehicles.customer_id` |
| 20240102_create_quotes.sql | Duplicate policies | Added `DROP POLICY IF EXISTS` |
| 20240101_create_vehicles.sql | Non-idempotent | Added `IF NOT EXISTS` everywhere |
| 20240108_rename_user_id_to_customer_id.sql | Obsolete | DELETED |

## 🎯 Key Rules

1. **Always use `customer_id`** (NEVER `user_id` in vehicles table)
2. **All migrations are now idempotent** (safe to run multiple times)
3. **Remote DB is source of truth** (already has `customer_id`)

## 📚 Full Guide

See `MIGRATION_CLEANUP_GUIDE.md` for complete documentation.

---

**Status:** ✅ All migrations fixed and ready to deploy
