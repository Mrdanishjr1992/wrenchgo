# Understanding RLS: Why You Need Both Grants AND Policies

## The Confusion

Many developers think this is enough:

```sql
GRANT SELECT ON public.media_assets TO anon;
```

But when RLS is enabled, this **still returns "permission denied"**. Why?

## The Answer: Two-Layer Security

When RLS (Row Level Security) is enabled on a table, Postgres uses **two layers** of security:

### Layer 1: Table-Level Permissions (GRANT)
```sql
GRANT SELECT ON public.media_assets TO anon;
```
- **What it does:** Gives the role permission to *attempt* a SELECT
- **What it doesn't do:** Doesn't specify *which rows* the role can see

### Layer 2: Row-Level Policies (CREATE POLICY)
```sql
CREATE POLICY "media_assets_anon_public"
  ON public.media_assets FOR SELECT
  TO anon
  USING (uploaded_by IS NULL AND job_id IS NULL);
```
- **What it does:** Defines *which rows* the role can actually access
- **Default behavior:** If no policy exists, **all rows are blocked**

## Visual Example

```
User Query: SELECT * FROM media_assets;

┌─────────────────────────────────────┐
│ Layer 1: GRANT CHECK                │
│ Does 'anon' have SELECT permission? │
│ ✅ YES (because of GRANT)           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Layer 2: POLICY CHECK               │
│ Which rows can 'anon' see?          │
│ ❌ NONE (no policy exists)          │
│ Result: permission denied           │
└─────────────────────────────────────┘
```

With policy:
```
User Query: SELECT * FROM media_assets;

┌─────────────────────────────────────┐
│ Layer 1: GRANT CHECK                │
│ Does 'anon' have SELECT permission? │
│ ✅ YES (because of GRANT)           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ Layer 2: POLICY CHECK               │
│ Which rows can 'anon' see?          │
│ ✅ Rows where uploaded_by IS NULL   │
│    AND job_id IS NULL               │
│ Result: Returns matching rows       │
└─────────────────────────────────────┘
```

## Real-World Analogy

Think of it like a building with two security checkpoints:

1. **GRANT = Building Access Badge**
   - "You're allowed to enter the building"
   - But doesn't specify which floors/rooms

2. **POLICY = Floor/Room Access**
   - "You can only access the public lobby (floor 1)"
   - "You cannot access private offices (floors 2-10)"

Even with a building badge (GRANT), you still can't access restricted floors without proper clearance (POLICY).

## Common Mistakes

### ❌ Mistake 1: Only using GRANT
```sql
GRANT SELECT ON public.media_assets TO anon;
-- Result: permission denied (no policy)
```

### ❌ Mistake 2: Only using POLICY
```sql
CREATE POLICY "allow_anon" ON public.media_assets
  FOR SELECT TO anon USING (true);
-- Result: permission denied (no grant)
```

### ✅ Correct: Both GRANT and POLICY
```sql
-- Step 1: Grant table-level permission
GRANT SELECT ON public.media_assets TO anon;

-- Step 2: Define row-level access
CREATE POLICY "allow_anon_public"
  ON public.media_assets FOR SELECT
  TO anon
  USING (uploaded_by IS NULL AND job_id IS NULL);
```

## WrenchGo Example

### Our Requirements
- ✅ Anon users should see public assets (logo, ads)
- ❌ Anon users should NOT see private assets (user uploads, job photos)
- ✅ Authenticated users should see their own uploads
- ✅ Job participants should see job-related assets

### Our Solution
```sql
-- Grant: Allow anon to attempt SELECT
GRANT SELECT ON public.media_assets TO anon;

-- Policy: Define which rows anon can see
CREATE POLICY "media_assets_select_public_or_involved"
  ON public.media_assets FOR SELECT
  USING (
    -- Anon + authenticated can see public assets
    (uploaded_by IS NULL AND job_id IS NULL)
    OR
    -- Authenticated can see their own uploads
    (auth.uid() = uploaded_by)
    OR
    -- Authenticated can see job assets they're involved in
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = media_assets.job_id
      AND (jobs.customer_id = auth.uid() OR jobs.accepted_mechanic_id = auth.uid())
    )
  );
```

### How It Works

**Anon user queries:**
```sql
SET ROLE anon;
SELECT * FROM media_assets;
```
- ✅ Layer 1: Has GRANT
- ✅ Layer 2: Policy allows rows where `uploaded_by IS NULL AND job_id IS NULL`
- Result: Returns only public assets

**Authenticated user queries:**
```sql
-- User ID: 123e4567-e89b-12d3-a456-426614174000
SELECT * FROM media_assets;
```
- ✅ Layer 1: Has GRANT
- ✅ Layer 2: Policy allows:
  - Public assets (uploaded_by IS NULL AND job_id IS NULL)
  - Own uploads (uploaded_by = 123e4567...)
  - Job assets (if user is customer or mechanic on the job)
- Result: Returns public + own + job-related assets

## Key Takeaways

1. **RLS = Two-layer security**
   - GRANT = Table-level permission
   - POLICY = Row-level access

2. **Both are required**
   - GRANT without POLICY = permission denied
   - POLICY without GRANT = permission denied

3. **Default is deny**
   - With RLS enabled, no policy = no access
   - Explicit policies are required for each role

4. **Policies are additive**
   - Multiple policies for the same role are OR'd together
   - If any policy allows access, the row is visible

5. **auth.uid() is NULL for anon**
   - Anon users: `auth.uid() = NULL`
   - Authenticated users: `auth.uid() = user's UUID`
   - Use this to differentiate access

## Debugging RLS Issues

### Check if RLS is enabled
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'media_assets';
```

### Check grants
```sql
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'media_assets'
  AND grantee IN ('anon', 'authenticated');
```

### Check policies
```sql
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'media_assets';
```

### Test as anon
```sql
SET ROLE anon;
SELECT * FROM media_assets LIMIT 5;
RESET ROLE;
```

## Further Reading

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Postgres RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [RLS Performance Tips](https://supabase.com/docs/guides/database/postgres/row-level-security#performance)

---

**Remember:** With RLS enabled, you always need **both** GRANT and POLICY. One without the other will result in "permission denied".
