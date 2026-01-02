# 🚀 MIGRATION RESTRUCTURE - ACTION PLAN

## ⏱️ Estimated Time: 30-60 minutes

---

## 📋 STEP-BY-STEP CHECKLIST

### ✅ STEP 1: Backup (5 minutes)

```powershell
cd "C:\Users\mrdan\source\repos\Mechanic app\wrenchgo"

# Create backup
supabase db dump -f "backup_before_restructure_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Verify backup created
Get-Item backup_before_restructure_*.sql | Select-Object Name, Length
```

**Expected:** Backup file created with size > 0 bytes

---

### ✅ STEP 2: Archive Old Migrations (2 minutes)

```powershell
# Create archive directory
$archiveDir = "supabase/migrations/archive_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $archiveDir -Force

# Move ALL old migrations
Get-ChildItem supabase/migrations/*.sql | Where-Object { $_.Name -notlike "20250127*" } | Move-Item -Destination $archiveDir

# Verify only 5 new files remain
Get-ChildItem supabase/migrations/*.sql | Select-Object Name
```

**Expected Output:**
```
20250127000001_baseline_schema.sql
20250127000002_rls_policies.sql
20250127000003_functions_triggers.sql
20250127000004_indexes_performance.sql
20250127000005_seed_data.sql
```

---

### ⚠️ STEP 3: Complete Seed Data (10-15 minutes) **CRITICAL**

Open `supabase/migrations/20250127000005_seed_data.sql` and paste your data:

#### 3.1: Symptoms (100 rows)

Find the section:
```sql
-- 4) SYMPTOMS
-- TODO: Paste your full symptoms data here (100 rows)
```

Replace with your INSERT statement for all 100 symptoms.

#### 3.2: Symptom Mappings (100 rows)

Find the section:
```sql
-- 5) SYMPTOM_MAPPINGS
-- TODO: Paste your full symptom_mappings data here
```

Replace with your INSERT statement for all symptom mappings.

#### 3.3: Symptom Questions

Find the section:
```sql
-- 6) SYMPTOM_QUESTIONS
-- TODO: Paste your full symptom_questions data here
```

Replace with your INSERT statement.

#### 3.4: Symptom Refinements

Find the section:
```sql
-- 7) SYMPTOM_REFINEMENTS
-- TODO: Paste your full symptom_refinements data here
```

Replace with your INSERT statement.

#### 3.5: Education Cards

Find the section:
```sql
-- 8) EDUCATION_CARDS
-- TODO: Paste your full education_cards data here
```

Replace with your INSERT statement.

**Verification:**
```powershell
# Check file size increased
Get-Item supabase/migrations/20250127000005_seed_data.sql | Select-Object Length
# Should be > 50KB after adding data
```

---

### ✅ STEP 4: Test Locally (10-15 minutes)

```powershell
# Reset local database
supabase db reset

# Watch for errors - should see:
# - Applying migration 20250127000001_baseline_schema.sql...
# - Applying migration 20250127000002_rls_policies.sql...
# - Applying migration 20250127000003_functions_triggers.sql...
# - Applying migration 20250127000004_indexes_performance.sql...
# - Applying migration 20250127000005_seed_data.sql...
# - Finished supabase db reset
```

**If errors occur:** STOP and fix them before proceeding!

#### 4.1: Verify Tables

```powershell
# Check tables created
supabase db diff --schema public
```

**Expected:** No differences (schema matches migrations)

#### 4.2: Verify Seed Data

```sql
-- Run these queries in Supabase Studio or psql

-- Check symptoms
SELECT COUNT(*) FROM public.symptoms;
-- Expected: 100

-- Check symptom_mappings
SELECT COUNT(*) FROM public.symptom_mappings;
-- Expected: 100

-- Check skills
SELECT COUNT(*) FROM public.skills;
-- Expected: 18

-- Check tools
SELECT COUNT(*) FROM public.tools;
-- Expected: 19

-- Check safety_measures
SELECT COUNT(*) FROM public.safety_measures;
-- Expected: 10
```

#### 4.3: Verify Functions

```sql
-- Check set_user_role exists
SELECT routine_name, routine_type 
FROM information_schema.routines
WHERE routine_name = 'set_user_role';
-- Expected: 1 row

-- Check handle_new_user exists
SELECT routine_name 
FROM information_schema.routines
WHERE routine_name = 'handle_new_user';
-- Expected: 1 row
```

#### 4.4: Verify RLS

```sql
-- Check RLS enabled
SELECT COUNT(*) 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
-- Expected: ~20
```

---

### ✅ STEP 5: Test Role Selection Flow (5 minutes)

#### 5.1: Sign Up New User

In your app or Supabase Studio:
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'password123'
});
```

#### 5.2: Check Profile Created with NULL Role

```sql
SELECT id, auth_id, full_name, email, role, created_at
FROM public.profiles
WHERE email = 'test@example.com';
-- Expected: role = NULL
```

#### 5.3: Set Role

```typescript
const { error } = await supabase.rpc('set_user_role', {
  new_role: 'customer'
});
// Expected: no error
```

#### 5.4: Verify Role Persisted

```sql
SELECT role FROM public.profiles WHERE email = 'test@example.com';
-- Expected: role = 'customer'
```

#### 5.5: Try Changing Role (Should Fail)

```typescript
const { error } = await supabase.rpc('set_user_role', {
  new_role: 'mechanic'
});
// Expected: error = 'Role already set. Cannot change role after initial selection.'
```

---

### ✅ STEP 6: Deploy to Production (5 minutes)

**ONLY proceed if all local tests passed!**

```powershell
# Push migrations to production
supabase db push

# Watch for errors
# Expected: All 5 migrations applied successfully
```

---

### ✅ STEP 7: Verify Production (10 minutes)

#### 7.1: Check Tables

```sql
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: ~20
```

#### 7.2: Check Seed Data

```sql
SELECT COUNT(*) FROM public.symptoms;
-- Expected: 100

SELECT COUNT(*) FROM public.skills;
-- Expected: 18
```

#### 7.3: Check Functions

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;
-- Expected: set_user_role, handle_new_user, get_public_profile_card, etc.
```

#### 7.4: Check RLS

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
-- Expected: All tables have rowsecurity = true
```

---

### ✅ STEP 8: Test Production App (10 minutes)

#### 8.1: Test New User Signup
1. Open app
2. Sign up new user
3. Should see "Choose your role" screen
4. Select role (customer or mechanic)
5. Should navigate to correct home screen
6. Close and reopen app
7. Should stay on home screen (role persisted)

#### 8.2: Test Mechanic Profile
1. Sign up as mechanic
2. Check mechanic profile created
3. Update profile
4. Verify changes saved

#### 8.3: Test Job Flow
1. Sign in as customer
2. Create new job
3. Sign in as mechanic (different account)
4. View available jobs
5. Submit quote
6. Sign in as customer
7. View quotes
8. Accept quote

---

### ✅ STEP 9: Monitor (24 hours)

```powershell
# Watch logs for errors
supabase functions logs --tail

# Check for issues
# - Authentication errors
# - RLS policy violations
# - Missing data
# - Function errors
```

---

### ✅ STEP 10: Cleanup (After 30 days)

```powershell
# Delete archived migrations (ONLY after 30 days of stable operation)
Remove-Item -Recurse supabase/migrations/archive_*

# Delete backup files (ONLY after 30 days)
Remove-Item backup_before_restructure_*.sql
```

---

## 🆘 TROUBLESHOOTING

### Issue: Local reset fails with "relation already exists"

**Solution:**
```sql
-- Drop and recreate schema
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Then run `supabase db reset` again.

---

### Issue: Seed data not loading

**Solution:**
1. Check `20250127000005_seed_data.sql` has your data pasted
2. Check for SQL syntax errors
3. Check for duplicate keys

---

### Issue: Role still defaults to 'customer'

**Solution:**
```sql
-- Check handle_new_user function
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- Should contain: role = NULL
-- If not, re-run: supabase db reset
```

---

### Issue: Production deploy fails

**Solution:**
1. Check Supabase logs: `supabase functions logs --tail`
2. Restore from backup: `psql $env:DATABASE_URL -f backup_before_restructure_*.sql`
3. Fix issues locally
4. Test again
5. Redeploy

---

## 📊 SUCCESS CRITERIA

After completing all steps, you should have:

- ✅ 5 clean migration files
- ✅ Old migrations archived
- ✅ All tables created (~20)
- ✅ RLS enabled on all tables
- ✅ All functions exist (7+)
- ✅ All triggers attached (6+)
- ✅ Seed data loaded (symptoms, skills, tools, etc.)
- ✅ Role selection works (no default)
- ✅ Mechanic profile auto-created
- ✅ All app flows working
- ✅ No errors in logs

---

## 📚 REFERENCE DOCUMENTS

| Document | When to Use |
|----------|-------------|
| `MIGRATION_QUICK_REF.md` | Quick commands reference |
| `MIGRATION_DEPLOYMENT_GUIDE.md` | Detailed deployment instructions |
| `MIGRATION_SUMMARY.md` | Complete overview |
| `ROLE_FIX_QUICK_REF.md` | Role fix reference |

---

## 🎉 COMPLETION

Once all steps are complete and verified:

1. ✅ Mark this task as complete
2. ✅ Update team documentation
3. ✅ Monitor production for 24 hours
4. ✅ Schedule cleanup for 30 days
5. ✅ Celebrate! 🎊

---

## ⏰ TIME TRACKING

| Step | Estimated Time | Actual Time |
|------|----------------|-------------|
| 1. Backup | 5 min | ___ min |
| 2. Archive | 2 min | ___ min |
| 3. Seed Data | 15 min | ___ min |
| 4. Test Local | 15 min | ___ min |
| 5. Test Role Flow | 5 min | ___ min |
| 6. Deploy Prod | 5 min | ___ min |
| 7. Verify Prod | 10 min | ___ min |
| 8. Test App | 10 min | ___ min |
| **TOTAL** | **67 min** | **___ min** |

---

**Ready to start? Begin with STEP 1! 🚀**
