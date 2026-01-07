# 🚨 URGENT: Apply Hotfix Now

## Problem
Your app is showing these errors:
1. ❌ "permission denied for table media_assets" (Error 42501)
2. ❌ "Could not find the function public.set_user_role(new_role) in the schema cache"

## Root Cause
The migrations were updated but not applied to your remote Supabase database. Additionally, **RLS policies are required** - GRANT statements alone don't work when RLS is enabled on tables.

---

## Step-by-Step Instructions

### Option 1: Apply Hotfix via Supabase SQL Editor (FASTEST - 2 minutes)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your WrenchGo project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste the Hotfix**
   - Open the file `HOTFIX_APPLY_NOW.sql` in this project
   - Copy ALL the contents (including verification queries at the end)
   - Paste into the SQL Editor

4. **Run the Query**
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for "Success. No rows returned" (or verification results)

5. **Check Verification Results**
   - Scroll down in the SQL Editor to see the verification query results
   - You should see:
     - ✅ `set_user_role | FUNCTION | DEFINER | true`
     - ✅ `set_user_role | postgres` (function owner)
     - ✅ `authenticated` has EXECUTE permission (anon should NOT)
     - ✅ `media_assets | SELECT | anon`
     - ✅ Policy `media_assets_select_public_or_involved` exists
     - ✅ Anon can query public assets without permission denied

6. **Restart Your App**
   - Stop the Expo dev server (`Ctrl+C`)
   - Clear cache: `npx expo start -c`
   - Test Google sign-in and role selection

---

### Option 2: Link Project and Push Migrations (RECOMMENDED for future)

If you want to use `supabase db push` in the future, you need to link your project first:

1. **Get your project reference**
   - Go to https://supabase.com/dashboard
   - Select your WrenchGo project
   - Go to Settings > General
   - Copy the "Reference ID" (looks like `abcdefghijklmnop`)

2. **Link the project**
   ```powershell
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

3. **Reset and push migrations**
   ```powershell
   npx supabase db reset --linked
   ```

---

## What the Hotfix Does

### Fix 1: Creates `set_user_role()` function with proper security
- **SECURITY DEFINER** - Runs with table owner privileges to bypass RLS
- **Safe search_path** - Uses `public, pg_temp` to prevent function hijacking
- **Explicit auth check** - Validates `auth.uid()` is not NULL
- **Ownership** - Owned by `postgres` (table owner) to ensure RLS bypass works
- **Execute permissions** - Only `authenticated` role can call it (anon cannot)
- **One-time only** - Prevents role changes after initial selection
- **Auto-creates mechanic_profile** - When user chooses mechanic role

### Fix 2: Grants SELECT to anon role on media_assets
- Allows unauthenticated users to query the table
- **BUT: Grant alone is not enough!** RLS policies are also required

### Fix 3: Creates RLS policy for public media assets
- **Critical:** With RLS enabled, you need BOTH grants AND policies
- Policy allows:
  - ✅ **Anon users** - Can see public assets (`uploaded_by IS NULL AND job_id IS NULL`)
  - ✅ **Authenticated users** - Can see their own uploads
  - ✅ **Job participants** - Can see job-related assets they're involved in
- Policy blocks:
  - ❌ **Anon users** - Cannot see private/job-related assets

---

## Why Both Grants AND Policies Are Required

When RLS is enabled on a table:

1. **GRANT** - Gives the role permission to attempt the operation
2. **POLICY** - Defines which rows the role can actually access

Without the policy, even with GRANT, all queries return "permission denied" because RLS blocks everything by default.

**Example:**
```sql
-- This alone doesn't work with RLS enabled:
GRANT SELECT ON public.media_assets TO anon;

-- You also need a policy:
CREATE POLICY "media_assets_anon_public"
  ON public.media_assets FOR SELECT
  TO anon
  USING (uploaded_by IS NULL AND job_id IS NULL);
```

---

## Expected Behavior After Fix

### ✅ App Boot Sequence
1. App starts
2. `initializeMediaAssets()` loads public assets **without authentication**
3. User sees splash screen with logo video
4. User signs in with Google
5. Profile is auto-created by `handle_new_user()` trigger
6. User is redirected to choose-role screen
7. User selects role (customer or mechanic)
8. `set_user_role()` function sets the role (bypasses RLS safely)
9. If mechanic, `mechanic_profiles` row is auto-created
10. User is redirected to appropriate home screen

### ✅ No More Errors
- ❌ ~~"permission denied for table media_assets"~~
- ❌ ~~"Could not find the function public.set_user_role"~~
- ❌ ~~"permission denied for table profiles"~~ (function now bypasses RLS properly)
- ✅ Google sign-in works
- ✅ Role selection works
- ✅ Media assets load
- ✅ Anon users can only see public assets (security maintained)

---

## Troubleshooting

### "permission denied for table profiles" when creating function
This means the function isn't properly set as SECURITY DEFINER or isn't owned by the table owner.

**Fix:**
```sql
ALTER FUNCTION public.set_user_role(public.user_role) OWNER TO postgres;
```

### "permission denied for table media_assets" still appears
1. Verify anon grant exists:
   ```sql
   SELECT privilege_type
   FROM information_schema.table_privileges
   WHERE grantee = 'anon' AND table_name = 'media_assets';
   ```

2. **More importantly**, verify RLS policy exists:
   ```sql
   SELECT policyname
   FROM pg_policies
   WHERE tablename = 'media_assets'
     AND policyname = 'media_assets_select_public_or_involved';
   ```

3. If policy is missing, run the CREATE POLICY statement from `HOTFIX_APPLY_NOW.sql`

### "Could not find the function" still appears
1. Verify function exists:
   ```sql
   SELECT routine_name, security_type
   FROM information_schema.routines
   WHERE routine_schema = 'public'
     AND routine_name = 'set_user_role';
   ```

2. Verify authenticated role can execute it:
   ```sql
   SELECT grantee, privilege_type
   FROM information_schema.routine_privileges
   WHERE routine_name = 'set_user_role';
   ```

3. If missing, run the CREATE FUNCTION block from `HOTFIX_APPLY_NOW.sql`

### Anon users can see private assets
This means the RLS policy is too permissive. The policy should be:
```sql
USING (
  (uploaded_by IS NULL AND job_id IS NULL)  -- Only public assets
  OR auth.uid() = uploaded_by               -- Or own uploads (authenticated)
  OR EXISTS (...)                            -- Or job assets (authenticated)
)
```

---

## Security Notes

### Why SECURITY DEFINER is Safe Here
- Function only allows users to set their **own** role (uses `auth.uid()`)
- Function validates auth context (`IF uid IS NULL THEN RAISE EXCEPTION`)
- Function uses safe `search_path = public, pg_temp` to prevent hijacking
- Only `authenticated` role can execute (anon cannot)
- Function is owned by `postgres` (table owner) to ensure RLS bypass works

### Why Anon Access to media_assets is Safe
- RLS policy restricts anon to **only** public assets (`uploaded_by IS NULL AND job_id IS NULL`)
- Private assets (user uploads, job photos) are blocked for anon
- Authenticated users can see their own uploads + job-related assets
- Policy uses EXISTS subquery to verify job participation

---

## Next Steps After Applying Hotfix

1. ✅ Test Google sign-in
2. ✅ Test role selection (customer and mechanic)
3. ✅ Verify media assets load on splash screen
4. ✅ Test app navigation
5. ✅ Verify anon users cannot see private assets
6. 📝 Link your Supabase project for future migrations (see Option 2 above)

---

## Files Reference

- **HOTFIX_APPLY_NOW.sql** - The SQL script to run in Supabase SQL Editor (includes verification queries)
- **CRITICAL_FIXES_2025_01_05.md** - Detailed explanation of all fixes
- **MIGRATION_VERIFICATION_CHECKLIST.md** - Full verification queries
- **supabase/migrations/20250210000006_functions_triggers.sql** - Contains set_user_role function
- **supabase/migrations/20250210000007_rls_grants.sql** - Contains RLS policies and grants

---

**Status:** 🚨 URGENT - Apply hotfix now to fix app errors

**Time Required:** 2-5 minutes

**Risk:** Low - Only adds missing function, grant, and policy. Doesn't modify existing data.

**Security:** High - Function uses SECURITY DEFINER safely, RLS policy restricts anon to public assets only.
