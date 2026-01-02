# Migration Restructure - Quick Reference

## 📁 New Structure (5 Files)

```
supabase/migrations/
├── 20250127000001_baseline_schema.sql      ← Tables, types, FKs
├── 20250127000002_rls_policies.sql         ← Row-level security
├── 20250127000003_functions_triggers.sql   ← Functions, triggers, RPCs
├── 20250127000004_indexes_performance.sql  ← Indexes, constraints
└── 20250127000005_seed_data.sql            ← Lookup table data (NEEDS YOUR DATA!)
```

## ⚡ Quick Deploy

```powershell
# 1. Backup
supabase db dump -f "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# 2. Archive old migrations
$archive = "supabase/migrations/archive_$(Get-Date -Format 'yyyyMMdd')"
New-Item -ItemType Directory -Path $archive -Force
Move-Item supabase/migrations/*.sql $archive -ErrorAction SilentlyContinue

# 3. Paste your seed data into 20250127000005_seed_data.sql
# (symptoms, symptom_mappings, symptom_questions, symptom_refinements, education_cards)

# 4. Test locally
supabase db reset

# 5. Deploy to production
supabase db push
```

## ✅ Quick Verify

```sql
-- Tables created?
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Expected: ~20

-- RLS enabled?
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
-- Expected: ~20

-- Functions exist?
SELECT routine_name FROM information_schema.routines WHERE routine_name = 'set_user_role';
-- Expected: 1 row

-- Seed data loaded?
SELECT COUNT(*) FROM public.symptoms;
-- Expected: 100
```

## 🎯 Key Changes

### ✅ What's Fixed
- **Role bug:** No default role, explicit selection required
- **Reset safety:** Proper dependency ordering
- **Idempotent seeds:** Safe to run multiple times
- **Clean structure:** 5 files instead of 58+

### ⚠️ What You Must Do
1. **Paste seed data** into `20250127000005_seed_data.sql`
2. **Test locally** before production deploy
3. **Backup database** before any changes

## 🔄 Rollback

```powershell
# Restore from backup
psql $env:DATABASE_URL -f backup_YYYYMMDD_HHMMSS.sql

# OR restore old migrations
Copy-Item supabase/migrations/archive_*/*.sql supabase/migrations/
Remove-Item supabase/migrations/20250127*.sql
supabase db reset
```

## 📚 Full Docs
- **Deployment Guide:** `MIGRATION_DEPLOYMENT_GUIDE.md`
- **Role Fix Reference:** `ROLE_FIX_QUICK_REF.md`

## 🆘 Common Issues

| Issue | Fix |
|-------|-----|
| "relation already exists" | `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` then reset |
| "function does not exist" | Check `20250127000003_functions_triggers.sql` ran |
| Seed data missing | Paste your data into `20250127000005_seed_data.sql` |
| Role still defaults to 'customer' | Verify `handle_new_user()` sets `role = NULL` |

## 🎉 Success Checklist

- [ ] Backup created
- [ ] Old migrations archived
- [ ] Seed data pasted
- [ ] Local test passed
- [ ] Production deployed
- [ ] All tables created
- [ ] RLS enabled
- [ ] Functions exist
- [ ] Seed data loaded
- [ ] Role selection works
- [ ] App flows tested
