# Quick Reference: WrenchGo Seed Data

## 🎯 What Was Done

Converted the `supabase/seed` folder (JSON/JS) into a single idempotent SQL migration file with comprehensive plain-English content.

---

## 📁 Files Created/Modified

### **Modified**:
- `supabase/migrations/20250127000005_seed_data.sql` - Added `symptom_education` and `symptom_questions` seed data

### **Created**:
- `docs/SEED_DATA_EXPLANATION.md` - Plain-English explanation of all tables
- `docs/SEED_DATA_VERIFICATION.sql` - SQL queries to verify integrity
- `docs/SEED_DATA_SUMMARY.md` - Implementation summary
- `docs/SEED_DATA_QUICK_REFERENCE.md` - This file

---

## 📊 What's Seeded

| Table | Rows | What It Does |
|-------|------|--------------|
| `skills` | 9 | Mechanic capabilities (brakes, electrical, diagnostics) |
| `tools` | 7 | Equipment needed (scanner, multimeter, jack) |
| `safety_measures` | 5 | Safety protocols (jack stands, reflective gear) |
| `symptoms` | 17 | Customer-facing symptom categories **with emoji icons** 🔧🔋🛑 |
| `symptom_mappings` | 17 | Detailed symptom explanations, risk levels, quote strategies |
| `symptom_education` | 17 | **NEW** - Guides tab content (safety, process, pricing) |
| `education_cards` | 7 | Deep-dive educational content |
| `symptom_questions` | 52 | **NEW** - Diagnostic questions (3-4 per symptom) |

**Total**: 131 rows

---

## 🚀 How to Apply

```bash
# Reset database (applies all migrations including seed data)
npx supabase db reset

# Verify counts
npx supabase db query "
SELECT 'symptoms' AS table_name, COUNT(*) AS count FROM symptoms
UNION ALL SELECT 'symptom_mappings', COUNT(*) FROM symptom_mappings
UNION ALL SELECT 'symptom_education', COUNT(*) FROM symptom_education
UNION ALL SELECT 'symptom_questions', COUNT(*) FROM symptom_questions;
"

# Expected output:
# symptoms: 17
# symptom_mappings: 17
# symptom_education: 17
# symptom_questions: 52
```

---

## ✅ Verification Checklist

Run these queries to verify everything is correct:

```sql
-- 1. Check row counts
SELECT 'symptoms' AS table_name, COUNT(*) FROM symptoms
UNION ALL SELECT 'symptom_mappings', COUNT(*) FROM symptom_mappings
UNION ALL SELECT 'symptom_education', COUNT(*) FROM symptom_education
UNION ALL SELECT 'symptom_questions', COUNT(*) FROM symptom_questions;
-- Expected: 17, 17, 17, 52

-- 2. Verify all symptoms have icons
SELECT key, label, icon FROM symptoms WHERE icon IS NULL OR icon = '';
-- Expected: 0 rows

-- 3. Verify foreign keys (symptom_mappings → symptoms)
SELECT sm.symptom_key FROM symptom_mappings sm
LEFT JOIN symptoms s ON sm.symptom_key = s.key
WHERE s.key IS NULL;
-- Expected: 0 rows

-- 4. Verify foreign keys (symptom_education → symptoms)
SELECT se.symptom_key FROM symptom_education se
LEFT JOIN symptoms s ON se.symptom_key = s.key
WHERE s.key IS NULL;
-- Expected: 0 rows

-- 5. Verify foreign keys (symptom_questions → symptoms)
SELECT DISTINCT sq.symptom_key FROM symptom_questions sq
LEFT JOIN symptoms s ON sq.symptom_key = s.key
WHERE s.key IS NULL;
-- Expected: 0 rows

-- 6. Verify risk levels are valid
SELECT DISTINCT risk_level FROM symptom_mappings
WHERE risk_level NOT IN ('low', 'medium', 'high');
-- Expected: 0 rows

-- 7. Verify question types are valid
SELECT DISTINCT question_type FROM symptom_questions
WHERE question_type NOT IN ('yes_no', 'single_choice', 'multi_choice', 'numeric', 'photo', 'audio');
-- Expected: 0 rows
```

---

## 📱 How It Shows Up in the App

### **Explore Tab** (`app/(customer)/(tabs)/explore.tsx`)
- Shows 17 symptoms grouped by category
- Each symptom has:
  - Emoji icon (🔧, 🔋, 🛑, etc.)
  - Risk badge (LOW/MEDIUM/HIGH with color)
  - 1-line plain-English explainer

### **Guides Tab** (`app/(customer)/education.tsx`)
- Shows 17 education guides
- Each guide answers:
  - **Is it safe to drive?** (with specific warnings)
  - **What will mechanics check?** (transparency about process)
  - **How do quotes work?** (price ranges like "$150-$300")

### **Diagnostic Flow** (Job Creation)
- Shows 3-4 questions per symptom
- Question types: yes/no, single choice, multiple choice
- Flags:
  - `affects_safety` → Determines if safe to drive
  - `affects_quote` → Refines price estimation

---

## 🎨 Icon Implementation

**All 17 symptoms have emoji icons**:
- Stored as emoji strings in `symptoms.icon` column
- Rendered directly in React Native `<Text>{icon}</Text>`
- No icon library needed
- Verified: All icons present, no NULL values

**Sample**:
```sql
SELECT key, label, icon FROM symptoms LIMIT 5;

-- Output:
-- basic_maintenance | Basic Maintenance | 🔧
-- battery_issue | Battery Issue | 🔋
-- brake_issue | Brake Issue | 🛑
-- fluid_leak | Fluid Leak | 💧
-- no_start_no_crank | Won't Start | 🚨
```

---

## 📝 Content Quality

**Plain English Principles**:
- ✅ No jargon (avoided "solenoid", "parasitic draw")
- ✅ Specific prices ("$150-$300", not "varies")
- ✅ Honest safety ("DO NOT DRIVE if overheating")
- ✅ Conversational ("We'll test...", "You might...")
- ✅ Actionable ("Pull over immediately")

**Example** (battery_issue):
```
is_it_safe: "Usually safe for short trips, but you risk getting stranded. 
             Best to address it soon. If the battery is hot, swollen, or 
             smells like rotten eggs, don't touch it and call for help."

how_quotes_work: "Battery testing is usually free or $20-$30. A new battery 
                  costs $100-$200 installed. If it's the alternator, expect 
                  $300-$600. We'll test first so you don't replace the wrong part."
```

---

## 🔍 Validation Results

**All checks passed** ✅:
- 131 total rows seeded
- 0 NULL icons
- 0 orphaned foreign keys
- 0 invalid risk levels
- 0 invalid quote strategies
- 0 invalid question types
- 0 duplicate symptom_keys
- 0 duplicate (symptom_key, question_key) pairs
- All symptoms have education content

---

## 📚 Full Documentation

For detailed explanations, see:
- **`docs/SEED_DATA_EXPLANATION.md`** - Table-by-table descriptions, data flow, content principles
- **`docs/SEED_DATA_VERIFICATION.sql`** - 15 verification queries
- **`docs/SEED_DATA_SUMMARY.md`** - Complete implementation summary

---

## 🎉 Done!

The seed data is ready. Just run `npx supabase db reset` and restart your Expo app to see:
- ✅ 17 symptoms with emoji icons in Explore tab
- ✅ 17 education guides in Guides tab
- ✅ 52 diagnostic questions in job creation flow
