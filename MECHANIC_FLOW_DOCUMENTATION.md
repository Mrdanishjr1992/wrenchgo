# Mechanic Flow Documentation

## Navigation Architecture

**CRITICAL: No new tabs or bottom navigation items**
- Uses existing "Jobs" tab (leads.tsx) as the single entry point
- All screens use stack navigation with header back button
- Flow: Jobs List → Job Detail → Quote Composer → Quote Review → Quote Sent
- No additional tabs, no new bottom navigation items

---

## Complete Flow

### 1. Jobs List (`app/(mechanic)/(tabs)/leads.tsx`)

**Header:** "Jobs"  
**Back behavior:** None (root tab screen)

**What mechanics see:**
- List of available jobs sorted by distance/time
- Each card displays:
  - Symptom icon (48px) + label (e.g., 🚨 Won't start)
  - Vehicle: 2018 Honda Accord
  - Distance: 2.3 mi • Location type (Driveway)
  - Can move badge: Green "CAN MOVE" or gray "CAN'T MOVE"
  - Time posted: "12 min ago"
- Filter chips: All | Nearby | Quoted
- Pull to refresh

**Key decision points:**
- Which jobs to review first
- Which jobs match expertise/tools
- Which jobs are worth the drive

**System guidance:**
- None on this screen
- Jobs sorted by proximity (factual)
- No "recommended" labels

**Actions:**
- Tap job card → Job Detail screen
- Pull down → Refresh list

---

### 2. Job Detail (`app/(mechanic)/job-detail/[id].tsx`)

**Header:** "Job Details"  
**Back behavior:** Back to Jobs List

**What mechanics see:**

**Job Summary Card:**
- Large symptom icon (48px)
- Symptom label + vehicle
- Distance: 2.3 mi • Location type • Can move status
- Posted: 12 min ago

**Customer's Description Card:**
- Symptom selected
- Q&A pairs from intake flow
- Context: Can move, location, mileage

**System Notes Card (collapsible, dismissible):**
- Header: "💡 System Notes" with close button
- Subtext: "Guidance only - use your professional judgment"
- Safety level: Low/Medium/High (color-coded dot)
- Common causes: Battery, Starter, Alternator, Connections
- Typical diagnostic time: 30-45 min
- Note: "Clicking + dim lights suggests electrical issue"

**Key decision points:**
- Is this within my expertise?
- Do I have the right tools?
- Can I quote remotely or need inspection?
- Is customer description reliable?

**System guidance (non-binding language):**
- "Common causes" (not "diagnosis")
- "Typical time" (not "required time")
- "Suggests" (not "indicates")
- Safety level is factual without alarm
- All guidance collapsible and dismissible

**Actions:**
- **"Send Quote"** (primary button) → Quote Composer
- **"Pass"** (secondary) → Back to Jobs List

---

### 3. Quote Composer (`app/(mechanic)/quote-composer/[id].tsx`)

**Header:** "Compose Quote"  
**Back behavior:** Back to Job Detail (preserves draft)

**What mechanics see:**

**Job Summary Bar (collapsible):**
- Small icon + "2018 Honda Accord • Won't start"
- Tap to expand/collapse

**Quote Type Selection (4 equal-weight cards):**

1. **🔍 Diagnostic Only**
   - "I'll inspect and diagnose, then quote the repair"
   
2. **📊 Range Quote**
   - "Likely repair with price range based on possible causes"
   
3. **✓ Fixed Price**
   - "I'm confident in the diagnosis and can quote a fixed price"
   
4. **👁 Inspection Required**
   - "I need to see the vehicle before quoting"

**Pricing (changes based on type):**
- Diagnostic/Fixed: Single price field
- Inspection: Single price field (optional)
- Range: Two fields (Low - High)
- Large, clear number inputs
- No suggested prices

**Time Estimate (optional):**
- Arrival date: Text input ("Today")
- Arrival time: Text input ("2:30 PM")
- Duration: Text input ("45 min")

**Message to Customer (optional, 300 char):**
- Text area
- Placeholder: "Brief note about your approach..."
- Character counter: 0/300
- No templates

**System Guidance Panel (collapsible, dismissible):**
- Header: "💡 Quote Strategy Tips"
- Content changes based on selected quote type:
  - **Diagnostic:** "Protects both parties when diagnosis is unclear • Customer expects inspection, not repair • You can quote repair after diagnosing"
  - **Range:** "Works well when 2-3 causes are likely • Customer knows worst-case upfront • You can land anywhere in range"
  - **Fixed:** "Customer appreciates certainty • Shows confidence • Ensure you account for complications"
  - **Inspection:** "Shows you won't guess • Protects customer from unnecessary work • Builds trust through honesty"

**Key decision points:**
- Which quote type fits this job?
- What price is fair and profitable?
- How much detail to share?
- Am I confident enough for fixed pricing?

**System guidance (non-binding language):**
- "Works well when..." (not "use this when...")
- "Consider..." (not "you should...")
- Tips are suggestions, not requirements
- No "recommended" quote type
- No price validation or warnings

**Actions:**
- **"Review Quote"** (primary, enabled when price entered)
- Back button (preserves draft)

---

### 4. Quote Review (`app/(mechanic)/quote-review.tsx`)

**Header:** "Review Quote"  
**Back behavior:** Back to Quote Composer (edit mode)

**What mechanics see:**

**Your Quote Summary Card:**
- Vehicle: 2018 Honda Accord • Won't start
- Quote type: Diagnostic Only
- Price: $75 diagnostic fee
- Arrival: Today, 2:30 PM
- Duration: ~45 min
- Your note: "I'll test the battery, starter..."

**Customer Preview Card:**
- Header: "What the Customer Will See"
- Mock quote card:
  - Price + quote type
  - Arrival time
  - Your message
  - "NEW" badge

**Before You Send Checklist Card:**
- ✓ Price includes: [Contextual based on quote type]
- ✓ Customer expects: [What they'll receive]
- ✓ If job changes: [How updates work]
- ℹ️ Reminder: Customer can accept other quotes while you're en route

**Key decision points:**
- Is my quote clear?
- Did I set the right expectations?
- Is my pricing fair?

**System guidance:**
- Checklist is informational, not blocking
- Reminder about competition is factual
- No "are you sure?" prompts

**Actions:**
- **"Send Quote"** (primary, large)
- **"Edit Quote"** (secondary) → Back to Composer

---

### 5. Quote Sent/Status (`app/(mechanic)/quote-sent/[id].tsx`)

**Header:** "Quote Sent" or "Quote Accepted"  
**Back behavior:** None (header left button removed)

**What mechanics see (Pending):**

**Success Banner:**
- ✓ Quote sent to customer
- "You'll be notified if they accept your quote"

**Your Quote Card:**
- Vehicle + issue
- Quote type
- Price
- Arrival time
- Duration
- Status badge: PENDING

**What Happens Next Card:**
- • Customer is reviewing quotes now
- • You'll get a notification if accepted
- • Quote expires in 24 hours if no response

**What mechanics see (Accepted):**

**Success Banner:**
- ✓ Quote accepted!
- "The customer has accepted your quote. Contact them to coordinate arrival."

**Your Quote Card:**
- Same as pending

**Customer Card:**
- Name
- Phone number
- **"Call Customer"** button (opens phone dialer)

**Key decision points:**
- None (informational screen)

**System guidance:**
- None (just status updates)

**Actions:**
- **"Back to Jobs"** (primary) → Jobs List
- If accepted: **"Call Customer"** → Phone dialer

---

## Quote Strategy Logic

### When Diagnostic-Only is Safest

**Use when:**
- Customer description is vague or contradictory
- Multiple unrelated symptoms reported
- Issue requires inspection to narrow down causes
- Vehicle age/condition suggests hidden problems
- You're unfamiliar with the specific vehicle/issue

**Why it reduces risk:**
- No commitment to final price until you see the problem
- Customer expects inspection, not immediate repair
- Protects you from underquoting complex jobs
- Builds trust by being transparent about uncertainty

**Example phrasing:**
> "I'll start with a full diagnostic to pinpoint the exact issue. Once I identify the problem, I'll give you a clear quote for the repair. Diagnostic fee: $75."

---

### When Range Quote Reduces Risk

**Use when:**
- 2-3 likely causes with different price points
- Parts availability affects final cost
- Labor time depends on what you find
- Customer description points to specific area but exact part unclear

**Why it works:**
- Gives you flexibility without being vague
- Customer knows worst-case scenario upfront
- Reduces "bait and switch" perception
- You can land anywhere in the range without renegotiating

**Example phrasing:**
> "Based on your description, this is likely a battery or starter issue. Battery replacement runs $120-180, starter replacement $280-450. I'll confirm which one after testing."

---

### When Fixed Price Makes Sense

**Use when:**
- Customer description clearly points to one cause
- You've seen this exact issue many times
- Standard repair with predictable parts/labor
- Low risk of complications

**Why it works:**
- Customer appreciates certainty
- You look confident and professional
- Faster acceptance rate
- No surprises for either party

**Example phrasing:**
> "This sounds like a dead battery. I'll test it to confirm, then replace it on-site if needed. Total: $150 (includes battery and installation)."

---

### When Inspection Required is Appropriate

**Use when:**
- Safety concern requires in-person assessment
- Customer can't describe the problem clearly
- Issue is intermittent or hard to diagnose remotely
- You need to see the vehicle before committing to anything

**Why it's professional:**
- Shows you won't guess on important issues
- Protects customer from unnecessary work
- Protects you from bad quotes
- Builds trust through honesty

**Example phrasing:**
> "I need to inspect your vehicle in person before I can give you an accurate quote. I'll come take a look and then we can discuss the best solution. Inspection: $50 (waived if you proceed with the repair)."

---

## Database Schema

### Quotes Table

```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  mechanic_id UUID REFERENCES auth.users(id),
  
  quote_type TEXT CHECK (quote_type IN ('diagnostic_only', 'range', 'fixed', 'inspection_required')),
  
  price_cents INTEGER,
  price_low_cents INTEGER,
  price_high_cents INTEGER,
  
  arrival_time TEXT,
  estimated_duration_minutes INTEGER,
  message_to_customer TEXT,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  customer_response_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours')
);
```

**Key Features:**
- Supports 4 quote types with flexible pricing
- Tracks quote lifecycle (pending → accepted/declined/expired)
- Auto-expires after 24 hours
- RLS policies for mechanic and customer access

---

## File Structure

```
app/(mechanic)/
├── (tabs)/
│   └── leads.tsx                    # Jobs List (existing tab, updated)
├── job-detail/
│   └── [id].tsx                     # Job Detail (stack)
├── quote-composer/
│   └── [id].tsx                     # Quote Composer (stack)
├── quote-review.tsx                 # Quote Review (stack)
└── quote-sent/
    └── [id].tsx                     # Quote Sent/Status (stack)

supabase/migrations/
└── 20240102000000_create_quotes.sql
```

---

## Key UX Principles

### Respects Professional Judgment
✓ All guidance clearly labeled as "tips" or "notes"  
✓ No hidden scoring or ranking  
✓ No "recommended" quote types  
✓ No algorithmic price suggestions  
✓ Every field is editable  
✓ Can ignore all system guidance  
✓ Can pass on any job without penalty  

### Reduces Bad Quotes
✓ Contextual guidance based on symptoms  
✓ Risk factors highlighted (not warnings)  
✓ Quote type tips explain trade-offs  
✓ Preview shows customer expectations  
✓ Expectation checklist before sending  

### Saves Time
✓ Scannable job cards  
✓ One-tap filters  
✓ Auto-saves drafts  
✓ Quick quote type selection  
✓ Optional fields (no forced data entry)  
✓ Pull to refresh  

### Improves Trust
✓ Transparent about competition  
✓ Clear expectation setting  
✓ No pressure tactics  
✓ Honest about uncertainty  
✓ System never second-guesses  
✓ No "are you sure?" prompts  

---

## Testing Checklist

### Jobs List
- [ ] Jobs load and display correctly
- [ ] Filters work (all, nearby, quoted)
- [ ] Distance and time ago display correctly
- [ ] Pull to refresh updates list
- [ ] Empty state shows when no jobs
- [ ] Tap card navigates to job detail

### Job Detail
- [ ] Job info displays correctly
- [ ] System guidance shows/hides
- [ ] Safety indicators color-coded
- [ ] Send Quote navigates to composer
- [ ] Pass button returns to jobs list

### Quote Composer
- [ ] All 4 quote types selectable
- [ ] Price fields validate correctly
- [ ] Range quote shows two fields
- [ ] Inspection allows optional price
- [ ] Message character limit enforced
- [ ] Guidance panel dismissible
- [ ] Review button disabled until valid
- [ ] Draft auto-saves

### Quote Review
- [ ] Summary displays correctly
- [ ] Customer preview accurate
- [ ] Expectation checklist contextual
- [ ] Send creates quote in database
- [ ] Edit returns to composer
- [ ] Success navigates to quote sent

### Quote Sent/Status
- [ ] Pending state shows correctly
- [ ] Accepted state shows customer info
- [ ] Call button opens phone dialer
- [ ] Back to Jobs returns to list
- [ ] Status updates in real-time

---

## Notes

- All screens use theme colors and spacing
- System guidance is always optional and dismissible
- No forced workflows or required fields (except price for most types)
- Mechanics maintain full control at every step
- Trust is built through transparency, not gamification
- Professional judgment is respected, never replaced
- **NO NEW TABS** - Uses existing Jobs tab with stack navigation only
