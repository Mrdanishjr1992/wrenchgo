# Role Selection Flow Fix - Deployment Guide

## Problem Summary
Users were being auto-assigned `role='customer'` during signup, causing the "Choose role" screen to be skipped.

## Root Causes Fixed
1. ✅ Database trigger `handle_new_user()` defaulted role to 'customer'
2. ✅ `profiles.role` column had `DEFAULT 'customer'` constraint
3. ✅ Direct client-side UPDATE/INSERT allowed race conditions
4. ✅ No RLS policy preventing role changes after initial selection

## Changes Made

### A) App Code Changes

**File: `app/(auth)/sign-up.tsx`**
- Removed role selection from sign-up screen
- Removed `role` from `user_metadata` during signup
- Users now sign up without a role (will choose on next screen)

**File: `app/(auth)/choose-role.tsx`**
- Replaced direct UPDATE/INSERT with RPC call: `supabase.rpc('set_user_role', { new_role: role })`
- Ensures atomic role setting with server-side validation
- Prevents race conditions

**File: `app/index.tsx`**
- No changes needed (already checks `if (!role)` to route to choose-role)

### B) Database Changes

**File: `supabase/migrations/20250127000000_fix_role_selection_flow.sql`**

1. **Remove default role assignment**
   ```sql
   ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
   ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
   ```

2. **Update trigger to NOT default role**
   - `handle_new_user()` now inserts `role = NULL` instead of `'customer'`

3. **Add RPC function for role setting**
   ```sql
   CREATE FUNCTION public.set_user_role(new_role text)
   ```
   - Validates role is 'customer' or 'mechanic'
   - Ensures role can only be set ONCE (throws error if already set)
   - Creates mechanic_profile row if role='mechanic'
   - Atomic operation with proper error handling

4. **Add RLS policy**
   - Users can only update their own role
   - Only when current role IS NULL

5. **Add performance index**
   - `idx_profiles_auth_id_role` for faster lookups

## Deployment Steps

### 1. Deploy Database Migration
```bash
cd supabase
supabase db push
```

Or manually run:
```bash
psql $DATABASE_URL -f migrations/20250127000000_fix_role_selection_flow.sql
```

### 2. Verify Migration Applied
```sql
-- Check role column allows NULL
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'role';
-- Expected: is_nullable = 'YES', column_default = NULL

-- Check RPC function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'set_user_role';
-- Expected: 1 row returned

-- Check RLS policy exists
SELECT policyname FROM pg_policies
WHERE tablename = 'profiles' AND policyname LIKE '%role if null%';
-- Expected: 1 row returned
```

### 3. Handle Existing Users (Optional)
If you have existing users with `role='customer'` who should choose their role:
```sql
-- Reset role for users who haven't completed onboarding
UPDATE public.profiles
SET role = NULL
WHERE role = 'customer'
  AND created_at > NOW() - INTERVAL '7 days'  -- Adjust timeframe
  AND id NOT IN (
    SELECT DISTINCT customer_id FROM jobs
    UNION
    SELECT DISTINCT mechanic_id FROM jobs WHERE mechanic_id IS NOT NULL
  );
```

### 4. Deploy App Code
```bash
# Commit and push changes
git add app/(auth)/sign-up.tsx app/(auth)/choose-role.tsx
git commit -m "Fix role selection flow - enforce explicit role choice"
git push

# Rebuild and deploy
npm run build  # or your build command
```

### 5. Test the Flow
See VERIFICATION_CHECKLIST.md below

## Rollback Plan

If issues occur, rollback with:
```sql
-- Restore default role
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'customer'::public.user_role;
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

-- Restore old trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  r text;
  fn text;
BEGIN
  r := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  fn := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  
  INSERT INTO public.profiles (id, auth_id, role, full_name)
  VALUES (NEW.id, NEW.id, r::public.user_role, fn);
  
  IF r = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id) VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop new RPC function
DROP FUNCTION IF EXISTS public.set_user_role(text);
```

Then revert app code changes.

## Edge Cases Handled

✅ **Back button during role selection**: Role remains NULL, user stays on choose-role screen  
✅ **App reload before role chosen**: Boot logic redirects to choose-role  
✅ **Slow network**: RPC is atomic, no partial writes  
✅ **Multiple tabs/devices**: RPC throws error if role already set  
✅ **Auth session restoration**: Boot logic checks role, routes correctly  
✅ **User tries to change role later**: RPC throws error "Role already set"  
✅ **Invalid role value**: RPC validates and throws error  

## Monitoring

After deployment, monitor:
1. Error logs for `set_user_role` RPC failures
2. Users stuck on choose-role screen (should be 0 after choosing)
3. Profiles with `role IS NULL` older than 24 hours (investigate)

```sql
-- Check users without role (should be recent signups only)
SELECT id, auth_id, created_at, full_name
FROM public.profiles
WHERE role IS NULL
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```
