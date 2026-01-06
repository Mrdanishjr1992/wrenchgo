# Understanding SECURITY DEFINER and RLS Bypass

## The Problem

Even with `SECURITY DEFINER`, a function can still hit "permission denied" when accessing tables with RLS enabled. Why?

## The Answer: Function Owner Must Match Table Owner

In PostgreSQL/Supabase, **SECURITY DEFINER alone is not enough to bypass RLS**. The function must be:

1. ✅ Marked as `SECURITY DEFINER`
2. ✅ **Owned by the same role that owns the table**

### Example

```sql
-- Table owned by postgres
SELECT tableowner FROM pg_tables WHERE tablename = 'profiles';
-- Result: postgres

-- Function owned by different role
CREATE FUNCTION set_user_role(...) SECURITY DEFINER ...;
ALTER FUNCTION set_user_role(...) OWNER TO some_other_role;

-- ❌ This will fail with "permission denied"
-- Even though it's SECURITY DEFINER, the owner doesn't match
```

### The Fix

```sql
-- Ensure table is owned by postgres
ALTER TABLE public.profiles OWNER TO postgres;

-- Ensure function is owned by postgres (same as table)
ALTER FUNCTION public.set_user_role(...) OWNER TO postgres;

-- ✅ Now SECURITY DEFINER will bypass RLS
```

## Why This Matters

### RLS Bypass Rules in PostgreSQL

From the PostgreSQL documentation:

> Row security policies are not applied when the table owner accesses the table.

This means:
- If `postgres` owns `public.profiles`
- And `postgres` owns the function `set_user_role`
- Then when the function runs, it executes **as postgres**
- And postgres (as table owner) **bypasses RLS**

### What Happens Without Matching Ownership

```
User calls: SELECT public.set_user_role('customer');

┌─────────────────────────────────────────┐
│ Function: set_user_role                 │
│ Owner: some_other_role                  │
│ SECURITY DEFINER: Runs as owner         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Tries to: SELECT FROM profiles          │
│ Table owner: postgres                   │
│ Function owner: some_other_role         │
│ RLS enabled: YES                        │
│ Owner match: NO                         │
│ Result: ❌ permission denied            │
└─────────────────────────────────────────┘
```

### With Matching Ownership

```
User calls: SELECT public.set_user_role('customer');

┌─────────────────────────────────────────┐
│ Function: set_user_role                 │
│ Owner: postgres                         │
│ SECURITY DEFINER: Runs as postgres      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Tries to: SELECT FROM profiles          │
│ Table owner: postgres                   │
│ Function owner: postgres                │
│ RLS enabled: YES                        │
│ Owner match: YES                        │
│ Result: ✅ RLS bypassed (table owner)   │
└─────────────────────────────────────────┘
```

## WrenchGo Implementation

### Our Tables
```sql
-- Ensure postgres owns critical tables
ALTER TABLE public.profiles OWNER TO postgres;
ALTER TABLE public.mechanic_profiles OWNER TO postgres;
```

### Our Function
```sql
CREATE OR REPLACE FUNCTION public.set_user_role(new_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as function owner
SET search_path = public, pg_temp  -- Prevent hijacking
AS $$
DECLARE
  uid uuid;
BEGIN
  uid := auth.uid();
  
  -- This SELECT will bypass RLS because:
  -- 1. Function is SECURITY DEFINER
  -- 2. Function owner (postgres) = Table owner (postgres)
  SELECT role INTO current_role
  FROM public.profiles
  WHERE id = uid;
  
  -- This UPDATE will also bypass RLS
  UPDATE public.profiles
  SET role = new_role
  WHERE id = uid;
END;
$$;

-- Critical: Ensure function is owned by postgres
ALTER FUNCTION public.set_user_role(public.user_role) OWNER TO postgres;
```

## Common Mistakes

### ❌ Mistake 1: Assuming SECURITY DEFINER is enough
```sql
CREATE FUNCTION set_user_role(...) SECURITY DEFINER ...;
-- Missing: ALTER FUNCTION ... OWNER TO postgres;
-- Result: permission denied
```

### ❌ Mistake 2: Wrong owner
```sql
ALTER FUNCTION set_user_role(...) OWNER TO authenticated;
-- Wrong: authenticated is not the table owner
-- Result: permission denied
```

### ❌ Mistake 3: Table owned by different role
```sql
ALTER TABLE profiles OWNER TO some_other_role;
ALTER FUNCTION set_user_role(...) OWNER TO postgres;
-- Mismatch: Table owner ≠ Function owner
-- Result: permission denied
```

### ✅ Correct: Matching ownership
```sql
ALTER TABLE public.profiles OWNER TO postgres;
ALTER FUNCTION public.set_user_role(...) OWNER TO postgres;
-- Match: Both owned by postgres
-- Result: RLS bypassed
```

## Security Considerations

### Is This Safe?

Yes, when done correctly:

1. **Function validates auth context**
   ```sql
   uid := auth.uid();
   IF uid IS NULL THEN
     RAISE EXCEPTION 'No auth.uid() in context';
   END IF;
   ```

2. **Function only updates user's own data**
   ```sql
   UPDATE profiles SET role = new_role WHERE id = uid;
   -- uid comes from auth.uid(), not user input
   ```

3. **Execute permissions restricted**
   ```sql
   REVOKE ALL ON FUNCTION set_user_role(...) FROM PUBLIC, anon;
   GRANT EXECUTE ON FUNCTION set_user_role(...) TO authenticated;
   -- Only authenticated users can call it
   ```

4. **Safe search_path**
   ```sql
   SET search_path = public, pg_temp
   -- Prevents function hijacking via schema manipulation
   ```

### What Could Go Wrong?

**Without proper ownership:**
- ❌ Function fails with "permission denied"
- ❌ Users can't set their role
- ❌ App breaks

**With proper ownership but bad function logic:**
- ❌ If function doesn't validate `auth.uid()`, users could modify other profiles
- ❌ If function doesn't restrict execute permissions, anon could call it
- ❌ If function doesn't use safe search_path, could be hijacked

**Our implementation prevents all of these:**
- ✅ Validates `auth.uid()` is not NULL
- ✅ Only updates `WHERE id = uid` (user's own profile)
- ✅ Only `authenticated` role can execute
- ✅ Uses safe `search_path = public, pg_temp`

## Debugging Ownership Issues

### Check table ownership
```sql
SELECT 
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'mechanic_profiles');
```

### Check function ownership
```sql
SELECT 
  proname as function_name,
  pg_get_userbyid(proowner) as owner
FROM pg_proc
WHERE proname = 'set_user_role'
  AND pronamespace = 'public'::regnamespace;
```

### Check if they match
```sql
SELECT 
  t.tablename,
  t.tableowner as table_owner,
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as function_owner,
  CASE 
    WHEN t.tableowner = pg_get_userbyid(p.proowner) 
    THEN '✅ MATCH' 
    ELSE '❌ MISMATCH' 
  END as status
FROM pg_tables t
CROSS JOIN pg_proc p
WHERE t.schemaname = 'public'
  AND t.tablename = 'profiles'
  AND p.proname = 'set_user_role'
  AND p.pronamespace = 'public'::regnamespace;
```

Expected output:
```
tablename | table_owner | function_name  | function_owner | status
----------|-------------|----------------|----------------|----------
profiles  | postgres    | set_user_role  | postgres       | ✅ MATCH
```

## Key Takeaways

1. **SECURITY DEFINER + Matching Ownership = RLS Bypass**
   - Function must be owned by table owner
   - In Supabase, this is typically `postgres`

2. **Check ownership when debugging**
   - "permission denied" in SECURITY DEFINER function?
   - First check: Does function owner = table owner?

3. **Set ownership explicitly**
   - Don't assume default ownership is correct
   - Always use `ALTER TABLE ... OWNER TO postgres`
   - Always use `ALTER FUNCTION ... OWNER TO postgres`

4. **This is safe when combined with:**
   - Auth validation (`auth.uid()`)
   - Restricted execute permissions
   - Safe search_path
   - Proper WHERE clauses

## Further Reading

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase SECURITY DEFINER Functions](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker)
- [PostgreSQL Function Security](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)

---

**Remember:** For SECURITY DEFINER to bypass RLS, the function owner must match the table owner. In Supabase, this is typically `postgres`.
