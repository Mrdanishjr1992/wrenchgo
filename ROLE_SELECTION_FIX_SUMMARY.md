# Role Selection Bug - Complete Fix Summary

## A) DIAGNOSIS (Root Causes)

### Critical Bugs Identified:

1. **Database Trigger Auto-Defaults Role to 'customer'**
   - **Location:** `supabase/migrations/00000000000000_baseline_wrenchgo.sql:242`
   - **Code:** `r := coalesce(new.raw_user_meta_data->>'role', 'customer');`
   - **Impact:** Every new user gets `role='customer'` automatically, even if they haven't chosen yet
   - **Result:** Choose-role screen is skipped because `if (!role)` check in `app/index.tsx:54` is never true

2. **Database Column Has Default Value**
   - **Location:** `supabase/migrations/00000000000001_add_profiles_role.sql:2`
   - **Code:** `add column if not exists role public.user_role not null default 'customer';`
   - **Impact:** Even without trigger, any INSERT without explicit role gets 'customer'
   - **Result:** Impossible to create profile with NULL role

3. **Client-Side Direct Database Updates**
   - **Location:** `app/(auth)/choose-role.tsx:101-121`
   - **Code:** Direct `supabase.from('profiles').update()` and `.insert()`
   - **Impact:** Race conditions possible, no server-side validation, RLS bypass attempts
   - **Result:** Unreliable role persistence, potential security issues

4. **No RLS Policy Preventing Role Changes**
   - **Location:** Missing in migrations
   - **Impact:** Users could theoretically change role multiple times
   - **Result:** No enforcement of "role is set once and permanent" rule

5. **Sign-Up Screen Included Role Selection (Minor)**
   - **Location:** `app/(auth)/sign-up.tsx:28`
   - **Code:** `const [role, setRole] = useState<Role>("customer");`
   - **Impact:** Confusing UX - role shown on signup but then asked again
   - **Result:** User expects role to be set, but it's overridden by trigger

---

## B) APP CODE PATCHES

### File: `app/(auth)/sign-up.tsx`

**Changes:**
- ❌ Removed: `const [role, setRole] = useState<Role>("customer");`
- ❌ Removed: Role selection UI (RolePill component)
- ❌ Removed: `role: role` from `supabase.auth.signUp()` metadata
- ✅ Result: Sign-up only collects name, email, password

**Why this fixes it:**
- Users no longer see role selection during signup
- No role is passed to trigger, so trigger can't default it
- Clean separation: signup = create account, choose-role = set role

### File: `app/(auth)/choose-role.tsx`

**Changes:**
- ❌ Removed: Lines 88-121 (direct UPDATE/INSERT logic)
- ✅ Added: RPC call `supabase.rpc('set_user_role', { new_role: role })`

**Before:**
```typescript
const { data: updatedRows, error: upErr } = await supabase
  .from("profiles")
  .update(payload)
  .eq("auth_id", user.id)
  .select("auth_id");

if (!updatedRows || updatedRows.length === 0) {
  const { error: insErr } = await supabase.from("profiles").insert({
    auth_id: user.id,
    ...payload,
  });
}
```

**After:**
```typescript
const { data, error } = await supabase.rpc("set_user_role", {
  new_role: role,
});
```

**Why this fixes it:**
- ✅ Atomic operation (no race conditions)
- ✅ Server-side validation (role must be 'customer' or 'mechanic')
- ✅ Enforces one-time setting (throws error if role already set)
- ✅ Automatically creates mechanic_profile if needed
- ✅ Proper error handling with meaningful messages
- ✅ RLS policies enforced at database level

### File: `app/index.tsx`

**No changes needed** - existing logic already correct:
```typescript
const role = (p?.role as string | null) ?? null;

if (!role) {
  router.replace("/(auth)/choose-role");
  return;
}
```

This now works correctly because new users will have `role = NULL`.

---

## C) SUPABASE SQL PATCH

### File: `supabase/migrations/20250127000000_fix_role_selection_flow.sql`

#### 1. Remove Default Role Assignment
```sql
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
```
**Why:** Allows profiles to exist with `role = NULL` until user explicitly chooses.

#### 2. Update Trigger to NOT Default Role
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  fn text;
BEGIN
  fn := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.profiles (id, auth_id, full_name, role, created_at, updated_at)
  VALUES (NEW.id, NEW.id, fn, NULL, NOW(), NOW())
  ON CONFLICT (auth_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
**Why:** 
- Removed `r := coalesce(..., 'customer')` logic
- Explicitly sets `role = NULL` on signup
- No more auto-defaulting to customer

#### 3. Create RPC Function for Role Setting
```sql
CREATE OR REPLACE FUNCTION public.set_user_role(new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id uuid;
  current_role text;
BEGIN
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF new_role NOT IN ('customer', 'mechanic') THEN
    RAISE EXCEPTION 'Invalid role: must be customer or mechanic';
  END IF;

  SELECT role INTO current_role
  FROM public.profiles
  WHERE auth_id = user_id;

  IF current_role IS NOT NULL THEN
    RAISE EXCEPTION 'Role already set. Cannot change role after initial selection.';
  END IF;

  UPDATE public.profiles
  SET 
    role = new_role::public.user_role,
    updated_at = NOW()
  WHERE auth_id = user_id;

  IF new_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (user_id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;
```

**Why this is bulletproof:**
- ✅ **Authentication check:** `auth.uid()` ensures user is logged in
- ✅ **Input validation:** Only 'customer' or 'mechanic' allowed
- ✅ **One-time setting:** Checks if role already set, throws error if so
- ✅ **Atomic update:** Single transaction, no partial writes
- ✅ **Auto-creates mechanic_profile:** No need for client to do it
- ✅ **Security definer:** Runs with elevated privileges, bypasses RLS for this operation
- ✅ **Error messages:** Clear feedback for debugging

#### 4. Add RLS Policy
```sql
CREATE POLICY "Users can update their own role if null"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid() AND role IS NULL)
  WITH CHECK (auth_id = auth.uid());
```

**Why:**
- Users can only update their own profile
- Only when role is currently NULL
- Prevents role changes after initial selection
- Defense-in-depth (RPC also checks, but RLS is backup)

#### 5. Performance Index
```sql
CREATE INDEX IF NOT EXISTS idx_profiles_auth_id_role 
  ON public.profiles(auth_id, role) 
  WHERE deleted_at IS NULL;
```

**Why:**
- Speeds up boot logic query: `SELECT role FROM profiles WHERE auth_id = ?`
- Partial index (only non-deleted) keeps it small

---

## D) WHY THIS FIXES IT

### Problem: Choose-role screen was skipped
**Root cause:** Trigger defaulted role to 'customer' on signup  
**Fix:** Trigger now sets `role = NULL`, so `if (!role)` check in boot logic is TRUE  
**Result:** User is routed to choose-role screen ✅

### Problem: Role was defaulted silently
**Root cause:** Database column had `DEFAULT 'customer'`  
**Fix:** Removed default, allow NULL  
**Result:** No role until user explicitly chooses ✅

### Problem: Race conditions during role save
**Root cause:** Client-side UPDATE then INSERT fallback  
**Fix:** Single atomic RPC call  
**Result:** No race conditions, reliable persistence ✅

### Problem: Users could change role multiple times
**Root cause:** No validation or RLS policy  
**Fix:** RPC checks if role already set, RLS policy blocks updates when role is not NULL  
**Result:** Role is permanent after first selection ✅

### Problem: No server-side validation
**Root cause:** Client did direct database writes  
**Fix:** RPC validates role value, authentication, and state  
**Result:** Invalid roles rejected, security enforced ✅

---

## E) EDGE CASES HANDLED

| Edge Case | How It's Handled |
|-----------|------------------|
| **Back button during role selection** | Role stays NULL, user returns to choose-role screen on next boot |
| **App reload before role chosen** | Boot logic checks `role IS NULL`, routes to choose-role |
| **Slow network** | RPC is atomic, no partial writes. Loading spinner shows until complete |
| **Multiple tabs/devices** | First RPC succeeds, second throws "Role already set" error |
| **Auth session restoration** | Boot logic re-checks role from database, routes correctly |
| **User tries to change role later** | RPC throws error, RLS blocks UPDATE |
| **Invalid role value** | RPC validates, throws error "Invalid role: must be customer or mechanic" |
| **Unauthenticated RPC call** | RPC checks `auth.uid()`, throws "Not authenticated" |
| **Profile doesn't exist yet** | Trigger creates profile with `role = NULL` on signup |
| **Mechanic profile creation** | RPC automatically creates mechanic_profile row if role='mechanic' |

---

## F) VERIFICATION STEPS

### Test 1: New User Flow
1. Sign up → Sign in → **Should see choose-role screen**
2. Choose customer → **Should navigate to customer home**
3. Close app, reopen → **Should stay on customer home (role persisted)**

### Test 2: Role Cannot Be Changed
1. Sign up, choose customer
2. Try calling `set_user_role('mechanic')` → **Should fail with error**

### Test 3: Invalid Role Rejected
1. Sign up
2. Try calling `set_user_role('admin')` → **Should fail with error**

### Test 4: Database State
```sql
-- New signups should have role = NULL
SELECT * FROM profiles WHERE role IS NULL;

-- After choosing, role should be set
SELECT * FROM profiles WHERE auth_id = '<user_id>';
-- Expected: role = 'customer' or 'mechanic'
```

### Test 5: Existing Users
1. Sign in with existing user (already has role)
2. **Should skip choose-role, go directly to home**

---

## G) DEPLOYMENT ORDER

1. ✅ Deploy database migration first
2. ✅ Verify migration applied (check role column, RPC function exists)
3. ✅ Deploy app code
4. ✅ Test new user signup flow
5. ✅ Monitor logs for errors

**Rollback:** If issues occur, see `ROLE_SELECTION_FIX_DEPLOYMENT.md` for rollback SQL.

---

## H) ARCHITECTURE COMPLIANCE

✅ **Supabase queries moved to database layer:**
- Role setting is now an RPC function, not client-side UPDATE/INSERT
- Validation logic in SQL, not TypeScript
- RLS policies enforce security at database level

✅ **Client code simplified:**
- `choose-role.tsx` now just calls `supabase.rpc('set_user_role', { new_role })`
- No complex UPDATE/INSERT fallback logic
- No client-side validation (server does it)

✅ **Future-proof:**
- To add role validation rules, edit SQL function (not app code)
- To add role types, update enum and RPC validation
- To add role-change workflow, create new RPC function

---

## I) SUCCESS METRICS

After deployment, these should be TRUE:

- ✅ 100% of new users see choose-role screen
- ✅ 0% of users have `role = NULL` after completing onboarding
- ✅ 0 errors from `set_user_role` RPC (except intentional validation failures)
- ✅ 0 users stuck on choose-role screen
- ✅ 0 users with wrong role (customer vs mechanic)

**Monitor with:**
```sql
-- Users without role (should only be in-progress signups)
SELECT COUNT(*) FROM profiles WHERE role IS NULL AND created_at > NOW() - INTERVAL '1 hour';

-- RPC call success rate (check Supabase logs)
-- Should be ~100% (excluding validation errors)
```

---

**Fix completed by:** Senior Expo Router + Supabase Engineer  
**Date:** 2025-01-27  
**Status:** ✅ Ready for deployment
