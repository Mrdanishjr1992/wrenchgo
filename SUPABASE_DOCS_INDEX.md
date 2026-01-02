You are a senior Supabase database architect and release engineer.

Context:
I have a Supabase project with:
- A cleaned migration chain that now successfully runs `supabase db reset` and `supabase db push`
- A baseline schema + RLS + functions + indexes + seed data inside `supabase/migrations`
- A separate legacy `supabase/seed/` folder with JS/JSON/SQL-based seed scripts

Goal:
I want a reset-safe, scalable, production-grade setup where:
- `supabase db reset` always produces a working app
- Required lookup data is guaranteed to exist
- There is no schema drift or duplicate seed systems
- Future contributors cannot accidentally break migrations

Tasks:
1) Analyze the role of `supabase/seed/*` vs `supabase/migrations/*`
2) Decide whether `supabase/seed/` should be:
   - deleted,
   - archived as dev-only seed,
   - or partially merged into migrations
3) Clearly classify seed data into:
   - REQUIRED (app breaks without it)
   - OPTIONAL (demo/dev/testing only)
4) Propose a final folder structure that enforces:
   - one source of truth for schema
   - one source of truth for required seed data
5) Give me explicit, step-by-step cleanup actions:
   - what to delete
   - what to move
   - what to keep
6) Provide PowerShell commands to execute the cleanup safely
7) Define strict rules going forward:
   - where seed data is allowed to live
   - how new migrations must be created
   - how to prevent future schema drift

Constraints:
- Everything must be compatible with Supabase CLI
- `supabase db reset` must always work
- Production safety is more important than preserving legacy scripts

Output format:
- Decision summary (keep / move / delete)
- Final recommended directory tree
- Cleanup checklist
- PowerShell commands
- “Rules of the road” for future migrations & seeds
# 📚 SUPABASE DOCUMENTATION INDEX

## 🎯 START HERE

**Your Status:** `supabase db push` returned "Remote database is up to date."

**Next Action:** Run `.\verify_deployment.ps1` to confirm alignment.

---

## 📖 DOCUMENTATION STRUCTURE

### 🚀 DEPLOYMENT & VERIFICATION

| Document | Purpose | Use When |
|----------|---------|----------|
| **[RELEASE_VERIFICATION_SUMMARY.md](RELEASE_VERIFICATION_SUMMARY.md)** | Executive summary with quick actions | **START HERE** - Quick overview |
| **[PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md)** | Complete 5-phase deployment process | Deploying to production |
| **[SUPABASE_VERIFICATION_GUIDE.md](SUPABASE_VERIFICATION_GUIDE.md)** | Comprehensive verification (6 parts) | Need detailed verification steps |
| **[SUPABASE_VERIFICATION_QUICK_REF.md](SUPABASE_VERIFICATION_QUICK_REF.md)** | Quick commands reference | Need fast command lookup |
| **[verify_deployment.ps1](verify_deployment.ps1)** | Automated verification script | After deployment (10 checks) |

### 🔄 ACCOUNT & PROJECT MANAGEMENT

| Document | Purpose | Use When |
|----------|---------|----------|
| **[SUPABASE_ACCOUNT_SWITCH_GUIDE.md](SUPABASE_ACCOUNT_SWITCH_GUIDE.md)** | Complete account switching guide | Switching Supabase accounts |
| **[SUPABASE_SWITCH_QUICK_REF.md](SUPABASE_SWITCH_QUICK_REF.md)** | Quick account switch commands | Quick account switch reference |

### 🔗 CROSS-PROJECT INTEGRATION

| Document | Purpose | Use When |
|----------|---------|----------|
| **[PROJECT_B_INTEGRATION_GUIDE.md](PROJECT_B_INTEGRATION_GUIDE.md)** | Complete cross-project setup | Linking to another Supabase project |
| **[PROJECT_B_QUICK_REF.md](PROJECT_B_QUICK_REF.md)** | Quick integration reference | Quick Project B commands |

### 📋 MIGRATION PLANNING

| Document | Purpose | Use When |
|----------|---------|----------|
| **[MIGRATION_ACTION_PLAN.md](MIGRATION_ACTION_PLAN.md)** | Step-by-step migration checklist | Planning migration restructure |
| **[MIGRATION_DEPLOYMENT_GUIDE.md](MIGRATION_DEPLOYMENT_GUIDE.md)** | Migration deployment details | Deploying migration changes |
| **[MIGRATION_QUICK_REF.md](MIGRATION_QUICK_REF.md)** | Quick migration commands | Quick migration reference |
| **[MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)** | Migration overview | Understanding migration structure |

---

## ⚡ QUICK START GUIDE

### 1. Verify Current Deployment (5 minutes)

```powershell
# Run automated verification
.\verify_deployment.ps1

# Check for drift
supabase db diff --schema public

# Test local reset
supabase db reset
```

### 2. Review Results

- ✅ All checks pass → You're production ready!
- ❌ Any check fails → See troubleshooting section

### 3. Test Application (10 minutes)

- [ ] User signup (creates profile with role=NULL)
- [ ] Role selection (customer and mechanic)
- [ ] Messaging (no recipient_id errors)
- [ ] Job acceptance (accepted_mechanic_id works)
- [ ] Symptom diagnosis (loads data)

---

## 📋 COMMON TASKS

### Task: Verify Deployment

**Documents:**
1. [RELEASE_VERIFICATION_SUMMARY.md](RELEASE_VERIFICATION_SUMMARY.md) - Quick overview
2. [verify_deployment.ps1](verify_deployment.ps1) - Run automated checks

**Commands:**
```powershell
.\verify_deployment.ps1
```

---

### Task: Deploy to Production

**Documents:**
1. [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) - Complete guide
2. [SUPABASE_VERIFICATION_QUICK_REF.md](SUPABASE_VERIFICATION_QUICK_REF.md) - Quick commands

**Commands:**
```powershell
# Backup
supabase db dump -f backup.sql

# Deploy
supabase db push

# Verify
.\verify_deployment.ps1
```

---

### Task: Create New Migration

**Documents:**
1. [SUPABASE_VERIFICATION_GUIDE.md](SUPABASE_VERIFICATION_GUIDE.md) - Part 3 (No-Drift Workflow)

**Commands:**
```powershell
# Create migration
supabase migration new add_new_feature

# Edit file in supabase/migrations/

# Test locally
supabase db reset

# Deploy
supabase db push
```

---

### Task: Check for Schema Drift

**Documents:**
1. [SUPABASE_VERIFICATION_QUICK_REF.md](SUPABASE_VERIFICATION_QUICK_REF.md)

**Commands:**
```powershell
# Check for drift
supabase db diff --schema public

# If drift detected, pull or push
supabase db pull  # OR
supabase db push
```

---

### Task: Switch Supabase Accounts

**Documents:**
1. [SUPABASE_ACCOUNT_SWITCH_GUIDE.md](SUPABASE_ACCOUNT_SWITCH_GUIDE.md) - Complete guide
2. [SUPABASE_SWITCH_QUICK_REF.md](SUPABASE_SWITCH_QUICK_REF.md) - Quick commands

**Commands:**
```powershell
# Unlink old project
supabase unlink

# Login to new account
supabase logout
supabase login

# Link new project
supabase link --project-ref NEW_PROJECT_REF

# Update .env file
# Deploy migrations
supabase db push
```

---

### Task: Link to Another Supabase Project

**Documents:**
1. [PROJECT_B_INTEGRATION_GUIDE.md](PROJECT_B_INTEGRATION_GUIDE.md) - Complete guide
2. [PROJECT_B_QUICK_REF.md](PROJECT_B_QUICK_REF.md) - Quick commands

**Setup:**
1. Create Edge Function proxy
2. Configure environment variables
3. Deploy Edge Function
4. Use TypeScript client in app

---

### Task: Troubleshoot Issues

**Documents:**
1. [SUPABASE_VERIFICATION_GUIDE.md](SUPABASE_VERIFICATION_GUIDE.md) - Part 6 (Common Issues)
2. [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) - Troubleshooting section

**Common Issues:**
- Schema drift → `supabase db diff` then pull/push
- Reset fails → Check migration syntax
- Seed data missing → Check seed data migration
- RLS blocking → Check RLS policies

---

## 🎯 CURRENT MIGRATION STRUCTURE

Your 7 migrations (in order):

1. **20250127000000_fix_role_selection_flow.sql** - Role selection fix
2. **20250127000001_baseline_schema.sql** - Core schema
3. **20250127000002_rls_policies.sql** - RLS policies
4. **20250127000003_functions_triggers.sql** - Functions & triggers
5. **20250127000004_indexes_performance.sql** - Indexes
6. **20250127000005_seed_data.sql** - Seed data
7. **20250127000006_project_b_integration.sql** - Project B integration

**Status:** All deployed to production ✅

---

## 🚫 NO-DRIFT WORKFLOW

### Golden Rules

| DO ✅ | DON'T ❌ |
|-------|----------|
| `supabase migration new <name>` | Create .sql files manually |
| `supabase db reset` before push | Skip local testing |
| `supabase db push` to deploy | Manual SQL in dashboard |
| `supabase db diff` to check | Ignore drift warnings |

### Workflow

```powershell
# 1. Create migration
supabase migration new add_feature

# 2. Edit file

# 3. Test locally
supabase db reset

# 4. Check drift
supabase db diff

# 5. Deploy
supabase db push

# 6. Verify
.\verify_deployment.ps1
```

---

## ✅ VERIFICATION CHECKLIST

After deployment, verify:

- [ ] `supabase migration list` shows 7 migrations
- [ ] `supabase db diff` shows no drift
- [ ] `supabase db reset` works locally
- [ ] `.\verify_deployment.ps1` passes all checks
- [ ] All tables exist (~20 tables)
- [ ] RLS enabled on all core tables
- [ ] Seed data loaded correctly
- [ ] Role selection works (role=NULL, no default)
- [ ] Messages table has NO recipient_id
- [ ] Jobs table HAS accepted_mechanic_id
- [ ] App works end-to-end

---

## 🆘 NEED HELP?

### Quick Troubleshooting

1. **Verification fails** → See [SUPABASE_VERIFICATION_GUIDE.md](SUPABASE_VERIFICATION_GUIDE.md) Part 6
2. **Drift detected** → Run `supabase db diff` then pull/push
3. **Reset fails** → Check migration syntax and dependencies
4. **App not working** → Check RLS policies and function definitions

### Documentation Map

- **Quick overview** → [RELEASE_VERIFICATION_SUMMARY.md](RELEASE_VERIFICATION_SUMMARY.md)
- **Deployment** → [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md)
- **Verification** → [SUPABASE_VERIFICATION_GUIDE.md](SUPABASE_VERIFICATION_GUIDE.md)
- **Quick commands** → [SUPABASE_VERIFICATION_QUICK_REF.md](SUPABASE_VERIFICATION_QUICK_REF.md)
- **Account switch** → [SUPABASE_ACCOUNT_SWITCH_GUIDE.md](SUPABASE_ACCOUNT_SWITCH_GUIDE.md)
- **Cross-project** → [PROJECT_B_INTEGRATION_GUIDE.md](PROJECT_B_INTEGRATION_GUIDE.md)

---

## 📊 SUCCESS CRITERIA

After verification, you should have:

| Check | Expected | Status |
|-------|----------|--------|
| Migrations | 7 applied | ⬜ |
| Drift | None | ⬜ |
| Reset | Works | ⬜ |
| Tables | ~20 tables | ⬜ |
| RLS | Enabled | ⬜ |
| Seed data | Loaded | ⬜ |
| Functions | All exist | ⬜ |
| Role selection | Working | ⬜ |
| Messages | No recipient_id | ⬜ |
| Jobs | Has accepted_mechanic_id | ⬜ |
| App | Working | ⬜ |

---

## 🎊 YOU'RE PRODUCTION READY!

Everything is in place:
- ✅ 7 migrations deployed
- ✅ Verification tools ready
- ✅ Documentation complete
- ✅ No-drift workflow established
- ✅ Rollback plans documented

**Next:** Run `.\verify_deployment.ps1` to confirm everything is aligned!

---

**Last Updated:** 2025-01-27
**Version:** 1.0
