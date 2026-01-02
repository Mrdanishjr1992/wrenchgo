# Role Selection Fix - Quick Reference

## 🎯 What Was Fixed
Users were auto-assigned `role='customer'` during signup, skipping the "Choose role" screen.

## 🔧 Changes Made

### App Code (2 files)
1. **`app/(auth)/sign-up.tsx`** - Removed role selection from signup
2. **`app/(auth)/choose-role.tsx`** - Now uses RPC: `supabase.rpc('set_user_role', { new_role: role })`

### Database (1 migration)
**`supabase/migrations/20250127000000_fix_role_selection_flow.sql`**
- Removed `DEFAULT 'customer'` from profiles.role
- Updated trigger to set `role = NULL` on signup
- Added RPC function `set_user_role(new_role text)` with validation
- Added RLS policy to prevent role changes after initial selection

## 🚀 Deploy Commands

```bash
# 1. Deploy database migration
cd supabase
supabase db push

# 2. Deploy app code
git add app/(auth)/*.tsx supabase/migrations/20250127000000_fix_role_selection_flow.sql
git commit -m "Fix role selection flow - enforce explicit role choice"
git push

# 3. Rebuild app
npm run build
```

## ✅ Quick Test

```bash
# 1. Sign up new user
# 2. Sign in
# 3. Should see "Choose your role" screen
# 4. Select role → Should navigate to correct home
# 5. Reopen app → Should stay on home (role persisted)
```

## 🔍 Verify Migration

```sql
-- Check role column allows NULL
SELECT is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'role';
-- Expected: is_nullable = 'YES', column_default = NULL

-- Check RPC exists
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'set_user_role';
-- Expected: 1 row
```

## 📊 Monitor After Deploy

```sql
-- Users without role (should only be recent signups)
SELECT COUNT(*), MAX(created_at)
FROM profiles
WHERE role IS NULL AND deleted_at IS NULL;
-- Expected: 0 or very small number (< 5 min old)
```

## 🔄 Rollback (if needed)

```sql
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'customer'::public.user_role;
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;
DROP FUNCTION IF EXISTS public.set_user_role(text);
```

Then revert app code changes.

## 📚 Full Documentation
- **Deployment Guide:** `ROLE_SELECTION_FIX_DEPLOYMENT.md`
- **Verification Checklist:** `ROLE_SELECTION_VERIFICATION.md`
- **Complete Summary:** `ROLE_SELECTION_FIX_SUMMARY.md`

## 🎉 Success Criteria
- ✅ New users see choose-role screen
- ✅ Role is required (no default)
- ✅ Role persists correctly
- ✅ Role cannot be changed after selection
- ✅ No race conditions
- ✅ All edge cases handled
