# 🏗️ SEED DATA ARCHITECTURE ANALYSIS & CLEANUP PLAN

**Date:** 2025-01-27  
**Status:** DECISION REQUIRED  
**Goal:** Production-grade, reset-safe, single-source-of-truth seed data strategy

---

## 📊 CURRENT STATE ANALYSIS

### What You Have Now

#### 1. **Migration-Based Seed Data** (`supabase/migrations/20250127000005_seed_data.sql`)
- ✅ **REQUIRED DATA (Partial):**
  - Skills (5 rows) - INCOMPLETE (only 5 of 18)
  - Tools (19 rows) - COMPLETE
  - Safety measures (10 rows) - COMPLETE
- ❌ **MISSING REQUIRED DATA:**
  - Symptoms (0 rows) - TODO placeholder
  - Symptom mappings (0 rows) - TODO placeholder
  - Symptom questions (0 rows) - TODO placeholder
  - Symptom refinements (0 rows) - TODO placeholder
  - Education cards (0 rows) - TODO placeholder
  - Symptom education (0 rows) - TODO placeholder

#### 2. **Legacy Seed Directory** (`supabase/seed/`)
- **seed.sql** (7 KB)
  - 8 basic symptoms (wont_start, warning_light, brakes_wrong, etc.)
  - 8 symptom_education entries
  - ~15 symptom_questions
  - Uses TRUNCATE (NOT reset-safe)
  - Dev/demo quality data
  
- **data-fixed.json** (188 KB)
  - 156 symptom_mappings (PRODUCTION QUALITY)
  - 400+ symptom_questions (PRODUCTION QUALITY)
  - Comprehensive, validated data
  
- **seed-data.js** (9 KB)
  - Node.js script to load data-fixed.json
  - Requires service role key
  - Validates and normalizes data
  - Uses upserts (safe to re-run)
  - NOT compatible with `supabase db reset`

- **Supporting files:**
  - data.json (older version)
  - fix-json.js (data cleanup script)
  - README.md, RUN_INSTRUCTIONS.md
  - package.json

### The Problem

**You have TWO seed systems:**

| System | Location | Quality | Reset-Safe | Complete |
|--------|----------|---------|------------|----------|
| **Migration** | `migrations/20250127000005_seed_data.sql` | Production | ✅ Yes | ❌ No (TODOs) |
| **Legacy** | `supabase/seed/*` | Mixed | ❌ No | ✅ Yes |

**Consequences:**
- ❌ `supabase db reset` produces an app with INCOMPLETE data
- ❌ Symptom diagnosis feature WILL NOT WORK after reset
- ❌ Two sources of truth = drift risk
- ❌ New contributors don't know which to use
- ❌ Production deployment requires manual seed script run

---

## 🎯 DECISION MATRIX

### Data Classification

| Data Type | Rows | Required? | Quality | Source | Decision |
|-----------|------|-----------|---------|--------|----------|
| **skills** | 18 | ✅ REQUIRED | Production | Migration (partial) | **KEEP & COMPLETE** |
| **tools** | 19 | ✅ REQUIRED | Production | Migration | **KEEP** |
| **safety_measures** | 10 | ✅ REQUIRED | Production | Migration | **KEEP** |
| **symptoms** | 8 basic | ✅ REQUIRED | Dev/Demo | seed.sql | **REPLACE with production** |
| **symptoms** | 156 detailed | ✅ REQUIRED | Production | data-fixed.json | **MIGRATE** |
| **symptom_mappings** | 156 | ✅ REQUIRED | Production | data-fixed.json | **MIGRATE** |
| **symptom_questions** | 400+ | ✅ REQUIRED | Production | data-fixed.json | **MIGRATE** |
| **symptom_refinements** | ? | ⚠️ OPTIONAL | Unknown | Not found | **SKIP for now** |
| **symptom_education** | 8 basic | ⚠️ OPTIONAL | Dev/Demo | seed.sql | **ARCHIVE** |
| **education_cards** | 0 | ⚠️ OPTIONAL | N/A | Not found | **SKIP for now** |

### Why This Matters

**REQUIRED = App breaks without it:**
- Skills: Mechanic profile creation fails
- Tools: Job requirements can't be displayed
- Safety measures: Safety checklist empty
- Symptoms: Symptom diagnosis screen empty
- Symptom mappings: Diagnosis logic fails
- Symptom questions: Follow-up questions missing

**OPTIONAL = Nice to have:**
- Symptom education: Educational content (can be added later)
- Education cards: Additional content (can be added later)
- Symptom refinements: Advanced filtering (can be added later)

---

## ✅ FINAL DECISION

### Keep & Enhance Migration-Based Seed

**Rationale:**
1. ✅ **Reset-safe:** Runs automatically with `supabase db reset`
2. ✅ **Single source of truth:** One place for all seed data
3. ✅ **Version controlled:** Part of migration history
4. ✅ **Idempotent:** Uses `ON CONFLICT DO NOTHING`
5. ✅ **Production-grade:** No manual scripts needed
6. ✅ **Team-friendly:** Clear, SQL-based, no Node.js required

**Action:** Migrate production data from `data-fixed.json` into `20250127000005_seed_data.sql`

### Archive Legacy Seed Directory

**Rationale:**
1. ❌ **Not reset-safe:** Requires manual execution
2. ❌ **Requires service role key:** Security risk
3. ❌ **Node.js dependency:** Extra complexity
4. ❌ **Separate from migrations:** Drift risk
5. ❌ **Not version controlled properly:** JSON files hard to review

**Action:** Move to `supabase/seed-archive/` with clear "DO NOT USE" warning

---

## 📁 FINAL DIRECTORY STRUCTURE

```
supabase/
├── migrations/
│   ├── 20250127000000_fix_role_selection_flow.sql
│   ├── 20250127000001_baseline_schema.sql
│   ├── 20250127000002_rls_policies.sql
│   ├── 20250127000003_functions_triggers.sql
│   ├── 20250127000004_indexes_performance.sql
│   ├── 20250127000005_seed_data.sql              ← SINGLE SOURCE OF TRUTH
│   └── 20250127000006_project_b_integration.sql
│
├── seed-archive/                                  ← ARCHIVED (DO NOT USE)
│   ├── ARCHIVED_README.md                         ← Warning + history
│   ├── data-fixed.json                            ← Original production data
│   ├── data.json                                  ← Old version
│   ├── seed-data.js                               ← Legacy Node script
│   ├── seed.sql                                   ← Legacy SQL script
│   ├── fix-json.js                                ← Data cleanup script
│   ├── package.json                               ← Node dependencies
│   ├── README.md                                  ← Original docs
│   └── RUN_INSTRUCTIONS.md                        ← Original instructions
│
├── functions/                                     ← Edge Functions
├── config.toml                                    ← Supabase config
└── snippets/                                      ← SQL snippets
```

---

## 🔧 CLEANUP CHECKLIST

### Phase 1: Extract Production Data from JSON

- [ ] Read `supabase/seed/data-fixed.json`
- [ ] Extract `symptom_mappings` array (156 rows)
- [ ] Extract `symptom_questions` array (400+ rows)
- [ ] Convert JSON to SQL INSERT statements
- [ ] Add proper `ON CONFLICT` clauses for idempotency
- [ ] Validate foreign key references

### Phase 2: Update Migration File

- [ ] Open `supabase/migrations/20250127000005_seed_data.sql`
- [ ] Complete SKILLS section (add missing 13 skills)
- [ ] Add SYMPTOMS section (from symptom_mappings keys)
- [ ] Add SYMPTOM_MAPPINGS section (156 rows)
- [ ] Add SYMPTOM_QUESTIONS section (400+ rows)
- [ ] Remove TODO placeholders
- [ ] Add comments for maintainability

### Phase 3: Test Migration

- [ ] Run `supabase db reset` locally
- [ ] Verify all tables populated
- [ ] Check row counts match expectations
- [ ] Test symptom diagnosis feature in app
- [ ] Verify no foreign key errors
- [ ] Confirm idempotency (run reset twice)

### Phase 4: Archive Legacy Seed

- [ ] Create `supabase/seed-archive/` directory
- [ ] Move all files from `supabase/seed/` to `supabase/seed-archive/`
- [ ] Create `ARCHIVED_README.md` with warning
- [ ] Delete empty `supabase/seed/` directory
- [ ] Update `.gitignore` if needed
- [ ] Commit changes with clear message

### Phase 5: Update Documentation

- [ ] Update `SUPABASE_VERIFICATION_GUIDE.md` with new seed data checks
- [ ] Update `PRODUCTION_DEPLOYMENT_GUIDE.md` to remove manual seed steps
- [ ] Update `verify_deployment.ps1` with new row count checks
- [ ] Add "Rules of the Road" to `SUPABASE_DOCS_INDEX.md`
- [ ] Create `SEED_DATA_RULES.md` for future reference

### Phase 6: Deploy & Verify

- [ ] Commit all changes to git
- [ ] Run `supabase db push` to production
- [ ] Run `.\verify_deployment.ps1`
- [ ] Verify symptom diagnosis works in production
- [ ] Check row counts in production database
- [ ] Test app end-to-end

---

## 💻 POWERSHELL CLEANUP COMMANDS

### Step 1: Create Archive Directory
```powershell
# Create archive directory
New-Item -ItemType Directory -Path "supabase/seed-archive" -Force

# Move all files from seed to seed-archive
Get-ChildItem -Path "supabase/seed" -File | Move-Item -Destination "supabase/seed-archive"

# Verify move
Get-ChildItem -Path "supabase/seed-archive" -File | Select-Object Name, Length
```

### Step 2: Create Archive Warning
```powershell
# Create warning README
@"
# ⚠️ ARCHIVED SEED DATA - DO NOT USE

**Status:** ARCHIVED  
**Date:** 2025-01-27  
**Reason:** Migrated to migration-based seed data

## Why This Was Archived

This directory contains the legacy seed data system that required:
- Manual execution with service role key
- Node.js runtime
- Separate from migration chain
- Not compatible with \`supabase db reset\`

## Current Seed Data Location

**✅ USE THIS INSTEAD:**
\`supabase/migrations/20250127000005_seed_data.sql\`

This migration contains all production seed data and runs automatically with:
- \`supabase db reset\` (local)
- \`supabase db push\` (production)

## What's In This Archive

- **data-fixed.json** - Original production symptom data (156 mappings, 400+ questions)
- **seed-data.js** - Legacy Node.js seed script
- **seed.sql** - Legacy SQL seed script (dev/demo quality)
- **Supporting files** - Original documentation and utilities

## If You Need This Data

All data from \`data-fixed.json\` has been migrated to the seed data migration.
If you need to reference the original JSON structure, it's preserved here.

## DO NOT

- ❌ Run \`node seed-data.js\`
- ❌ Execute \`seed.sql\` manually
- ❌ Use this for production seeding
- ❌ Create new seed scripts here

## Questions?

See \`SEED_DATA_RULES.md\` in the root directory for current seed data practices.
"@ | Out-File -FilePath "supabase/seed-archive/ARCHIVED_README.md" -Encoding UTF8
```

### Step 3: Remove Empty Seed Directory
```powershell
# Verify seed directory is empty
Get-ChildItem -Path "supabase/seed" -File

# If empty, remove directory
Remove-Item -Path "supabase/seed" -Force -ErrorAction SilentlyContinue
```

### Step 4: Verify Structure
```powershell
# Check new structure
Write-Host "`n=== Migration Files ===" -ForegroundColor Green
Get-ChildItem -Path "supabase/migrations" -File | Select-Object Name

Write-Host "`n=== Archived Seed Files ===" -ForegroundColor Yellow
Get-ChildItem -Path "supabase/seed-archive" -File | Select-Object Name

Write-Host "`n=== Seed Directory Status ===" -ForegroundColor Cyan
if (Test-Path "supabase/seed") {
    Write-Host "⚠️  supabase/seed still exists" -ForegroundColor Yellow
} else {
    Write-Host "✅ supabase/seed removed" -ForegroundColor Green
}
```

---

## 📜 RULES OF THE ROAD

### Seed Data Rules (Going Forward)

#### ✅ DO

1. **Always use migrations for seed data**
   ```powershell
   # Create new migration
   supabase migration new add_new_seed_data
   
   # Edit the generated file
   # Add INSERT statements with ON CONFLICT DO NOTHING
   ```

2. **Make seed data idempotent**
   ```sql
   -- Good: Can run multiple times safely
   INSERT INTO skills (name, category) 
   VALUES ('New Skill', 'repair')
   ON CONFLICT (name) DO NOTHING;
   
   -- Bad: Will fail on second run
   INSERT INTO skills (name, category) 
   VALUES ('New Skill', 'repair');
   ```

3. **Test with db reset before pushing**
   ```powershell
   # Always test locally first
   supabase db reset
   
   # Verify data loaded
   supabase db remote exec "SELECT COUNT(*) FROM skills;"
   
   # Then deploy
   supabase db push
   ```

4. **Document required vs optional data**
   ```sql
   -- REQUIRED: App breaks without this
   INSERT INTO skills ...
   
   -- OPTIONAL: Nice to have, can be added later
   INSERT INTO education_cards ...
   ```

5. **Use meaningful comments**
   ```sql
   -- Symptom mappings: Links symptoms to skills, tools, and safety requirements
   -- Source: Validated production data from mechanic SMEs
   -- Last updated: 2025-01-27
   INSERT INTO symptom_mappings ...
   ```

#### ❌ DON'T

1. **Never create manual seed scripts**
   ```powershell
   # Bad: Separate from migration chain
   node scripts/seed-database.js
   
   # Good: Part of migration
   supabase db reset
   ```

2. **Never use TRUNCATE in migrations**
   ```sql
   -- Bad: Destroys production data
   TRUNCATE TABLE skills CASCADE;
   
   -- Good: Idempotent upsert
   INSERT INTO skills ... ON CONFLICT DO NOTHING;
   ```

3. **Never hardcode UUIDs**
   ```sql
   -- Bad: Will conflict across environments
   INSERT INTO skills (id, name) VALUES 
   ('123e4567-e89b-12d3-a456-426614174000', 'Brakes');
   
   -- Good: Let database generate IDs
   INSERT INTO skills (name) VALUES ('Brakes');
   ```

4. **Never skip local testing**
   ```powershell
   # Bad: Push without testing
   supabase db push
   
   # Good: Test first
   supabase db reset
   # Verify app works
   supabase db push
   ```

5. **Never run manual SQL in dashboard**
   ```
   ❌ Supabase Dashboard → SQL Editor → Run INSERT
   ✅ Create migration → Test locally → Push
   ```

### Creating New Seed Data

**Workflow:**

```powershell
# 1. Create migration
supabase migration new add_vehicle_makes_seed

# 2. Edit file: supabase/migrations/YYYYMMDDHHMMSS_add_vehicle_makes_seed.sql
# Add:
# - Header comment explaining what and why
# - INSERT statements with ON CONFLICT DO NOTHING
# - Foreign key references validated
# - Meaningful data (not test/dummy data)

# 3. Test locally
supabase db reset

# 4. Verify in app
# - Check data appears correctly
# - Test features that depend on it

# 5. Check for drift
supabase db diff

# 6. Deploy
supabase db push

# 7. Verify production
.\verify_deployment.ps1
```

### Updating Existing Seed Data

**Workflow:**

```powershell
# 1. Create new migration (don't edit old ones)
supabase migration new update_skills_seed

# 2. Add UPDATE or INSERT statements
# Example:
# UPDATE skills SET description = 'New description' WHERE name = 'Brakes';
# INSERT INTO skills (name, category) VALUES ('New Skill', 'repair') 
# ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category;

# 3. Test locally
supabase db reset

# 4. Deploy
supabase db push
```

### Removing Seed Data

**Workflow:**

```powershell
# 1. Create new migration
supabase migration new remove_deprecated_skills

# 2. Add DELETE statements with WHERE clause
# DELETE FROM skills WHERE name IN ('Old Skill 1', 'Old Skill 2');

# 3. Test locally
supabase db reset

# 4. Verify app still works without the data

# 5. Deploy
supabase db push
```

---

## 🎯 SUCCESS CRITERIA

After cleanup, you should have:

- ✅ Single source of truth: `supabase/migrations/20250127000005_seed_data.sql`
- ✅ Complete seed data: All required tables populated
- ✅ Reset-safe: `supabase db reset` produces working app
- ✅ No manual scripts: Everything automated
- ✅ Legacy archived: Clear "DO NOT USE" warning
- ✅ Documentation updated: All guides reference new system
- ✅ Team clarity: Everyone knows where seed data lives
- ✅ Production ready: No drift, no manual steps

### Verification Commands

```powershell
# 1. Test reset
supabase db reset

# 2. Check row counts
supabase db remote exec @"
SELECT 
  'skills' as table_name, COUNT(*) as rows FROM skills
UNION ALL SELECT 'tools', COUNT(*) FROM tools
UNION ALL SELECT 'safety_measures', COUNT(*) FROM safety_measures
UNION ALL SELECT 'symptoms', COUNT(*) FROM symptoms
UNION ALL SELECT 'symptom_mappings', COUNT(*) FROM symptom_mappings
UNION ALL SELECT 'symptom_questions', COUNT(*) FROM symptom_questions
ORDER BY table_name;
"@

# Expected:
# skills: 18
# tools: 19
# safety_measures: 10
# symptoms: 156
# symptom_mappings: 156
# symptom_questions: 400+

# 3. Verify no drift
supabase db diff

# 4. Test app
# - Symptom diagnosis loads
# - Mechanic profile creation works
# - Job requirements display correctly
```

---

## 🚀 NEXT STEPS

### Immediate Actions (Do Now)

1. **Extract production data from JSON**
   - I'll create a script to convert `data-fixed.json` to SQL
   - This will generate INSERT statements for the migration

2. **Update seed data migration**
   - Complete all TODO sections
   - Add production symptom data
   - Test with `supabase db reset`

3. **Archive legacy seed directory**
   - Move files to `seed-archive/`
   - Add warning README
   - Remove empty `seed/` directory

### Follow-Up Actions (After Cleanup)

4. **Update verification tools**
   - Update `verify_deployment.ps1` with new row counts
   - Update documentation with new seed data location

5. **Deploy to production**
   - Run `supabase db push`
   - Verify symptom diagnosis works
   - Check row counts match expectations

6. **Document rules**
   - Create `SEED_DATA_RULES.md`
   - Update team documentation
   - Add to onboarding materials

---

## 📞 DECISION REQUIRED

**Before I proceed with the cleanup, please confirm:**

1. ✅ **Approve migration-based seed strategy?**
   - All seed data in `20250127000005_seed_data.sql`
   - No manual scripts required

2. ✅ **Approve archiving legacy seed directory?**
   - Move to `seed-archive/` with warning
   - Remove from active use

3. ✅ **Approve data migration from JSON to SQL?**
   - Extract production data from `data-fixed.json`
   - Convert to SQL INSERT statements
   - Add to seed data migration

4. ✅ **Ready to proceed with cleanup?**
   - I'll execute the PowerShell commands
   - Update the migration file
   - Test with `supabase db reset`
   - Deploy to production

**Reply with:**
- "Approved - proceed with cleanup" to start
- "Wait - I have questions" to discuss
- "Modified approach - [your changes]" to adjust plan

---

**Last Updated:** 2025-01-27  
**Status:** AWAITING APPROVAL  
**Next:** Extract JSON data → Update migration → Archive legacy → Deploy
