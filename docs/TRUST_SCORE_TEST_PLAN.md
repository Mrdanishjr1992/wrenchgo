# Trust Score System - Manual Test Plan

## Overview
This document outlines the manual testing procedures for the trust score system implementation.

## Prerequisites
1. Apply migration: `20260127000010_trust_score_system_complete.sql`
2. Have test accounts for: customer, mechanic, admin

---

## Test Cases

### TC1: New User Starts at 50
**Steps:**
1. Create a new user account (customer or mechanic)
2. Navigate to their profile

**Expected:**
- Trust score displays "Established (50/100)"
- No trust_scores row exists initially (default 50 shown)

---

### TC2: First Completed Job Updates Score
**Steps:**
1. Customer creates a job
2. Mechanic submits quote
3. Customer accepts quote and pays
4. Mechanic marks departed → arrived → work started → work complete
5. Customer confirms completion
6. Check both profiles

**Expected:**
- Both customer and mechanic trust_scores rows created
- completion_score = 100 (1/1 = 100%)
- overall_score recalculated (should be ~50-55 depending on tenure)
- trust_score_history has entry with reason='job_completed'

---

### TC3: 5-Star Review Increases Rating Score
**Steps:**
1. Complete a job (TC2)
2. Customer submits 5-star review for mechanic
3. Wait for review to become visible (or have mechanic also review)
4. Check mechanic's profile

**Expected:**
- rating_score = 100 (5-star = (5-1)/4*100 = 100)
- overall_score increases
- trust_score_history has entry with reason='review_added' or 'review_visible'
- UI shows updated score (may need to refresh)

---

### TC4: Cancellation Decreases Reliability Score
**Steps:**
1. Customer creates a job
2. Mechanic submits quote
3. Customer accepts quote
4. Customer cancels the job
5. Check customer's profile

**Expected:**
- cancelled_jobs incremented
- reliability_score = 100 - 10 = 90
- overall_score decreases
- trust_score_history has entry with reason='job_cancelled'

---

### TC5: Dispute Affects Reliability Score
**Steps:**
1. Complete a job
2. File a dispute against the mechanic
3. Check mechanic's profile

**Expected:**
- disputed_jobs incremented
- reliability_score decreases by 15
- trust_score_history has entry with reason='dispute_opened'

---

### TC6: Badge Award Increases Badge Score
**Steps:**
1. Award a badge to a user (via admin or trigger)
2. Check user's profile

**Expected:**
- badge_score = badge_count * 10 (capped at 100)
- overall_score increases slightly
- trust_score_history has entry with reason='badge_awarded'

---

### TC7: Tenure Score Increases Over Time
**Steps:**
1. Check a user who has been registered for 30+ days
2. Manually trigger recalculation

**Expected:**
- tenure_score = floor(days/30) * 5 (capped at 100)
- For 30 days: tenure_score = 5
- For 60 days: tenure_score = 10

---

### TC8: UI Label Mapping
**Score Ranges:**
| Score | Label | Color |
|-------|-------|-------|
| 0-19 | New | #9CA3AF (gray) |
| 20-39 | Building | #F59E0B (amber) |
| 40-59 | Established | #3B82F6 (blue) |
| 60-79 | Trusted | #10B981 (green) |
| 80-100 | Elite | #8B5CF6 (purple) |

**Steps:**
1. Manually set trust_scores.overall_score to various values
2. View profile card

**Expected:**
- Correct label and color displayed for each range

---

### TC9: Admin Manual Recalculation
**Steps:**
1. Login as admin
2. Call `admin_recalculate_trust_score(user_id, 'admin_test')`
3. Check trust_score_history

**Expected:**
- Trust score recalculated
- History entry with reason='admin_test'
- audit_log entry (if table exists)

---

### TC10: Score Never Stuck at 50 After Activity
**Steps:**
1. Create user, complete job, submit review
2. Check profile multiple times

**Expected:**
- Score should NOT remain at 50 after any activity
- DB triggers fire automatically
- Cache invalidation ensures fresh data

---

## Verification Queries

```sql
-- Check trust_scores for a user
SELECT * FROM trust_scores WHERE user_id = '<user_id>';

-- Check history
SELECT * FROM trust_score_history 
WHERE user_id = '<user_id>' 
ORDER BY created_at DESC 
LIMIT 10;

-- Manually trigger recalculation
SELECT recalculate_trust_score('<user_id>', 'manual_test', NULL);

-- Check all triggers exist
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%trust%';
```

---

## Troubleshooting

### Score not updating?
1. Check if triggers exist: `SELECT * FROM pg_trigger WHERE tgname LIKE '%trust%';`
2. Check RLS policies allow trigger execution
3. Verify SECURITY DEFINER on functions
4. Check for errors in Supabase logs

### UI showing stale data?
1. Clear profile card cache: `clearProfileCardCache(userId)`
2. Force refresh: `getPublicProfileCard(userId, { forceRefresh: true })`
3. Check network tab for fresh API calls

### Permission denied errors?
1. Verify user is authenticated
2. Check if user is trying to recalc their own score
3. Admin functions require admin role
