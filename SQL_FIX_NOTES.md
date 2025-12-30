# ✅ SQL Syntax Error Fixed!

## Issue
PostgreSQL's `CREATE POLICY` statement does **not** support `IF NOT EXISTS` syntax.

The original migration had:
```sql
CREATE POLICY IF NOT EXISTS "Users can upload own ID documents"
```

This caused a syntax error: `syntax error at or near "NOT"`

## Fix Applied
Changed to use `DROP POLICY IF EXISTS` before `CREATE POLICY`:

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own ID documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all ID documents" ON storage.objects;

-- Then create the policies
CREATE POLICY "Users can upload own ID documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (...);
```

## Files Updated
1. ✅ `supabase/migrations/20240120000001_create_identity_storage.sql`
2. ✅ `supabase/migrations/DEPLOY_ALL_ID_VERIFICATION.sql`

## Safe to Re-run
The migration is now **idempotent** - you can run it multiple times safely:
- `DROP POLICY IF EXISTS` won't error if the policy doesn't exist
- `CREATE POLICY` will create the policy fresh each time

## Ready to Deploy
The SQL is now correct and ready to run in Supabase Dashboard!

Follow `QUICK_START.md` to deploy in 5 minutes.
