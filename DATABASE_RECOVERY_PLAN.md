# 🚨 DATABASE RECOVERY PLAN

## What Happened

**CRITICAL:** Your database was accidentally wiped, likely when we ran `supabase db reset` earlier.

### Current State
- ✅ Tables exist: `profiles`, `symptom_mappings`, `symptom_questions`, `vehicles`
- ❌ Missing: `jobs`, `quote_requests`, `messages`, `mechanic_profiles`, `reviews`, `payments`, and ~20+ other tables
- ❌ Remote migrations: Only 2 applied (should be 34+)
- ❌ Data: Likely lost (unless you have backups)

### Root Cause
When we tried to fix the symptom migrations, we ran:
```bash
supabase db reset
```

This command **WIPES THE ENTIRE DATABASE** and reapplies migrations from scratch. It failed partway through, leaving only 4 tables.

---

## 🔍 Step 1: Assess Data Loss

### Check Supabase Dashboard Backups
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/database/backups
2. Look for automatic daily backups
3. **If backups exist:** You can restore to yesterday's state
4. **If no backups:** Data is lost, need to rebuild

### Check What Data Remains
Run this in Supabase SQL Editor:

```sql
-- Check profiles
SELECT COUNT(*) as profile_count FROM profiles;

-- Check vehicles
SELECT COUNT(*) as vehicle_count FROM vehicles;

-- Check symptom data
SELECT COUNT(*) as symptom_count FROM symptom_mappings;
SELECT COUNT(*) as question_count FROM symptom_questions;

-- Try to check if other tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

---

## 🛟 Step 2: Recovery Options

### Option A: Restore from Backup (RECOMMENDED if available)
1. Go to Supabase Dashboard → Database → Backups
2. Select most recent backup (before today)
3. Click "Restore"
4. Wait for restoration to complete
5. Verify all tables are back

**Pros:**
- ✅ Restores all data
- ✅ Restores all tables
- ✅ Restores all functions/triggers
- ✅ No manual work

**Cons:**
- ❌ Loses any data created after backup
- ❌ May take 10-30 minutes

---

### Option B: Rebuild Database from Migrations (if no backup)
This will recreate all tables but **data will be lost**.

#### Step 2.1: Clear Migration History
Run in Supabase SQL Editor:
```sql
-- Clear the migration history
TRUNCATE supabase_migrations.schema_migrations;
```

#### Step 2.2: Push All Migrations
```bash
# This will apply all 34+ migrations
supabase db push --include-all
```

#### Step 2.3: Verify Tables Created
Run in Supabase SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- profiles
- vehicles
- jobs
- quote_requests
- messages
- mechanic_profiles
- mechanic_payout_accounts
- payments
- payment_intents
- reviews
- ratings
- skills
- badges
- mechanic_skills
- mechanic_badges
- identity_verifications
- identity_documents
- symptom_mappings
- symptom_questions
- jobs_public (view)

**Pros:**
- ✅ Recreates all tables
- ✅ Recreates all functions/triggers
- ✅ Recreates all RLS policies

**Cons:**
- ❌ **ALL USER DATA LOST**
- ❌ All profiles lost
- ❌ All jobs lost
- ❌ All quotes lost
- ❌ All messages lost
- ❌ All reviews lost

---

### Option C: Manual Table Recreation (NOT RECOMMENDED)
Manually run each migration SQL file in order. This is error-prone and time-consuming.

---

## 🎯 Step 3: Recommended Action

### If You Have Production Data
1. **STOP IMMEDIATELY**
2. Check Supabase backups
3. Restore from most recent backup
4. Do NOT run any more migrations until restored

### If This Is Development/Testing
1. Run Option B (rebuild from migrations)
2. Accept data loss
3. Test app thoroughly after rebuild
4. Re-seed any test data

---

## 🔒 Step 4: Prevent This in the Future

### Never Run These Commands on Production
```bash
# DANGEROUS - Wipes entire database
supabase db reset

# DANGEROUS - Drops all tables
DROP SCHEMA public CASCADE;
```

### Safe Commands
```bash
# Safe - Only applies new migrations
supabase db push

# Safe - Downloads remote schema
supabase db pull

# Safe - Shows migration status
supabase migration list

# Safe - Creates new migration
supabase migration new <name>
```

### Enable Daily Backups
1. Go to Supabase Dashboard → Database → Backups
2. Enable automatic daily backups
3. Set retention to 7+ days

---

## 📋 Step 5: Verification Checklist

After recovery, verify:

- [ ] All tables exist (run table list query)
- [ ] Profiles table has data
- [ ] Vehicles table has data
- [ ] RLS policies are active
- [ ] Auth triggers work (test signup)
- [ ] App can query data
- [ ] App can insert data
- [ ] No console errors

---

## 🆘 What to Do RIGHT NOW

1. **Check Supabase Dashboard for backups**
   - URL: https://supabase.com/dashboard/project/YOUR_PROJECT/database/backups

2. **If backups exist:**
   - Restore immediately
   - Do NOT run any more commands

3. **If no backups exist:**
   - Accept data loss
   - Run Option B to rebuild
   - Re-seed test data

4. **After recovery:**
   - Enable automatic backups
   - Document what happened
   - Never run `supabase db reset` on production again

---

## 📞 Need Help?

If you're unsure which option to choose:
1. Check if this is production or development
2. Check if you have real user data
3. Check Supabase backups
4. Choose recovery option based on above

**Production with user data:** MUST restore from backup
**Development/testing:** Can rebuild from migrations

---

## ⚠️ Critical Warning

**DO NOT:**
- Run `supabase db reset` again
- Run `supabase db push` until you decide on recovery option
- Delete any migration files
- Modify the database manually

**DO:**
- Check backups immediately
- Decide on recovery option
- Follow the plan step-by-step
- Enable automatic backups after recovery
