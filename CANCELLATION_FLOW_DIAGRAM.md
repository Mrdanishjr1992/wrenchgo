# 📊 Customer Quote Cancellation - Flow Diagram

## 🔄 Complete Cancellation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER CANCELLATION FLOW                       │
└─────────────────────────────────────────────────────────────────────────┘

1. CUSTOMER ACCEPTS QUOTE
   ↓
   [Quote Status: accepted]
   [Job Status: accepted]
   [accepted_at: NOW()]
   ↓

2. CUSTOMER NAVIGATES TO JOB DETAILS
   ↓
   [Sees "Cancel Job" button]
   ↓

3. CUSTOMER TAPS "Cancel Job"
   ↓
   [CancelQuoteModal opens]
   ↓

4. CUSTOMER SELECTS REASON
   ├─→ Found another mechanic
   ├─→ Issue resolved
   ├─→ Wrong vehicle
   ├─→ Too expensive
   ├─→ Schedule conflict
   └─→ Other (requires note)
   ↓

5. SYSTEM CALCULATES FEE
   ├─→ < 5 min since acceptance? → $0 (Free)
   ├─→ Job in_progress? → $25 (Work started)
   └─→ > 5 min? → $15 (Standard fee)
   ↓

6. CUSTOMER CONFIRMS CANCELLATION
   ↓
   [Calls RPC: cancel_quote_by_customer()]
   ↓

7. DATABASE UPDATES (ATOMIC TRANSACTION)
   ├─→ quote_requests.status = 'canceled_by_customer'
   ├─→ quote_requests.canceled_at = NOW()
   ├─→ quote_requests.canceled_by = 'customer'
   ├─→ quote_requests.cancel_reason = [selected reason]
   ├─→ quote_requests.cancel_note = [optional note]
   ├─→ quote_requests.cancellation_fee_cents = [calculated fee]
   ├─→ jobs.status = 'canceled'
   ├─→ jobs.canceled_at = NOW()
   └─→ jobs.canceled_by = 'customer'
   ↓

8. REALTIME BROADCAST
   ├─→ Customer screen updates (shows cancellation card)
   └─→ Mechanic screen updates (shows cancellation card)
   ↓

9. CUSTOMER NAVIGATES BACK
   ↓
   [Jobs list shows "CANCELED" status]
   ↓

10. MECHANIC SEES CANCELLATION
    ├─→ Cancellation card appears
    ├─→ Action buttons disabled
    ├─→ Reason/note displayed
    └─→ Fee info shown (if applicable)
```

---

## 🎯 Decision Tree: Fee Calculation

```
                    Customer Cancels Quote
                            ↓
                ┌───────────┴───────────┐
                │                       │
        Time since acceptance?          │
                │                       │
        ┌───────┴───────┐               │
        │               │               │
    < 5 min         > 5 min             │
        │               │               │
        ↓               ↓               │
    FREE ($0)    Check job status      │
                        │               │
                ┌───────┴───────┐       │
                │               │       │
        in_progress?        Other       │
                │               │       │
                ↓               ↓       │
            $25 FEE         $15 FEE     │
                │               │       │
                └───────┬───────┘       │
                        ↓               │
                Apply fee & cancel      │
                        │               │
                        └───────────────┘
                                ↓
                        Update database
```

---

## 🔐 Security Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SECURITY & VALIDATION                            │
└─────────────────────────────────────────────────────────────────────────┘

1. CUSTOMER CALLS RPC FUNCTION
   ↓
   [cancel_quote_by_customer(quote_id, reason, note)]
   ↓

2. AUTHENTICATION CHECK
   ├─→ Is user authenticated? → NO → ❌ Error: "Not authenticated"
   └─→ YES → Continue
   ↓

3. REASON VALIDATION
   ├─→ Is reason provided? → NO → ❌ Error: "Reason required"
   ├─→ Is reason valid? → NO → ❌ Error: "Invalid reason"
   ├─→ Is reason "other"? → YES → Check note
   │   ├─→ Note provided? → NO → ❌ Error: "Note required"
   │   └─→ YES → Continue
   └─→ Continue
   ↓

4. QUOTE OWNERSHIP CHECK
   ├─→ Does quote exist? → NO → ❌ Error: "Quote not found"
   ├─→ Is user the job owner? → NO → ❌ Error: "Not your quote"
   └─→ YES → Continue
   ↓

5. STATUS VALIDATION
   ├─→ Is quote already canceled? → YES → ❌ Error: "Already canceled"
   ├─→ Is job completed? → YES → ❌ Error: "Cannot cancel completed"
   └─→ NO → Continue
   ↓

6. CALCULATE FEE (Time-Protection Rules)
   ↓

7. ATOMIC TRANSACTION
   ├─→ Update quote_requests
   ├─→ Update jobs
   ├─→ Commit transaction
   └─→ ✅ Success
   ↓

8. RETURN RESULT
   └─→ {success: true, fee_cents: X, message: "..."}
```

---

## 📱 UI State Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER UI STATES                               │
└─────────────────────────────────────────────────────────────────────────┘

STATE 1: JOB ACCEPTED (Cancelable)
┌────────────────────────────────────┐
│ Job Details                        │
│ ─────────────────────────────────  │
│ Status: ✅ ACCEPTED                │
│                                    │
│ Assigned Mechanic                  │
│ Name: John Doe                     │
│ Phone: (555) 123-4567              │
│                                    │
│ [Message Mechanic]                 │
│ [Cancel Job] ← VISIBLE             │
└────────────────────────────────────┘

STATE 2: CANCELLATION MODAL OPEN
┌────────────────────────────────────┐
│ Cancel Job                         │
│ ─────────────────────────────────  │
│ Select a reason:                   │
│                                    │
│ ○ Found another mechanic           │
│ ○ Issue resolved                   │
│ ○ Wrong vehicle                    │
│ ○ Too expensive                    │
│ ○ Schedule conflict                │
│ ○ Other reason                     │
│                                    │
│ Additional notes (optional):       │
│ [Text input]                       │
│                                    │
│ ⚠️ Cancellation fee: $15           │
│                                    │
│ [Cancel Job]                       │
└────────────────────────────────────┘

STATE 3: JOB CANCELED (Not Cancelable)
┌────────────────────────────────────┐
│ Job Details                        │
│ ─────────────────────────────────  │
│ Status: ❌ CANCELED                │
│                                    │
│ Cancellation                       │
│ ❌ JOB CANCELED                    │
│                                    │
│ Canceled on: Jan 5, 2024 3:45 PM  │
│ Reason: Found another mechanic     │
│ Note: Found cheaper option nearby  │
│ Cancellation Fee: $15.00           │
│                                    │
│ [Cancel Job] ← NOT VISIBLE         │
└────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MECHANIC UI STATES                               │
└─────────────────────────────────────────────────────────────────────────┘

STATE 1: JOB ACTIVE (Before Cancellation)
┌────────────────────────────────────┐
│ Job Details                        │
│ ─────────────────────────────────  │
│ Status: ✅ ASSIGNED                │
│                                    │
│ Customer                           │
│ Name: Jane Smith                   │
│ Phone: (555) 987-6543              │
│                                    │
│ Actions                            │
│ [Open Chat 💬]                     │
│ [Start Job] [Complete Job]         │
└────────────────────────────────────┘

STATE 2: JOB CANCELED (After Cancellation)
┌────────────────────────────────────┐
│ Job Details                        │
│ ─────────────────────────────────  │
│ Status: ❌ CANCELED                │
│                                    │
│ Job Canceled 🚫                    │
│ ❌ CANCELED BY CUSTOMER            │
│                                    │
│ Canceled on: Jan 5, 2024 3:45 PM  │
│ Reason: Found Another Mechanic     │
│ Customer Note: Found cheaper opt.  │
│ Cancellation Fee: $15.00           │
│                                    │
│ ℹ️ This fee compensates your time  │
│                                    │
│ Actions                            │
│ [Open Chat 💬] ← DISABLED          │
│ [Start Job] ← DISABLED             │
│ [Complete Job] ← DISABLED          │
└────────────────────────────────────┘
```

---

## ⚡ Realtime Update Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         REALTIME SYNCHRONIZATION                         │
└─────────────────────────────────────────────────────────────────────────┘

CUSTOMER DEVICE                    SUPABASE                    MECHANIC DEVICE
     │                                │                                │
     │ 1. Tap "Cancel Job"            │                                │
     ├───────────────────────────────→│                                │
     │                                │                                │
     │ 2. RPC: cancel_quote_by_customer()                             │
     │                                │                                │
     │                         3. Update DB                            │
     │                         ├─ quote_requests                       │
     │                         └─ jobs                                 │
     │                                │                                │
     │                         4. Broadcast Change                     │
     │                         ├─────────────────────────────────────→│
     │                         │                                       │
     │ 5. Receive Update              │        6. Receive Update      │
     │←───────────────────────────────┤                               │
     │                                │                               │
     │ 7. Reload Data                 │        8. Reload Data         │
     │ - Fetch updated job            │        - Fetch updated job    │
     │ - Fetch updated quote          │        - Fetch updated quote  │
     │                                │                               │
     │ 9. Update UI                   │        10. Update UI          │
     │ - Show cancellation card       │        - Show cancellation    │
     │ - Hide cancel button           │        - Disable actions      │
     │ - Navigate back                │        - Show fee info        │
     │                                │                               │
     │                         ⏱️ Total Time: < 2 seconds              │
```

---

## 🗄️ Database Schema Changes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BEFORE MIGRATION                                 │
└─────────────────────────────────────────────────────────────────────────┘

quote_requests
├─ id (uuid)
├─ job_id (uuid)
├─ mechanic_id (uuid)
├─ status (enum: pending, quoted, accepted, rejected)
├─ proposed_price_cents (integer)
├─ proposed_time_text (text)
├─ note (text)
└─ created_at (timestamptz)

jobs
├─ id (uuid)
├─ customer_id (uuid)
├─ title (text)
├─ description (text)
├─ status (enum: searching, quoted, accepted, in_progress, completed)
├─ accepted_mechanic_id (uuid)
└─ created_at (timestamptz)

┌─────────────────────────────────────────────────────────────────────────┐
│                         AFTER MIGRATION                                  │
└─────────────────────────────────────────────────────────────────────────┘

quote_requests
├─ id (uuid)
├─ job_id (uuid)
├─ mechanic_id (uuid)
├─ status (enum: pending, quoted, accepted, rejected, 
│           canceled_by_customer, canceled_by_mechanic) ← UPDATED
├─ proposed_price_cents (integer)
├─ proposed_time_text (text)
├─ note (text)
├─ created_at (timestamptz)
├─ accepted_at (timestamptz) ← NEW
├─ canceled_at (timestamptz) ← NEW
├─ canceled_by (text) ← NEW
├─ cancel_reason (text) ← NEW
├─ cancel_note (text) ← NEW
└─ cancellation_fee_cents (integer) ← NEW

jobs
├─ id (uuid)
├─ customer_id (uuid)
├─ title (text)
├─ description (text)
├─ status (enum: searching, quoted, accepted, in_progress, 
│           completed, canceled) ← UPDATED
├─ accepted_mechanic_id (uuid)
├─ created_at (timestamptz)
├─ canceled_at (timestamptz) ← NEW
└─ canceled_by (text) ← NEW

NEW RPC FUNCTION
└─ cancel_quote_by_customer(quote_id, reason, note)
   ├─ Validates authentication
   ├─ Validates reason
   ├─ Checks ownership
   ├─ Calculates fee
   ├─ Updates quote_requests
   ├─ Updates jobs
   └─ Returns result
```

---

## 📊 Fee Calculation Logic

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FEE CALCULATION ALGORITHM                        │
└─────────────────────────────────────────────────────────────────────────┘

INPUTS:
- accepted_at: Timestamp when quote was accepted
- current_time: NOW()
- job_status: Current status of the job

CALCULATION:
1. minutes_since_acceptance = (current_time - accepted_at) / 60

2. IF minutes_since_acceptance <= 5:
      fee = $0 (Free cancellation window)
   
3. ELSE IF job_status == 'in_progress':
      fee = $25 (Mechanic has started work)
   
4. ELSE IF minutes_since_acceptance > 5:
      fee = $15 (Standard cancellation fee)
   
5. ELSE:
      fee = $0 (Default: no fee)

OUTPUT:
- cancellation_fee_cents: Fee in cents (0, 1500, or 2500)

EXAMPLES:
┌──────────────────────┬─────────────┬────────────┬──────┐
│ Time Since Accept    │ Job Status  │ Condition  │ Fee  │
├──────────────────────┼─────────────┼────────────┼──────┤
│ 2 minutes            │ accepted    │ < 5 min    │ $0   │
│ 10 minutes           │ accepted    │ > 5 min    │ $15  │
│ 30 minutes           │ in_progress │ Working    │ $25  │
│ 1 hour               │ accepted    │ > 5 min    │ $15  │
│ N/A                  │ completed   │ Blocked    │ N/A  │
└──────────────────────┴─────────────┴────────────┴──────┘
```

---

## 🎨 Color Coding System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         UI COLOR SCHEME                                  │
└─────────────────────────────────────────────────────────────────────────┘

STATUS COLORS:
├─ Accepted: #10b981 (Green)
├─ In Progress: #3B82F6 (Blue)
├─ Completed: #10b981 (Green)
├─ Searching: #6B7280 (Gray)
└─ Canceled: #EF4444 (Red)

WARNING COLORS:
├─ Free Cancellation: #3B82F6 (Blue - Info)
├─ Standard Fee ($15): #F59E0B (Yellow - Warning)
└─ High Fee ($25): #EF4444 (Red - Error)

BUTTON COLORS:
├─ Primary Action: colors.accent (Theme accent)
├─ Cancel Action: #EF4444 (Red)
└─ Disabled: colors.textMuted with opacity

BACKGROUND COLORS:
├─ Success: #D1FAE5 (Light green)
├─ Warning: #FEF3C7 (Light yellow)
├─ Error: #FEE2E2 (Light red)
└─ Info: #DBEAFE (Light blue)
```

---

## 📈 Monitoring Dashboard Queries

```sql
-- 1. CANCELLATION RATE (Last 30 Days)
SELECT 
  COUNT(*) FILTER (WHERE status = 'canceled') * 100.0 / COUNT(*) as rate,
  COUNT(*) FILTER (WHERE status = 'canceled') as canceled_count,
  COUNT(*) as total_jobs
FROM jobs
WHERE created_at > NOW() - INTERVAL '30 days';

-- 2. CANCELLATION REASONS BREAKDOWN
SELECT 
  cancel_reason,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM quote_requests
WHERE canceled_by = 'customer'
GROUP BY cancel_reason
ORDER BY count DESC;

-- 3. FEE DISTRIBUTION
SELECT 
  CASE 
    WHEN cancellation_fee_cents = 0 THEN 'Free ($0)'
    WHEN cancellation_fee_cents = 1500 THEN 'Standard ($15)'
    WHEN cancellation_fee_cents = 2500 THEN 'High ($25)'
    ELSE 'Other'
  END as fee_tier,
  COUNT(*) as count,
  SUM(cancellation_fee_cents) / 100.0 as total_fees
FROM quote_requests
WHERE canceled_by = 'customer'
GROUP BY fee_tier
ORDER BY count DESC;

-- 4. AVERAGE TIME TO CANCELLATION
SELECT 
  AVG(EXTRACT(EPOCH FROM (canceled_at - accepted_at)) / 60) as avg_minutes,
  MIN(EXTRACT(EPOCH FROM (canceled_at - accepted_at)) / 60) as min_minutes,
  MAX(EXTRACT(EPOCH FROM (canceled_at - accepted_at)) / 60) as max_minutes
FROM quote_requests
WHERE canceled_by = 'customer' AND accepted_at IS NOT NULL;

-- 5. CANCELLATIONS BY TIME OF DAY
SELECT 
  EXTRACT(HOUR FROM canceled_at) as hour,
  COUNT(*) as count
FROM quote_requests
WHERE canceled_by = 'customer'
GROUP BY hour
ORDER BY hour;
```

---

## 🔍 Debug Queries

```sql
-- Check specific job cancellation status
SELECT 
  j.id as job_id,
  j.status as job_status,
  j.canceled_at as job_canceled_at,
  j.canceled_by as job_canceled_by,
  qr.id as quote_id,
  qr.status as quote_status,
  qr.accepted_at,
  qr.canceled_at as quote_canceled_at,
  qr.cancel_reason,
  qr.cancellation_fee_cents
FROM jobs j
LEFT JOIN quote_requests qr ON qr.job_id = j.id
WHERE j.id = 'YOUR_JOB_ID';

-- Test RPC function
SELECT cancel_quote_by_customer(
  'QUOTE_ID'::uuid,
  'found_other_mechanic',
  'Testing cancellation'
);

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename IN ('jobs', 'quote_requests')
AND policyname LIKE '%cancel%';
```

This visual guide should help you understand the complete flow! 🎯
