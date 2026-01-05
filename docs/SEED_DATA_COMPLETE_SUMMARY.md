# 🌱 Seed Data Complete Summary

## ✅ Status: COMPLETE & TESTED

All seed data is consolidated in `supabase/migrations/20250127000005_seed_data.sql` and is fully idempotent.

---

## 🎯 What Was Fixed

### **Critical Issue: Symptom Icons Not Showing**

**Root Cause:**
- ✅ Database had icons in `public.symptoms` table (emoji text)
- ✅ `use-symptoms` hook correctly fetched icons via join
- ❌ **Explore screen UI didn't render the icons**

**Fix Applied:**
- Updated `app/(customer)/(tabs)/explore.tsx`:
  - Added `icon` field to `SymptomItem` type
  - Included `icon` in symptom data mapping
  - Added icon display in symptom cards (28px emoji before label)

**Result:**
- Icons now display beautifully in the Explore screen
- Each symptom shows its emoji icon (🚨, 🔔, 🛑, 🔊, 💧, 🔋, 🧰, ❓)

---

## 📊 Seed Data Overview (Plain English)

### **1) Skills** (`public.skills`)
**What it is:** Categories of mechanical expertise that mechanics can have

**Where it appears:**
- Mechanic profile setup/editing
- Job matching algorithm
- Mechanic search filters

**Why it matters:**
- Helps match the right mechanic to the right job
- Customers see what skills a mechanic has
- Mechanics can showcase their specialties

**Current seed data:**
- `brakes` - Brake system repairs
- `oil_change` - Oil changes and fluid services
- `battery` - Battery and electrical work
- `diagnostics` - Diagnostic scanning and troubleshooting
- `suspension` - Suspension and steering repairs

**Idempotency:** Uses `ON CONFLICT ("key") DO NOTHING` - safe to re-run, won't overwrite existing data

---

### **2) Tools** (`public.tools`)
**What it is:** Equipment and tools that mobile mechanics need to bring

**Where it appears:**
- Mechanic profile setup (checklist of tools they own)
- Job requirements (what tools are needed for specific repairs)
- Mechanic verification process

**Why it matters:**
- Ensures mechanics have the right equipment before accepting jobs
- Helps customers understand what a "mobile mechanic" brings
- Quality control - only mechanics with proper tools can accept certain jobs

**Current seed data (19 tools):**
- **Electrical:** Battery tester, multimeter, test light, jump pack
- **Lifting:** Jack, jack stands, breaker bar, impact wrench, torque wrench
- **Diagnostics:** Professional scan tool, phone/tablet backup
- **Fluids:** Catch pan, funnels, vacuum/bleeder kit
- **Safety:** Gloves/PPE, work light, wheel chocks
- **General:** Consumables kit, small parts inventory

**Idempotency:** Uses `ON CONFLICT ("key") DO NOTHING` - safe to re-run

---

### **3) Safety Measures** (`public.safety_measures`)
**What it is:** Safety protocols and practices for mobile mechanics working on-site

**Where it appears:**
- Mechanic onboarding/training
- Job safety checklists
- Insurance and liability verification

**Why it matters:**
- Protects mechanics from injury
- Protects customers' property
- Reduces liability for the platform
- Builds trust with customers

**Current seed data (10 safety measures):**
- Traffic awareness and roadside positioning
- Proper use of jack stands and wheel chocks
- High-visibility gear and warning triangles
- Photo documentation before/after work
- Fire/chemical safety awareness
- Knowing when to refuse unsafe jobs

**Idempotency:** Uses `ON CONFLICT ("key") DO NOTHING` - safe to re-run

---

### **4) Symptoms** (`public.symptoms`)
**What it is:** Customer-friendly symptom labels with emoji icons

**Where it appears:**
- **Explore screen** - Main symptom selection interface
- Job creation flow
- Mechanic job details

**Why it matters:**
- Helps customers describe their car problems in simple terms
- Icons make the UI more visual and friendly
- Links to detailed symptom information

**Current seed data (8 symptoms):**
- 🚨 `wont_start` - Won't start
- 🔔 `warning_light` - Warning light
- 🛑 `brakes_wrong` - Brakes feel wrong
- 🔊 `strange_noise` - Strange noise
- 💧 `fluid_leak` - Fluid leak
- 🔋 `battery_issues` - Battery issues
- 🧰 `maintenance` - Maintenance
- ❓ `not_sure` - Not sure

**Idempotency:** Uses `ON CONFLICT ("key") DO UPDATE SET label = EXCLUDED.label, icon = EXCLUDED.icon`
- **This is critical!** Re-running the seed will UPDATE icons and labels if they change
- Allows us to improve symptom descriptions without breaking existing data

---

### **5) Symptom Education** (`public.symptom_education`)
**What it is:** Detailed educational content for each symptom

**Where it appears:**
- Symptom detail screen (when customer taps a symptom)
- Educational modals
- Help/FAQ sections

**Why it matters:**
- Educates customers about their car problems
- Sets expectations for diagnosis and repair
- Builds trust by being transparent about the process

**Content for each symptom:**
- **Title:** Friendly headline (e.g., "Car Won't Start")
- **Summary:** What this symptom usually means
- **Is it safe:** Can you drive? Should you tow?
- **What we check:** What the mechanic will inspect
- **How quotes work:** Pricing structure for this type of issue

**Example (Won't Start):**
```
Title: "Car Won't Start"
Summary: "Most no-start issues are related to the battery, starter, or fuel system..."
Is it safe: "Don't drive - needs diagnosis first"
What we check: "Battery voltage, starter motor, fuel pump, ignition system"
How quotes work: "Diagnostic fee first, then repair quote based on findings"
```

**Idempotency:** Uses `ON CONFLICT (symptom_key) DO NOTHING` - won't overwrite existing education content

---

### **6) Symptom Mappings** (`public.symptom_mappings`)
**What it is:** Technical mapping of symptoms to skills, tools, safety requirements, and business logic

**Where it appears:**
- Backend job matching algorithm
- Mechanic filtering (who can handle this job?)
- Quote strategy determination
- Risk assessment

**Why it matters:**
- **Job Matching:** Ensures only qualified mechanics see relevant jobs
- **Safety:** Flags high-risk issues that need immediate attention
- **Pricing:** Determines if diagnostic fee is required first
- **Tools:** Ensures mechanic has the right equipment

**Fields explained:**
- `symptom_key`: Links to `public.symptoms`
- `symptom_label`: Human-readable label
- `category`: System category (Engine, Brakes, Electrical, etc.)
- `required_skill_keys`: Array of skills needed (currently empty `{}` - to be populated)
- `suggested_tool_keys`: Array of tools needed (currently empty `{}` - to be populated)
- `required_safety_keys`: Array of safety measures (currently empty `{}` - to be populated)
- `quote_strategy`: How pricing works
  - `diagnosis-first`: Diagnostic fee, then repair quote
  - `diagnostic_only`: Just diagnostic scan
  - `inspection_required`: Physical inspection needed
  - `fixed_simple`: Fixed price for simple services
- `risk_level`: `high`, `medium`, or `low`
- `customer_explainer`: Short description for customers
- `mechanic_notes`: Internal notes for mechanics (currently NULL)

**Current seed data (8 mappings):**
- All 8 symptoms have mappings
- Risk levels: 2 high (won't start, brakes), 2 medium (warning light, fluid leak), 4 low
- All use `diagnosis-first` strategy except maintenance (`fixed_simple`)

**Idempotency:** Uses `ON CONFLICT (symptom_key) DO UPDATE SET ...`
- **Updates all fields** on re-run (except created_at)
- Allows us to refine categories, risk levels, and explainers

---

### **7) Symptom Questions** (`public.symptom_questions`)
**What it is:** Follow-up questions to gather more details about each symptom

**Where it appears:**
- Job creation flow (after selecting a symptom)
- Diagnostic questionnaire
- Helps mechanics understand the issue before arriving

**Why it matters:**
- **Better Diagnosis:** More details = more accurate quotes
- **Safety Assessment:** Some answers trigger safety warnings
- **Tool Preparation:** Helps mechanic bring the right tools
- **Customer Experience:** Shows we care about details

**Question types:**
- `single_choice`: Pick one option
- `multi_choice`: Pick multiple options

**Fields explained:**
- `question_key`: Unique identifier (e.g., `key_turn_result`)
- `question_text`: What we ask the customer
- `question_type`: `single_choice` or `multi_choice`
- `options`: JSON array of possible answers
- `affects_safety`: Does this answer change safety assessment?
- `affects_quote`: Does this answer change pricing?
- `affects_tools`: Does this answer change tool requirements?
- `display_order`: Order to show questions (10, 20, 30...)

**Example (Won't Start):**
```
Question 1: "What happens when you turn the key?"
Options: ["Nothing at all", "Clicking sound", "Engine cranks but won't start", "Not sure"]
Affects: Safety ✓, Quote ✓, Tools ✗

Question 2: "Are your dashboard lights working?"
Options: ["Yes, normal", "Dim or flickering", "Not working", "Not sure"]
Affects: Safety ✗, Quote ✓, Tools ✗
```

**Current seed data:**
- **Won't Start:** 2 questions
- **Warning Light:** 2 questions
- **Brakes Wrong:** 2 questions
- **Strange Noise:** 2 questions
- **Fluid Leak:** 2 questions
- **Battery Issues:** 2 questions
- **Maintenance:** 1 question
- **Not Sure:** 1 question

**Total:** 14 questions across 8 symptoms

**Idempotency:** Uses `ON CONFLICT (symptom_key, question_key) DO NOTHING`
- Won't overwrite existing questions
- Safe to add new questions

---

## 🔄 Idempotency Strategy

### **DO NOTHING (Safe, No Updates)**
Used for:
- `skills` - Don't change existing skill definitions
- `tools` - Don't change existing tool definitions
- `safety_measures` - Don't change existing safety protocols
- `symptom_education` - Don't overwrite educational content
- `symptom_questions` - Don't overwrite existing questions

**Why:** These are foundational data that mechanics and customers rely on. Changing them could break existing profiles or jobs.

### **DO UPDATE (Updates Allowed)**
Used for:
- `symptoms` - Updates `label` and `icon` (display fields only)
- `symptom_mappings` - Updates all fields (business logic can evolve)

**Why:** These are display/business logic fields that we may want to refine over time without breaking data integrity.

---

## 🧪 Testing Checklist

### **Database Testing**
```bash
# Reset and seed
npx supabase db reset

# Verify symptoms have icons
npx supabase db query "SELECT key, label, icon FROM public.symptoms;"

# Verify symptom_mappings exist
npx supabase db query "SELECT symptom_key, category, risk_level FROM public.symptom_mappings;"

# Verify questions exist
npx supabase db query "SELECT symptom_key, question_key, question_text FROM public.symptom_questions ORDER BY symptom_key, display_order;"
```

### **UI Testing**
1. ✅ Open app → Customer → Explore tab
2. ✅ Verify all 8 symptoms show with emoji icons
3. ✅ Verify symptoms are grouped by category
4. ✅ Verify high/medium risk badges show
5. ✅ Tap a symptom → verify detail screen loads
6. ✅ Verify follow-up questions appear

### **Idempotency Testing**
```bash
# Run seed twice
npx supabase db reset
npx supabase db reset

# Verify no errors and data is identical
```

---

## 📁 File Structure

```
supabase/
├── migrations/
│   └── 20250127000005_seed_data.sql  ← MAIN SEED FILE (364 lines)
└── seed/                              ← LEGACY (for reference only)
    ├── data.json                      ← Original seed data
    ├── data-fixed.json                ← Extended seed data (5000+ lines)
    ├── seed.sql                       ← Old SQL format
    ├── seed-data.js                   ← Node.js upsert script
    ├── fix-json.js                    ← JSON cleanup script
    ├── package.json                   ← Dependencies
    ├── README.md                      ← Instructions
    └── RUN_INSTRUCTIONS.md            ← How to run
```

**Note:** The `supabase/seed/` folder is kept for reference but is NOT used. All seed data is now in the migration file.

---

## 🎨 Visual Preview

### **Explore Screen (Before Fix)**
```
┌─────────────────────────────────┐
│ Engine (2)                      │
├─────────────────────────────────┤
│ Won't start                  ›  │  ← No icon
│ Most no-start issues...         │
├─────────────────────────────────┤
│ Warning light                ›  │  ← No icon
│ Warning lights indicate...      │
└─────────────────────────────────┘
```

### **Explore Screen (After Fix)**
```
┌─────────────────────────────────┐
│ Engine (2)                      │
├─────────────────────────────────┤
│ 🚨 Won't start               ›  │  ← Icon shows!
│    Most no-start issues...      │
├─────────────────────────────────┤
│ 🔔 Warning light             ›  │  ← Icon shows!
│    Warning lights indicate...   │
└─────────────────────────────────┘
```

---

## 🚀 Deployment Ready

✅ Seed file is idempotent
✅ Icons display correctly
✅ All data validates against schema
✅ No TypeScript errors
✅ No console warnings
✅ Safe to run `npx supabase db reset` multiple times

---

## 📝 Next Steps (Optional Enhancements)

1. **Populate skill/tool/safety arrays in symptom_mappings**
   - Currently all arrays are empty `{}`
   - Could link symptoms to required skills/tools

2. **Add more symptoms**
   - The `data-fixed.json` has 100+ additional symptoms
   - Could be added incrementally as needed

3. **Add mechanic notes**
   - Currently NULL in symptom_mappings
   - Could add internal guidance for mechanics

4. **Add symptom refinements**
   - Schema supports `symptom_refinements` table
   - Could add sub-categories for more specific diagnosis

---

## 🎯 Summary

**What changed:**
- Fixed symptom icon display in explore screen (3 line changes)
- Verified seed data is correct and idempotent (no changes needed)

**What works:**
- All 8 symptoms display with emoji icons
- Seed data is consolidated in one migration file
- Idempotent - safe to re-run
- Schema-validated - no fake columns

**What's ready:**
- ✅ Production deployment
- ✅ Database resets
- ✅ Seed data updates
- ✅ Icon rendering

**Files modified:**
- `app/(customer)/(tabs)/explore.tsx` - Added icon display
- `SEED_DATA_COMPLETE_SUMMARY.md` - This document

**Files verified (no changes needed):**
- `supabase/migrations/20250127000005_seed_data.sql` - Already perfect!
