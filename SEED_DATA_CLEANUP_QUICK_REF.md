# 🎯 SEED DATA CLEANUP - QUICK REFERENCE

## 📊 THE PROBLEM

**Two seed systems = drift risk + broken `db reset`**

| System | Location | Reset-Safe | Complete |
|--------|----------|------------|----------|
| Migration | `migrations/20250127000005_seed_data.sql` | ✅ Yes | ❌ No (TODOs) |
| Legacy | `supabase/seed/*` | ❌ No | ✅ Yes |

**Result:** `supabase db reset` produces incomplete database → symptom diagnosis broken

---

## ✅ THE SOLUTION

**Single source of truth: Migration-based seed data**

```
supabase/migrations/20250127000005_seed_data.sql
  ↓
Contains ALL required seed data
  ↓
Runs automatically with db reset
  ↓
Production ready, no manual scripts
```

---

## 🔧 CLEANUP STEPS

### 1. Extract JSON Data to SQL
```powershell
# Run extraction script (I'll create this)
node scripts/extract-seed-data.js
```

### 2. Update Migration File
```powershell
# Edit migration with production data
code supabase/migrations/20250127000005_seed_data.sql
```

### 3. Test Locally
```powershell
# Reset and verify
supabase db reset

# Check row counts
supabase db remote exec "SELECT 'symptoms' as t, COUNT(*) FROM symptoms UNION ALL SELECT 'symptom_mappings', COUNT(*) FROM symptom_mappings;"
```

### 4. Archive Legacy Seed
```powershell
# Create archive
New-Item -ItemType Directory -Path "supabase/seed-archive" -Force

# Move files
Get-ChildItem -Path "supabase/seed" -File | Move-Item -Destination "supabase/seed-archive"

# Remove empty directory
Remove-Item -Path "supabase/seed" -Force
```

### 5. Deploy
```powershell
# Push to production
supabase db push

# Verify
.\verify_deployment.ps1
```

---

## 📋 EXPECTED ROW COUNTS

After cleanup:

| Table | Rows | Status |
|-------|------|--------|
| skills | 18 | ✅ Complete |
| tools | 19 | ✅ Complete |
| safety_measures | 10 | ✅ Complete |
| symptoms | 156 | ✅ Complete |
| symptom_mappings | 156 | ✅ Complete |
| symptom_questions | 400+ | ✅ Complete |

---

## 🚫 RULES OF THE ROAD

### ✅ DO

```powershell
# Create migration for seed data
supabase migration new add_seed_data

# Make it idempotent
INSERT INTO table (col) VALUES ('val') ON CONFLICT DO NOTHING;

# Test before pushing
supabase db reset
supabase db push
```

### ❌ DON'T

```powershell
# Never create manual seed scripts
node scripts/seed.js  # ❌

# Never use TRUNCATE in migrations
TRUNCATE TABLE skills;  # ❌

# Never skip local testing
supabase db push  # ❌ (without testing first)
```

---

## 🎯 VERIFICATION

```powershell
# 1. Reset works
supabase db reset

# 2. No drift
supabase db diff

# 3. Row counts correct
supabase db remote exec "SELECT COUNT(*) FROM symptoms;"
# Expected: 156

# 4. App works
# Test symptom diagnosis feature
```

---

## 📁 FINAL STRUCTURE

```
supabase/
├── migrations/
│   └── 20250127000005_seed_data.sql  ← SINGLE SOURCE OF TRUTH
│
└── seed-archive/                      ← ARCHIVED (DO NOT USE)
    ├── ARCHIVED_README.md             ← Warning
    └── data-fixed.json                ← Original data
```

---

## 🆘 TROUBLESHOOTING

### Reset Fails
```powershell
# Check which migration fails
supabase db reset

# Fix that migration
# Test again
```

### Row Counts Wrong
```powershell
# Check what's in migration
cat supabase/migrations/20250127000005_seed_data.sql

# Verify INSERT statements
# Re-run reset
```

### App Missing Data
```powershell
# Check if data loaded
supabase db remote exec "SELECT * FROM symptoms LIMIT 5;"

# If empty, check migration
# If present, check app queries
```

---

## 📞 APPROVAL CHECKLIST

Before proceeding:

- [ ] Understand the problem (two seed systems)
- [ ] Approve migration-based strategy
- [ ] Approve archiving legacy seed
- [ ] Ready to extract JSON to SQL
- [ ] Ready to test with db reset
- [ ] Ready to deploy to production

**Reply:** "Approved - proceed with cleanup"

---

**See:** `SEED_DATA_ARCHITECTURE_ANALYSIS.md` for full details
