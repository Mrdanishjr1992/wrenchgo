# Critical Fixes Applied - January 5, 2025

## Issues Identified from Screenshots

### Issue 1: "permission denied for table media_assets" (Error 42501)
**Symptom:** App fails to load public media assets like "wrenchgo_ad_1" and "logo_video" during initialization.

**Root Cause:** 
- RLS policy required `auth.uid()` which is NULL for unauthenticated users
- App tries to load media assets before user authentication completes
- `anon` role didn't have SELECT permission on media_assets table

**Fix Applied:**
1. Updated RLS policy comment to clarify public assets are accessible to ANYONE (including anon)
2. Added `GRANT SELECT ON public.media_assets TO anon;` to allow unauthenticated access
3. Policy already allowed `(job_id IS NULL AND uploaded_by IS NULL)` for public assets

**Files Modified:**
- `supabase/migrations/20250210000007_rls_grants.sql`

---

### Issue 2: "Could not find the function public.set_user_role(new_role) in the schema cache"
**Symptom:** App crashes when user tries to choose their role (customer or mechanic) after sign-up.

**Root Cause:** 
- `app/(auth)/choose-role.tsx` calls `supabase.rpc("set_user_role", { new_role: role })`
- Function `set_user_role()` was never created in the migrations

**Fix Applied:**
Created `set_user_role()` function with the following features:
- **SECURITY DEFINER** - bypasses RLS to allow users to set their own role
- **One-time only** - raises error if role is already set
- **Auto-creates mechanic_profile** - if user chooses 'mechanic' role
- **Safe** - only allows setting role for authenticated user's own profile

**Function Signature:**
```sql
CREATE OR REPLACE FUNCTION public.set_user_role(new_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

**Files Modified:**
- `supabase/migrations/20250210000006_functions_triggers.sql`

---

### Issue 3: Media assets failing to load during initialization
**Symptom:** `initializeMediaAssets()` in `src/lib/mediaAssets.ts` fails with permission denied.

**Root Cause:** 
- Same as Issue 1 - RLS blocking unauthenticated access
- App calls `initializeMediaAssets()` early in the boot process

**Fix Applied:**
- Same fix as Issue 1 - grant SELECT to anon role
- Public assets (NULL uploaded_by and job_id) are now accessible without authentication

---

## Migration Changes Summary

### File: `20250210000006_functions_triggers.sql`

**Added:**
```sql
CREATE OR REPLACE FUNCTION public.set_user_role(new_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role public.user_role;
BEGIN
  -- Get current role
  SELECT role INTO current_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- If role is already set, raise error
  IF current_role IS NOT NULL THEN
    RAISE EXCEPTION 'Role already set to %', current_role;
  END IF;
  
  -- Set the role
  UPDATE public.profiles
  SET role = new_role, updated_at = now()
  WHERE id = auth.uid();
  
  -- If user chose mechanic, create mechanic_profile
  IF new_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (auth.uid(), now(), now())
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;
```

### File: `20250210000007_rls_grants.sql`

**Modified:**
1. Updated comment on `media_assets_select_public_or_involved` policy to clarify anon access
2. Added grant: `GRANT SELECT ON public.media_assets TO anon;`

---

## Deployment Instructions

### Option 1: Reset and Push (Recommended)

```bash
# Local development
supabase db reset
supabase start

# Remote production
supabase db push
```

### Option 2: Apply Only the Changed Migrations

If you don't want to reset the entire database:

```bash
# Apply function changes
supabase db push --file supabase/migrations/20250210000006_functions_triggers.sql

# Apply RLS/grant changes
supabase db push --file supabase/migrations/20250210000007_rls_grants.sql
```

---

## Verification

### 1. Verify `set_user_role()` function exists

```sql
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'set_user_role';
```

**Expected:** 
- routine_name: `set_user_role`
- routine_type: `FUNCTION`
- security_type: `DEFINER`

### 2. Verify anon can SELECT media_assets

```sql
SELECT privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'media_assets'
  AND grantee = 'anon';
```

**Expected:** `SELECT`

### 3. Test media asset fetch (as anon)

```sql
-- This should work without authentication
SELECT key, public_url
FROM public.media_assets
WHERE key IN ('wrenchgo_ad_1', 'logo_video');
```

**Expected:** Returns rows without permission denied error.

### 4. Test set_user_role (as authenticated user)

```sql
-- After signing in, try to set role
SELECT public.set_user_role('customer');
```

**Expected:** Success (no error). Trying again should raise "Role already set" error.

---

## Testing Checklist

- [ ] Deploy migrations: `supabase db push`
- [ ] Verify `set_user_role()` function exists with SECURITY DEFINER
- [ ] Verify anon role has SELECT on media_assets
- [ ] Test app boot - media assets should load without errors
- [ ] Test Google sign-in - should work without permission denied
- [ ] Test role selection - should work without "function not found" error
- [ ] Test role selection twice - should show "Role already set" error
- [ ] Verify mechanic_profile is auto-created when role is set to 'mechanic'

---

## Expected Behavior After Fix

### App Boot Sequence
1. ✅ App starts
2. ✅ `initializeMediaAssets()` loads public assets (wrenchgo_ad_1, logo_video) **without authentication**
3. ✅ User sees splash screen with logo video
4. ✅ User signs in with Google
5. ✅ Profile is auto-created by `handle_new_user()` trigger
6. ✅ User is redirected to choose-role screen
7. ✅ User selects role (customer or mechanic)
8. ✅ `set_user_role()` function sets the role
9. ✅ If mechanic, `mechanic_profiles` row is auto-created
10. ✅ User is redirected to appropriate home screen

### Media Assets
- ✅ Public assets (NULL uploaded_by/job_id) are accessible to **anyone** (anon + authenticated)
- ✅ Job-related assets are accessible only to job participants (authenticated)
- ✅ User-uploaded assets are accessible only to uploader (authenticated)

### Role Selection
- ✅ User can set role once
- ✅ Attempting to set role again raises friendly error
- ✅ Mechanic role auto-creates mechanic_profile
- ✅ Customer role does not create mechanic_profile

---

## Files Modified

1. **supabase/migrations/20250210000006_functions_triggers.sql**
   - Added `set_user_role()` function

2. **supabase/migrations/20250210000007_rls_grants.sql**
   - Updated media_assets RLS policy comment
   - Added `GRANT SELECT ON public.media_assets TO anon;`

---

## Rollback Plan

If issues occur after deployment:

```bash
# Reset to previous state
supabase db reset

# Re-apply old migrations (if you have backups)
# Or manually drop the function:
DROP FUNCTION IF EXISTS public.set_user_role(public.user_role);

# And revoke anon access:
REVOKE SELECT ON public.media_assets FROM anon;
```

---

## Notes

- **SECURITY DEFINER** on `set_user_role()` is safe because it only allows users to set their own role
- **anon SELECT** on media_assets is safe because RLS policy restricts to public assets only
- **One-time role setting** prevents users from switching roles after initial selection
- **Auto-create mechanic_profile** ensures mechanics have extended profile data immediately

---

**Status:** ✅ Ready to deploy

**Next Steps:**
1. Run `supabase db push`
2. Test app boot and media asset loading
3. Test Google sign-in and role selection
4. Monitor Supabase logs for any errors
