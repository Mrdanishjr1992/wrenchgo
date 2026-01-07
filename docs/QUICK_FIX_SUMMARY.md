# Quick Fix Summary

## The Problem
Your app shows these errors because the database is missing:
1. ❌ `set_user_role()` function
2. ❌ RLS policy for anon access to public media assets
3. ❌ Proper table ownership for RLS bypass

## The Solution (2 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Click "SQL Editor" → "New query"

### Step 2: Run the Hotfix
1. Open `HOTFIX_APPLY_NOW.sql` in this project
2. Copy ALL contents
3. Paste into SQL Editor
4. Click "Run" (or `Ctrl+Enter`)

### Step 3: Restart App
```bash
npx expo start -c
```

## What Gets Fixed

### ✅ Ensures proper table ownership
- Sets `postgres` as owner of `profiles` and `mechanic_profiles`
- **Critical:** SECURITY DEFINER only bypasses RLS when function owner = table owner
- Without this, you get "permission denied for table profiles"

### ✅ Creates `set_user_role()` function
- Allows users to choose customer or mechanic role
- Uses SECURITY DEFINER to bypass RLS safely
- Owned by `postgres` (same as table owner)
- Only authenticated users can call it
- Auto-creates mechanic_profile when needed

### ✅ Adds RLS policy for media_assets
- Anon users can see public assets (logo, ads)
- Authenticated users can see their own uploads
- Job participants can see job-related assets
- **Critical:** With RLS enabled, you need BOTH grants AND policies

## Key Insights

### 1. RLS Requires Policies + Grants

When RLS is enabled on a table:

```sql
-- ❌ This alone doesn't work:
GRANT SELECT ON public.media_assets TO anon;

-- ✅ You also need a policy:
CREATE POLICY "allow_anon_public"
  ON public.media_assets FOR SELECT
  TO anon
  USING (uploaded_by IS NULL AND job_id IS NULL);
```

**Why?** 
- GRANT = Permission to attempt the operation
- POLICY = Which rows you can actually access

Without the policy, RLS blocks everything by default.

### 2. SECURITY DEFINER Requires Matching Ownership

For SECURITY DEFINER to bypass RLS:

```sql
-- ❌ This doesn't bypass RLS:
CREATE FUNCTION set_user_role(...) SECURITY DEFINER ...;
-- (function owner ≠ table owner)

-- ✅ This bypasses RLS:
ALTER TABLE profiles OWNER TO postgres;
ALTER FUNCTION set_user_role(...) OWNER TO postgres;
-- (function owner = table owner)
```

**Why?**
- PostgreSQL only bypasses RLS for the **table owner**
- SECURITY DEFINER runs the function **as the function owner**
- If function owner = table owner, RLS is bypassed
- If they don't match, you get "permission denied"

## Security

### Why SECURITY DEFINER is Safe
- Function only updates the user's own profile (`auth.uid()`)
- Validates auth context exists
- Uses safe `search_path = public, pg_temp`
- Only `authenticated` role can execute
- Owned by `postgres` to ensure RLS bypass works

### Why Anon Access is Safe
- RLS policy restricts anon to **only** public assets
- Private assets (uploads, job photos) are blocked
- Policy: `uploaded_by IS NULL AND job_id IS NULL`

## Verification

After running the hotfix, the SQL Editor will show:
- ✅ Tables owned by postgres
- ✅ Function exists with DEFINER security
- ✅ Function owned by postgres (matches table owner)
- ✅ Only authenticated can execute
- ✅ Anon has SELECT grant
- ✅ RLS policy exists
- ✅ Anon can query public assets

## Files

- **HOTFIX_APPLY_NOW.sql** - Run this in SQL Editor
- **APPLY_HOTFIX_INSTRUCTIONS.md** - Detailed guide
- **docs/RLS_EXPLAINED.md** - Why grants + policies are needed
- **docs/SECURITY_DEFINER_EXPLAINED.md** - Why ownership matters

---

**Time:** 2 minutes  
**Risk:** Low  
**Security:** High

**Critical Fix:** The hotfix now includes `ALTER TABLE ... OWNER TO postgres` to ensure SECURITY DEFINER functions can bypass RLS properly.
