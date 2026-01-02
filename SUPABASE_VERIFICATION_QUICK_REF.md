# 🔍 SUPABASE VERIFICATION - QUICK REFERENCE

## ⚡ QUICK VERIFICATION (3 COMMANDS)

```powershell
# 1. Run verification script
.\verify_deployment.ps1

# 2. Check for drift
supabase db diff --schema public

# 3. Test local reset
supabase db reset
```

**Expected:** All pass, no errors

---

## 📋 MANUAL CHECKS

### Check Migration Status
```powershell
supabase migration list
```
**Expected:** 7 migrations

### Check Remote Migrations
```powershell
supabase db remote exec "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;"
```
**Expected:** All 7 migrations applied

### Check for Drift
```powershell
supabase db diff --schema public
```
**Expected:** "No schema differences detected."

### Verify Seed Data
```powershell
supabase db remote exec "SELECT 'skills' as t, COUNT(*) FROM skills UNION ALL SELECT 'symptoms', COUNT(*) FROM symptoms;"
```
**Expected:** skills=18, symptoms=100+

### Verify Role Selection
```powershell
supabase db remote exec "SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name='profiles' AND column_name='role';"
```
**Expected:** is_nullable=YES, column_default=NULL

---

## 🚫 NO-DRIFT RULES

| DO | DON'T |
|----|-------|
| ✅ `supabase migration new <name>` | ❌ Create .sql files manually |
| ✅ `supabase db reset` before push | ❌ Skip local testing |
| ✅ `supabase db push` to deploy | ❌ Manual SQL in dashboard |
| ✅ `supabase db diff` to check | ❌ Ignore drift warnings |

---

## 📝 DEPLOYMENT CHECKLIST

```markdown
Pre-Deploy:
- [ ] `supabase db reset` works locally
- [ ] `supabase db diff` shows no drift
- [ ] All migrations committed to git

Deploy:
- [ ] `supabase db push`
- [ ] `.\verify_deployment.ps1`

Post-Deploy:
- [ ] All checks pass
- [ ] App works end-to-end
- [ ] User signup → role selection works
```

---

## 🆘 QUICK FIXES

**Drift detected:**
```powershell
supabase db diff --schema public  # See what's different
supabase db pull                   # Pull production changes
```

**Reset fails:**
```powershell
# Check which migration fails
supabase db reset
# Fix that migration file
# Test again
```

**Seed data missing:**
```powershell
# Check seed data migration
cat supabase/migrations/20250127000005_seed_data.sql
# Fix and reset
supabase db reset
```

---

## 📚 FULL DOCS

- **Complete Guide:** `SUPABASE_VERIFICATION_GUIDE.md`
- **Verification Script:** `verify_deployment.ps1`

---

## ✅ SUCCESS CRITERIA

After verification, you should have:
- ✅ 7 migrations applied
- ✅ No schema drift
- ✅ Local reset works
- ✅ Seed data loaded
- ✅ RLS enabled
- ✅ Role selection works (role=NULL, no default)
- ✅ Messages table (no recipient_id)
- ✅ Jobs table (has accepted_mechanic_id)

---

**Run `.\verify_deployment.ps1` to verify everything!**
