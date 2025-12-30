# WrenchGo - Complete Customer Job Request Flow

## Overview
This document describes the complete multi-step job request flow for WrenchGo customers, following UX best practices for anxiety reduction and guided experiences.

## Flow Architecture

### 1. Home Screen (`app/(customer)/(tabs)/index.tsx`)
**Purpose:** Central hub for customer actions

**Features:**
- Welcome message with user's first name
- "Request a Mechanic" primary CTA → navigates to Garage
- "My Garage" section showing up to 3 vehicles
- Active jobs preview
- Unread messages count

**Navigation:**
- "Request a Mechanic" → `/(customer)/garage/index?returnTo=request-service`
- Vehicle cards → `/(customer)/garage/[id]`
- "Add Vehicle" → `/(customer)/garage/add`

---

### 2. Garage / Vehicle Selection (`app/(customer)/garage/index.tsx`)
**Purpose:** Select which vehicle needs service

**Features:**
- Mascot dialogue: "Which car needs help today?"
- List of saved vehicles with:
  - Vehicle image (from Imagin Studio API)
  - Year, make, model
  - Nickname (if set)
  - "Use this vehicle" button (when `returnTo=request-service`)
- "+ Add New Vehicle" button
- "Continue without vehicle" option (skip link)

**Data Captured:**
- `vehicleId`
- `vehicleYear`
- `vehicleMake`
- `vehicleModel`
- `vehicleNickname` (optional)

**Navigation:**
- "Use this vehicle" → `/(customer)/(tabs)/explore` with vehicle params
- "Add New Vehicle" → `/(customer)/garage/add`
- "Continue without vehicle" → `/(customer)/(tabs)/explore` without params
- Back button → Home

---

### 3. Add New Vehicle (`app/(customer)/garage/add.tsx`)
**Purpose:** Add a vehicle to the garage

**Features:**
- Mascot dialogue: "Let's add your car to the garage..."
- Vehicle preview image
- Form fields:
  - Year (picker: 1980-2025)
  - Make (searchable dropdown from NHTSA API)
  - Model (searchable dropdown from NHTSA API, filtered by make)
  - Nickname (optional text input)
- "Save & Continue" button

**Data Captured:**
```typescript
{
  user_id: string,
  year: number,
  make: string,
  model: string,
  nickname: string | null
}
```

**Database:** Inserts into `vehicles` table

**Navigation:**
- "Save & Continue" → Back to Garage
- Back button → Garage (with confirmation if fields filled)

---

### 4. Symptom Picker (`app/(customer)/(tabs)/explore.tsx`)
**Purpose:** Customer describes the problem in plain English

**Features:**
- **Vehicle chip** at top (if selected) - tappable to change vehicle
- Mascot dialogue: "Hey there! I'm Wrench, your car care buddy..."
- Header: "What's Going On?"
- 8 large symptom tiles:
  - 🚨 Won't start
  - 🔔 Warning light
  - 🛑 Brakes feel wrong
  - 🔊 Strange noise
  - 💧 Fluid leak
  - 🔋 Battery issues
  - 🧰 Maintenance
  - ❓ Not sure
- Reassuring message: "Don't worry if you're not sure..."

**Data Captured:**
- `symptom` key

**Navigation:**
- Symptom tile → `/(customer)/request-service?symptom=X&vehicleId=...` (with all vehicle params)
- Vehicle chip → Back to Garage
- Back button → Garage (preserves vehicle selection)

---

### 5. Education Card (`app/(customer)/request-service.tsx` - Step 1)
**Purpose:** Reduce anxiety, set expectations, build trust

**Features:**
- **Vehicle chip** at top (if selected) - tappable to change
- Large symptom icon (88x88px)
- Symptom title (e.g., "Car Won't Start")
- Plain-English summary
- 3 info chips:
  - 🛟 Safety status (color-coded: green/yellow/red)
  - 🔍 What we check
  - 💵 How quotes work
- Mascot dialogue: "Good news! This is super common..."
- "Continue" button

**Data Captured:** None (education only)

**Navigation:**
- "Continue" → Questions step (if questions exist) or Context step
- Vehicle chip → Back to Garage
- Back button → Symptom picker (preserves vehicle)

---

### 6. Smart Questions (`app/(customer)/request-service.tsx` - Step 2)
**Purpose:** Gather diagnostic clues without technical knowledge

**Features:**
- **Vehicle chip** at top (if selected) - tappable to change
- Progress bar: "Question 2 of 3"
- One question at a time (progressive disclosure)
- Mascot dialogue (dynamic):
  - First question: "Just pick what sounds right..."
  - Later questions: "Almost there! These details help..."
- Question text
- Multiple choice options (large tappable cards)
- "Not sure" always included
- Optional explanation card: "💡 This helps identify..."

**Data Captured:**
```typescript
{
  q1: "Clicking sound",
  q2: "Dim or flickering"
}
```

**Navigation:**
- Answer option → Next question (auto-advance) or Context step
- Vehicle chip → Back to Garage
- Back button → Previous question or Education card

---

### 7. Context & Safety (`app/(customer)/request-service.tsx` - Step 3)
**Purpose:** Safety-critical info for mechanics

**Features:**
- **Vehicle chip** at top (if selected) - tappable to change
- Mascot dialogue: "Last step! This helps mechanics know what tools to bring..."
- Three sections:
  1. **Can the car move?** (Yes | No | Not sure)
  2. **Where is the car?** (Driveway | Parking lot | Roadside | Other)
  3. **Mileage (optional)** (number input)
- "Continue to Review" button (disabled until first two answered)

**Data Captured:**
```typescript
{
  can_move: "No",
  location_type: "Driveway",
  mileage: "45000"
}
```

**Navigation:**
- "Continue to Review" → Review step
- Vehicle chip → Back to Garage
- Back button → Last question (preserves all data)

---

### 8. Review & Submit (`app/(customer)/request-service.tsx` - Step 4)
**Purpose:** Final confirmation, transparency, manage expectations

**Features:**
- **Vehicle chip** at top (if selected) - tappable to change
- Mascot dialogue: "Perfect! Here's everything you told me..."
- Summary card showing:
  - **Vehicle:** 2018 Honda Accord (if selected)
  - **Issue:** 🚨 Won't start
  - **Your answers:** Q&A pairs
  - **Context:** Can move, location, mileage
  - Quote strategy info chip
- "What Happens Next" section:
  - "Mechanics will review and send quotes"
  - "You'll see quotes within 1-2 hours"
  - "No payment until you accept a quote"
- "🔵 Request Mechanics" button (large, prominent)

**Data Captured:** None (review only)

**Navigation:**
- "Request Mechanics" → Searching step (submits job)
- Vehicle chip → Back to Garage (preserves all other data)
- Back button → Context step (preserves all data)

---

### 9. Searching / Matching (`app/(customer)/request-service.tsx` - Step 5)
**Purpose:** Prevent anxiety during async process

**Features:**
- Large mascot image (96x96px in white circle)
- Loading spinner
- "Finding Mechanics..."
- Mascot dialogue: "You're all set! I'm notifying nearby mechanics..."
- Auto-redirects to home after 2 seconds

**Data Captured:** Job created with:
```typescript
{
  customer_id: userId,
  vehicle_id: vehicleId || null,
  title: "Won't start",
  description: JSON.stringify({
    symptom: { key, label },
    answers: { q1: "...", q2: "..." },
    context: { can_move, location_type, mileage },
    vehicle: { id, year, make, model, nickname }
  }),
  status: "searching",
  location: "POINT(lng lat)"
}
```

**Database:** Inserts into `jobs` table

**Navigation:**
- Auto-redirect → Home (after 2 seconds)
- Back button → Disabled (submission complete)

---

### 10. Home (Post-Submission)
**Purpose:** Show job status, notify when quotes arrive

**Features:**
- Same home layout
- "Active Jobs" section at top:
  - Job card showing:
    - Vehicle: 2018 Honda Accord
    - Issue: Won't start
    - Status badge: "Finding mechanics..." → "3 quotes received"
    - Time posted: "2 minutes ago"
    - Tap to view details

**Navigation:**
- Job card → Job details / quotes screen

---

## Database Schema

### `vehicles` Table
```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  nickname TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `jobs` Table (Updated)
```sql
ALTER TABLE jobs ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
```

---

## Key UX Principles Applied

✅ **Vehicle selection happens early** (Screen 2, before symptom)  
✅ **Vehicle remains visible** throughout flow (chip at top of screens 4-8)  
✅ **Vehicle is editable** from any screen without losing other data  
✅ **Every screen has a back button** (except home and searching)  
✅ **Back button preserves data** at every step  
✅ **No technical language** required from customer  
✅ **"Not sure" always available** in questions  
✅ **2-5 smart questions** per symptom (not overwhelming)  
✅ **Education before questions** (reduces anxiety)  
✅ **Mascot guidance** on every screen (friendly, reassuring)  
✅ **Progressive disclosure** (one question at a time)  
✅ **Clear expectations** (what happens next, timing, no payment upfront)  
✅ **Visual hierarchy** (large CTAs, clear sections, readable text)

---

## Component Architecture

### Reusable Components

**`VehicleChip` (`src/components/VehicleChip.tsx`)**
- Shows selected vehicle throughout flow
- Tappable to change vehicle
- Displays nickname or full vehicle name
- Consistent styling across all screens

**Usage:**
```tsx
<VehicleChip
  year="2018"
  make="Honda"
  model="Accord"
  nickname="Daily Driver"
  onPress={handleChangeVehicle}
/>
```

---

## State Management

### URL Parameters (Preserved Throughout Flow)
```typescript
{
  symptom: "wont_start",
  vehicleId: "uuid",
  vehicleYear: "2018",
  vehicleMake: "Honda",
  vehicleModel: "Accord",
  vehicleNickname: "Daily Driver"
}
```

### Local State (Per Screen)
- `step`: Current step in request-service flow
- `answers`: Question responses
- `canMove`, `locationType`, `mileage`: Context data
- `submitting`: Loading state

---

## Testing Checklist

- [ ] Home → Garage → Add Vehicle → Save → Back to Garage
- [ ] Garage → Select Vehicle → Symptom Picker (vehicle chip visible)
- [ ] Symptom Picker → Education → Questions → Context → Review
- [ ] Vehicle chip tappable on all screens
- [ ] Back button preserves data at every step
- [ ] Change vehicle from review screen → returns to review with new vehicle
- [ ] Submit job → Creates job with vehicle_id
- [ ] Skip vehicle selection → Flow works without vehicle
- [ ] "Not sure" option available in all questions
- [ ] Mascot dialogue appears on all screens
- [ ] Loading states work correctly
- [ ] Error handling (location permission, network errors)

---

## Future Enhancements

1. **Vehicle photos:** Allow customers to upload photos of their vehicle
2. **Primary vehicle:** Auto-select primary vehicle on garage screen
3. **Recent vehicles:** Show recently used vehicles first
4. **Vehicle history:** Show service history per vehicle
5. **Smart defaults:** Pre-fill mileage based on vehicle age
6. **Offline support:** Cache vehicle data for offline access
7. **Voice input:** Allow voice description of symptoms
8. **Photo upload:** Let customers upload photos of the issue

---

## File Structure

```
app/
├── (customer)/
│   ├── (tabs)/
│   │   ├── index.tsx          # Home screen
│   │   └── explore.tsx        # Symptom picker
│   ├── garage/
│   │   ├── index.tsx          # Vehicle selection
│   │   ├── add.tsx            # Add new vehicle
│   │   └── [id].tsx           # Vehicle details
│   └── request-service.tsx    # Multi-step flow
src/
├── components/
│   └── VehicleChip.tsx        # Reusable vehicle chip
└── lib/
    └── supabase.ts            # Database client
supabase/
└── migrations/
    └── 20240101000000_create_vehicles.sql
```

---

## Notes

- All screens use the mascot dialogue pattern for consistency
- Vehicle chip uses accent color for visibility
- All CTAs use consistent styling (large, rounded, shadowed)
- Error states handled gracefully with user-friendly messages
- Loading states prevent double-submission
- Location permission requested only when needed (at submit)
- Job description stores full intake data as JSON for flexibility
