# WrenchGo Seed Data - Plain English Explanation

## Overview
This seed data powers the customer-facing symptom selection, diagnostic questions, and educational guides in the WrenchGo app. All content is written in plain English to be accessible to non-car people.

---

## Tables Seeded

### 1. **skills** (9 rows)
Mechanic capabilities like "Brakes", "Oil Change", "Diagnostics", "Electrical", etc. These are referenced by `symptom_mappings.required_skill_keys` to match jobs with qualified mechanics.

**Used by**: Mechanic matching algorithm, job requirements

---

### 2. **tools** (7 rows)
Equipment needed for repairs: "Diagnostic Scanner", "Jack", "Multimeter", "Work Light", etc. Referenced by `symptom_mappings.suggested_tool_keys`.

**Used by**: Mechanic preparation, job complexity estimation

---

### 3. **safety_measures** (5 rows)
Safety requirements like "Use jack stands", "Wear reflective vest", "Battery safety". Referenced by `symptom_mappings.required_safety_keys`.

**Used by**: Mechanic safety protocols, job risk assessment

---

### 4. **symptoms** (17 rows)
Customer-friendly symptom categories with emoji icons:
- 🔧 Basic Maintenance
- 🔋 Battery Problems
- 🛑 Brake Problems
- 💧 Fluid Leak
- 🚨 Won't Start
- 🔊 Strange Noise
- ⚠️ Warning Light
- 🔌 Electrical issues (no crank, clicking, alternator, parasitic drain, ABS light)
- 🌡️ Cooling issues (overheating, coolant leak, radiator fan, thermostat, water pump)

**Icons**: Stored as emoji strings (e.g., '🔧', '🔋') for direct rendering in React Native `<Text>` components.

**Used by**: 
- `app/(customer)/(tabs)/explore.tsx` - Symptom selection list
- `use-symptoms` hook - Fetches symptoms with icons via LEFT JOIN

---

### 5. **symptom_mappings** (17 rows)
Detailed explanations for each symptom in plain English:

**Columns**:
- `symptom_key`: Unique identifier (e.g., 'battery_issue')
- `symptom_label`: Display name (e.g., "Battery Issue")
- `category`: Grouping (e.g., "Electrical & Charging", "Brakes", "Cooling System")
- `risk_level`: "low" | "medium" | "high" (affects UI badge color and urgency)
- `quote_strategy`: "fixed_simple" | "inspection_required" | "diagnostic_only"
- `customer_explainer`: 1-2 sentence plain-English description
- `mechanic_notes`: Technical details for mechanics (not shown to customers)
- `required_skill_keys`: Array of skill keys needed
- `suggested_tool_keys`: Array of tool keys recommended
- `required_safety_keys`: Array of safety measures required

**Risk Levels**:
- **LOW**: Routine maintenance, minor issues (e.g., parasitic drain)
- **MEDIUM**: Needs attention soon (e.g., battery, brakes, coolant leak)
- **HIGH**: Urgent, safety-critical (e.g., overheating, brake failure, no start)

**Quote Strategies**:
- **fixed_simple**: Predictable pricing (e.g., oil change)
- **inspection_required**: Need to see it first (e.g., brake noise, fluid leak)
- **diagnostic_only**: Must diagnose before quoting (e.g., check engine light, electrical issues)

**Used by**:
- `app/(customer)/(tabs)/explore.tsx` - Displays symptoms grouped by category with risk badges
- Job creation flow - Captures customer's problem description

---

### 6. **symptom_education** (17 rows)
Comprehensive guides for the "Guides" tab, answering:
- **Is it safe to drive?** (actionable safety advice)
- **What will mechanics check?** (transparency about the process)
- **How do quotes work?** (price ranges and expectations)

**Content Style**:
- Direct, conversational tone
- Specific price ranges (e.g., "$150-$300", "$1,000-$2,500")
- Clear safety warnings (e.g., "DO NOT DRIVE if overheating")
- Explains WHY things cost what they do
- Reduces anxiety about the unknown

**Example** (battery_issue):
```
is_it_safe: "Usually safe for short trips, but you risk getting stranded. 
             Best to address it soon. If the battery is hot, swollen, or 
             smells like rotten eggs, don't touch it and call for help."

what_we_check: "We test battery voltage and health, check the alternator 
                charging output, inspect terminals for corrosion, and 
                measure for parasitic drain if the battery keeps dying overnight."

how_quotes_work: "Battery testing is usually free or $20-$30. A new battery 
                  costs $100-$200 installed. If it's the alternator, expect 
                  $300-$600. We'll test first so you don't replace the wrong part."
```

**Used by**:
- `app/(customer)/education.tsx` - Displays guides when user taps a symptom
- Future: In-app educational content, FAQ section

---

### 7. **education_cards** (7 rows)
Deep-dive educational content for common symptoms. More detailed than `symptom_education`.

**Columns**:
- `symptom_key`: Links to symptom
- `card_key`: Usually "core" (allows multiple cards per symptom in future)
- `title`, `summary`: Brief overview
- `why_it_happens`: Root causes explained
- `what_we_check`: Detailed inspection process
- `is_it_safe`: Safety guidance
- `prep_before_visit`: What customers can do to help
- `quote_expectation`: Pricing transparency
- `red_flags`: When to stop driving immediately

**Used by**:
- `app/(customer)/education.tsx` - Optional expanded content
- Future: "Learn More" sections

---

### 8. **symptom_questions** (70+ rows)
Diagnostic questions asked after symptom selection to refine the problem.

**Question Types**:
- `yes_no`: Simple yes/no
- `single_choice`: Pick one option
- `multi_choice`: Select multiple (e.g., "When do you hear the noise?")
- `numeric`: Enter a number (e.g., mileage)
- `photo`: Upload image
- `audio`: Record sound

**Flags**:
- `affects_safety`: If true, answer determines if it's safe to drive
- `affects_quote`: If true, answer impacts price estimation
- `display_order`: Controls question sequence

**Example** (brake_issue):
```sql
('brake_issue', 'brake_noise_type', 'What kind of noise do you hear?', 
 'single_choice', '["Squealing", "Grinding", "Clicking", "No noise"]', 
 true, true, 1)
```
- **affects_safety**: true (grinding = unsafe)
- **affects_quote**: true (grinding = rotors needed, higher cost)

**Used by**:
- Job creation flow - Captures detailed symptom information
- Mechanic matching - Helps route to specialists
- Quote estimation - Refines price range

---

## How Data Flows Through the App

### 1. **Explore Tab** (`app/(customer)/(tabs)/explore.tsx`)
```
symptoms (icons) 
  ↓ LEFT JOIN
symptom_mappings (labels, explainers, risk_level, category)
  ↓ GROUP BY category
Display: Grouped symptom cards with icons, risk badges, explainers
```

### 2. **Symptom Selection**
```
User taps symptom → Navigate to question flow
  ↓
symptom_questions (filtered by symptom_key, ordered by display_order)
  ↓
User answers questions → Captured in job.symptom_details (JSONB)
```

### 3. **Guides Tab** (`app/(customer)/education.tsx`)
```
symptom_education (is_it_safe, what_we_check, how_quotes_work)
  ↓ OPTIONAL
education_cards (deeper content)
  ↓
Display: Safety info, inspection process, pricing transparency
```

### 4. **Mechanic Matching**
```
symptom_mappings.required_skill_keys
  ↓ MATCH
mechanic_profiles.skill_keys
  ↓
Filter mechanics who can handle the job
```

---

## Content Principles

### ✅ DO:
- Use plain English (avoid jargon like "solenoid", "parasitic draw")
- Give specific price ranges ("$150-$300", not "varies")
- Explain WHY things cost what they do
- Be honest about safety (don't sugarcoat danger)
- Use conversational tone ("We'll test...", "You might...")
- Give actionable advice ("Pull over immediately", "Safe for short trips")

### ❌ DON'T:
- Use technical terms without explanation
- Say "contact us for pricing" (give ranges)
- Be vague about safety ("might be dangerous")
- Sound corporate or robotic
- Assume users know car parts
- Leave users anxious about the unknown

---

## Missing / Needs Decision

### Not Yet Seeded:
- **symptom_question_options**: Separate table for question options (currently using JSONB in `symptom_questions.options`)
- **symptom_refinements**: Advanced diagnostic logic (not implemented yet)

### Future Enhancements:
- More granular symptoms (e.g., "Brake squealing when cold" vs "Brake grinding")
- Video/audio examples for noises
- Interactive diagnostic trees (if X, ask Y)
- Regional pricing variations
- Seasonal maintenance reminders

---

## Verification Checklist

Run these SQL queries to verify seed data integrity:

```sql
-- 1. Count rows per table
SELECT 'skills' AS table_name, COUNT(*) FROM skills
UNION ALL
SELECT 'tools', COUNT(*) FROM tools
UNION ALL
SELECT 'safety_measures', COUNT(*) FROM safety_measures
UNION ALL
SELECT 'symptoms', COUNT(*) FROM symptoms
UNION ALL
SELECT 'symptom_mappings', COUNT(*) FROM symptom_mappings
UNION ALL
SELECT 'symptom_education', COUNT(*) FROM symptom_education
UNION ALL
SELECT 'education_cards', COUNT(*) FROM education_cards
UNION ALL
SELECT 'symptom_questions', COUNT(*) FROM symptom_questions;

-- Expected:
-- skills: 9
-- tools: 7
-- safety_measures: 5
-- symptoms: 17
-- symptom_mappings: 17
-- symptom_education: 17
-- education_cards: 7
-- symptom_questions: 70+

-- 2. Confirm icons are not null
SELECT key, label, icon 
FROM symptoms 
WHERE icon IS NULL OR icon = '';
-- Expected: 0 rows (all symptoms should have icons)

-- 3. Confirm foreign keys are valid (symptom_mappings → symptoms)
SELECT sm.symptom_key 
FROM symptom_mappings sm
LEFT JOIN symptoms s ON sm.symptom_key = s.key
WHERE s.key IS NULL;
-- Expected: 0 rows (all symptom_keys should exist in symptoms)

-- 4. Confirm foreign keys are valid (symptom_education → symptoms)
SELECT se.symptom_key 
FROM symptom_education se
LEFT JOIN symptoms s ON se.symptom_key = s.key
WHERE s.key IS NULL;
-- Expected: 0 rows

-- 5. Confirm foreign keys are valid (symptom_questions → symptoms)
SELECT DISTINCT sq.symptom_key 
FROM symptom_questions sq
LEFT JOIN symptoms s ON sq.symptom_key = s.key
WHERE s.key IS NULL;
-- Expected: 0 rows

-- 6. Verify risk levels are valid
SELECT DISTINCT risk_level 
FROM symptom_mappings 
WHERE risk_level NOT IN ('low', 'medium', 'high');
-- Expected: 0 rows

-- 7. Verify quote strategies are valid
SELECT DISTINCT quote_strategy 
FROM symptom_mappings 
WHERE quote_strategy NOT IN ('fixed_simple', 'inspection_required', 'diagnostic_only', 'diagnosis-first');
-- Expected: 0 rows (note: 'diagnosis-first' is legacy, should be 'diagnostic_only')

-- 8. Verify question types are valid
SELECT DISTINCT question_type 
FROM symptom_questions 
WHERE question_type NOT IN ('yes_no', 'single_choice', 'multi_choice', 'numeric', 'photo', 'audio');
-- Expected: 0 rows

-- 9. Check for duplicate symptom_keys
SELECT symptom_key, COUNT(*) 
FROM symptom_mappings 
GROUP BY symptom_key 
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 10. Check for duplicate (symptom_key, question_key) pairs
SELECT symptom_key, question_key, COUNT(*) 
FROM symptom_questions 
GROUP BY symptom_key, question_key 
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 11. Verify all symptoms have education content
SELECT s.key, s.label
FROM symptoms s
LEFT JOIN symptom_education se ON s.key = se.symptom_key
WHERE se.symptom_key IS NULL;
-- Expected: 0 rows (all symptoms should have education content)

-- 12. Verify icons render correctly (check for encoding issues)
SELECT key, label, 
       LENGTH(icon) AS icon_length,
       icon,
       CASE 
         WHEN icon ~ '^[\x{1F300}-\x{1F9FF}]' THEN 'Valid emoji'
         ELSE 'Check encoding'
       END AS icon_status
FROM symptoms;
-- Expected: All icons should be 1-4 characters (emoji) and show "Valid emoji"
```

---

## Quick Reset & Verify

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

# Check icons
npx supabase db query "SELECT key, label, icon FROM symptoms LIMIT 5;"

# Verify app can query data
# In app console, should see:
# "Symptoms loaded: 17"
# "Education cards loaded: 7"
```

---

## Summary

This seed data provides:
- ✅ **17 symptoms** with emoji icons for visual recognition
- ✅ **17 symptom mappings** with plain-English explanations, risk levels, and quote strategies
- ✅ **17 education guides** answering safety, process, and pricing questions
- ✅ **70+ diagnostic questions** to refine problem details
- ✅ **7 deep-dive education cards** for common issues
- ✅ **9 skills, 7 tools, 5 safety measures** for mechanic matching

All content is:
- Written in plain English
- Customer-friendly (no jargon)
- Transparent about pricing
- Honest about safety
- Designed to reduce anxiety and build trust
