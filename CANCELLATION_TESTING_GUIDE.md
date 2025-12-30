# 🧪 Customer Quote Cancellation - Testing Guide

## Pre-Testing Setup

### 1. Run Database Migrations
```bash
# In Supabase dashboard SQL editor or via CLI
# Run in order:
1. supabase/migrations/20240105000000_add_cancellation_fields.sql
2. supabase/migrations/20240106000000_create_cancel_quote_function.sql
3. supabase/migrations/20240107000000_update_cancellation_rls.sql
```

### 2. Verify Database Changes
```sql
-- Check quote_requests table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quote_requests' 
AND column_name IN ('canceled_at', 'canceled_by', 'cancel_reason', 'cancel_note', 'cancellation_fee_cents', 'accepted_at');

-- Check jobs table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('canceled_at', 'canceled_by');

-- Verify RPC function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'cancel_quote_by_customer';
```

### 3. Test Data Setup
Create test accounts:
- **Customer Account**: customer@test.com
- **Mechanic Account**: mechanic@test.com

Create test job flow:
1. Customer creates a job
2. Mechanic sends a quote
3. Customer accepts the quote

---

## Test Scenarios

### ✅ Scenario 1: Free Cancellation (< 5 minutes)

**Objective:** Verify customers can cancel within 5 minutes without fee

**Steps:**
1. Log in as customer
2. Accept a quote from mechanic
3. **Immediately** (within 5 minutes) navigate to job details
4. Tap "Cancel Job" button
5. Select any cancellation reason (e.g., "Found another mechanic")
6. Optionally add a note
7. Tap "Cancel Job" in modal

**Expected Results:**
- ✅ Warning message shows: "✅ Free cancellation (within 5 minutes of acceptance)"
- ✅ No fee amount displayed
- ✅ Cancellation succeeds
- ✅ Success alert shows: "Your job has been canceled. The mechanic has been notified."
- ✅ Navigates back to jobs list
- ✅ Job status = "canceled"
- ✅ Quote status = "canceled_by_customer"

**Database Verification:**
```sql
SELECT 
  j.id, j.status as job_status, j.canceled_at, j.canceled_by,
  qr.status as quote_status, qr.cancel_reason, qr.cancellation_fee_cents
FROM jobs j
JOIN quote_requests qr ON qr.job_id = j.id
WHERE j.id = 'YOUR_JOB_ID';

-- Expected:
-- job_status: 'canceled'
-- canceled_by: 'customer'
-- quote_status: 'canceled_by_customer'
-- cancellation_fee_cents: 0 or NULL
```

---

### ⚠️ Scenario 2: Cancellation with Fee (> 5 minutes, < arrival time)

**Objective:** Verify fee is applied after free cancellation window

**Steps:**
1. Log in as customer
2. Accept a quote from mechanic
3. **Wait 6+ minutes** (or manually update `accepted_at` in database to simulate)
4. Navigate to job details
5. Tap "Cancel Job" button
6. Select cancellation reason
7. Review warning message

**Expected Results:**
- ⚠️ Warning message shows: "⚠️ Cancellation fee: $15 (close to scheduled time)"
- ⚠️ Fee amount: $15.00
- ✅ Cancellation succeeds after confirmation
- ✅ Success alert shows: "Your job has been canceled. A $15.00 cancellation fee will be charged."

**Database Verification:**
```sql
SELECT cancellation_fee_cents FROM quote_requests WHERE id = 'YOUR_QUOTE_ID';
-- Expected: 1500 (cents)
```

---

### 🚫 Scenario 3: Cancellation with Higher Fee (Job In Progress)

**Objective:** Verify higher fee when mechanic has started work

**Steps:**
1. Log in as customer, accept a quote
2. Log in as mechanic
3. Navigate to job details
4. Tap "Start Job" button (status → "in_progress")
5. Log back in as customer
6. Navigate to job details
7. Tap "Cancel Job" button
8. Select cancellation reason

**Expected Results:**
- 🚫 Warning message shows: "⚠️ Cancellation fee: $25 (mechanic has started work)"
- 🚫 Fee amount: $25.00
- ✅ Cancellation succeeds after confirmation
- ✅ Success alert shows: "Your job has been canceled. A $25.00 cancellation fee will be charged."

**Database Verification:**
```sql
SELECT cancellation_fee_cents FROM quote_requests WHERE id = 'YOUR_QUOTE_ID';
-- Expected: 2500 (cents)
```

---

### ❌ Scenario 4: Cancellation Blocked (Completed Job)

**Objective:** Verify customers cannot cancel completed jobs

**Steps:**
1. Complete a job (mechanic marks as "completed")
2. Log in as customer
3. Navigate to job details
4. Look for "Cancel Job" button

**Expected Results:**
- ❌ "Cancel Job" button is **NOT visible**
- ✅ Job details show "COMPLETED" status
- ✅ No cancellation option available

**Alternative Test:**
Try to call RPC function directly:
```sql
SELECT cancel_quote_by_customer(
  'COMPLETED_QUOTE_ID'::uuid,
  'found_other_mechanic',
  NULL
);

-- Expected result:
-- {"success": false, "error": "Cannot cancel a completed job"}
```

---

### 🔒 Scenario 5: Reason Validation

**Objective:** Verify cancellation reason is required

**Steps:**
1. Open cancellation modal
2. **Do NOT select a reason**
3. Tap "Cancel Job" button

**Expected Results:**
- ❌ Alert shows: "Reason Required - Please select a cancellation reason."
- ❌ Cancellation does not proceed
- ✅ Modal remains open

**Steps (Part 2):**
1. Select "Other reason"
2. **Do NOT enter a note**
3. Tap "Cancel Job" button

**Expected Results:**
- ❌ Alert shows: "Details Required - Please provide details for your cancellation reason."
- ❌ Cancellation does not proceed

**Steps (Part 3):**
1. Select "Other reason"
2. Enter a note: "Testing cancellation"
3. Tap "Cancel Job" button

**Expected Results:**
- ✅ Cancellation proceeds
- ✅ Note is saved in database

---

### 🔄 Scenario 6: Realtime Updates (Mechanic Side)

**Objective:** Verify mechanic sees cancellation immediately

**Setup:**
- Two devices or browser windows
- Device 1: Customer logged in, viewing job details
- Device 2: Mechanic logged in, viewing same job details

**Steps:**
1. On Device 1 (Customer): Cancel the job
2. On Device 2 (Mechanic): **Do NOT refresh** - wait for realtime update

**Expected Results:**
- ✅ Within 1-2 seconds, mechanic screen updates automatically
- ✅ Cancellation card appears showing:
  - "❌ CANCELED BY CUSTOMER" badge
  - Cancellation reason
  - Customer note (if provided)
  - Cancellation fee (if applicable)
- ✅ Action buttons become disabled:
  - "Start Job" button disabled
  - "Complete Job" button disabled
  - "Open Chat" button disabled (or shows "Chat Locked")
- ✅ Status pill shows "CANCELED" in red

---

### 🔄 Scenario 7: Realtime Updates (Customer Side)

**Objective:** Verify customer sees their own cancellation reflected

**Steps:**
1. Customer cancels job
2. Navigate away (to jobs list)
3. Navigate back to job details

**Expected Results:**
- ✅ Job status shows "CANCELED"
- ✅ Cancellation info card is visible
- ✅ "Cancel Job" button is **NOT visible**
- ✅ Cancellation details are displayed:
  - Canceled on: [timestamp]
  - Reason: [formatted reason]
  - Note: [if provided]
  - Cancellation Fee: [if applicable]

---

### 🚫 Scenario 8: Security - Unauthorized Cancellation

**Objective:** Verify users cannot cancel other users' jobs

**Steps:**
1. Create a job as Customer A
2. Accept a quote
3. Log in as Customer B (different account)
4. Try to call RPC function with Customer A's quote ID:

```sql
-- As Customer B
SELECT cancel_quote_by_customer(
  'CUSTOMER_A_QUOTE_ID'::uuid,
  'found_other_mechanic',
  NULL
);
```

**Expected Results:**
- ❌ Error: "You can only cancel your own quotes"
- ❌ No changes to database
- ✅ RLS policies prevent unauthorized access

---

### 🔄 Scenario 9: Double Cancellation Prevention

**Objective:** Verify cannot cancel already-canceled job

**Steps:**
1. Cancel a job successfully
2. Try to cancel the same job again (via RPC or UI)

**Expected Results:**
- ❌ Error: "This job is already canceled"
- ❌ No duplicate cancellation records
- ✅ UI does not show "Cancel Job" button for canceled jobs

---

### 📱 Scenario 10: Navigation Flow

**Objective:** Verify smooth navigation after cancellation

**Steps:**
1. Customer cancels job from job details screen
2. Observe navigation behavior

**Expected Results:**
- ✅ Success alert appears
- ✅ Automatically navigates to jobs list
- ✅ Canceled job appears in list with "CANCELED" status
- ✅ No stuck screens or navigation errors
- ✅ Back button works correctly

---

### 🎨 Scenario 11: UI/UX Polish

**Objective:** Verify professional, calm UI

**Checks:**
- ✅ Modal has smooth slide-up animation
- ✅ Reason options have clear icons
- ✅ Selected reason is highlighted with accent color
- ✅ Warning colors are appropriate:
  - Blue for info (free cancellation)
  - Yellow for warning ($15 fee)
  - Red for error ($25 fee)
- ✅ Text is clear and non-punitive
- ✅ Loading states show spinner
- ✅ Buttons are disabled during loading
- ✅ No technical jargon or error codes shown to user

---

## Edge Cases

### Edge Case 1: Network Failure During Cancellation

**Test:**
1. Start cancellation process
2. Turn off network/airplane mode before RPC completes
3. Observe behavior

**Expected:**
- ❌ Error alert: "Cancellation Failed - Unable to cancel quote. Please try again."
- ✅ No partial updates (transaction rollback)
- ✅ Job remains in original state
- ✅ User can retry

---

### Edge Case 2: Concurrent Cancellation Attempts

**Test:**
1. Open job details on two devices (same customer account)
2. Tap "Cancel Job" on both devices simultaneously

**Expected:**
- ✅ First cancellation succeeds
- ❌ Second cancellation fails with: "This job is already canceled"
- ✅ No duplicate cancellation records

---

### Edge Case 3: Quote Deleted Before Cancellation

**Test:**
1. Manually delete quote from database
2. Try to cancel via UI

**Expected:**
- ❌ Error: "Quote not found"
- ✅ Graceful error handling
- ✅ User is informed to refresh

---

### Edge Case 4: Mechanic Cancels While Customer Canceling

**Test:**
1. Customer opens cancellation modal
2. Mechanic withdraws quote (if mechanic cancellation is implemented)
3. Customer submits cancellation

**Expected:**
- ❌ Error: "Quote not found" or "Quote is no longer available"
- ✅ Graceful error handling

---

### Edge Case 5: Very Long Cancellation Note

**Test:**
1. Enter a very long note (1000+ characters)
2. Submit cancellation

**Expected:**
- ✅ Note is saved (or truncated if there's a limit)
- ✅ No UI overflow or crashes
- ✅ Note displays correctly in mechanic view

---

## Performance Tests

### Test 1: Realtime Latency

**Measure:**
- Time from customer cancellation to mechanic screen update

**Target:**
- < 2 seconds for realtime update

**How to Test:**
1. Use two devices with synchronized clocks
2. Record timestamp when customer taps "Cancel Job"
3. Record timestamp when mechanic screen updates
4. Calculate difference

---

### Test 2: RPC Function Performance

**Measure:**
- Time for RPC function to complete

**Target:**
- < 500ms for cancellation

**How to Test:**
```sql
EXPLAIN ANALYZE
SELECT cancel_quote_by_customer(
  'QUOTE_ID'::uuid,
  'found_other_mechanic',
  'Test note'
);
```

---

## Regression Tests

### Test 1: Existing Job Flow Unaffected

**Verify:**
- ✅ Creating jobs still works
- ✅ Sending quotes still works
- ✅ Accepting quotes still works
- ✅ Completing jobs still works
- ✅ Chat functionality still works

---

### Test 2: Non-Canceled Jobs Unaffected

**Verify:**
- ✅ Jobs without cancellation show normal UI
- ✅ No cancellation fields visible for active jobs
- ✅ Action buttons work normally

---

## Accessibility Tests

### Test 1: Screen Reader Support

**Verify:**
- ✅ "Cancel Job" button is announced
- ✅ Reason options are announced
- ✅ Warning messages are announced
- ✅ Success/error alerts are announced

---

### Test 2: Color Contrast

**Verify:**
- ✅ Warning text has sufficient contrast
- ✅ Button text is readable
- ✅ Status pills are readable

---

## Platform-Specific Tests

### iOS Tests
- ✅ Modal slide animation is smooth
- ✅ Keyboard dismisses correctly
- ✅ Safe area insets are respected
- ✅ Haptic feedback on button press (if implemented)

### Android Tests
- ✅ Back button closes modal
- ✅ Keyboard behavior is correct
- ✅ Material Design animations work
- ✅ No layout overflow issues

---

## Monitoring & Analytics

### Metrics to Track

1. **Cancellation Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'canceled') * 100.0 / COUNT(*) as cancellation_rate
   FROM jobs
   WHERE created_at > NOW() - INTERVAL '30 days';
   ```

2. **Cancellation Reasons**
   ```sql
   SELECT 
     cancel_reason, 
     COUNT(*) as count,
     AVG(cancellation_fee_cents) as avg_fee
   FROM quote_requests
   WHERE canceled_by = 'customer'
   GROUP BY cancel_reason
   ORDER BY count DESC;
   ```

3. **Fee Distribution**
   ```sql
   SELECT 
     CASE 
       WHEN cancellation_fee_cents = 0 THEN 'Free'
       WHEN cancellation_fee_cents = 1500 THEN '$15 Fee'
       WHEN cancellation_fee_cents = 2500 THEN '$25 Fee'
       ELSE 'Other'
     END as fee_tier,
     COUNT(*) as count
   FROM quote_requests
   WHERE canceled_by = 'customer'
   GROUP BY fee_tier;
   ```

4. **Time to Cancellation**
   ```sql
   SELECT 
     AVG(EXTRACT(EPOCH FROM (canceled_at - accepted_at)) / 60) as avg_minutes_to_cancel
   FROM quote_requests
   WHERE canceled_by = 'customer' AND accepted_at IS NOT NULL;
   ```

---

## Troubleshooting Guide

### Issue: "Not authenticated" error

**Cause:** User session expired

**Solution:**
1. Check if user is logged in
2. Refresh auth token
3. Prompt user to log in again

---

### Issue: "Quote not found" error

**Cause:** Quote was deleted or doesn't exist

**Solution:**
1. Refresh job data
2. Check if quote still exists in database
3. Show user-friendly message

---

### Issue: Cancellation fee seems incorrect

**Cause:** `accepted_at` timestamp is wrong or missing

**Solution:**
1. Check `accepted_at` value in database
2. Verify time calculation logic
3. Manually update `accepted_at` if needed

---

### Issue: Mechanic doesn't see cancellation

**Cause:** Realtime subscription not working

**Solution:**
1. Check Supabase realtime is enabled
2. Verify channel subscription is active
3. Check RLS policies allow mechanic to read cancellation
4. Manually refresh mechanic screen

---

### Issue: Cannot cancel job (button not visible)

**Cause:** Job is in non-cancelable state

**Solution:**
1. Check job status (completed/canceled jobs cannot be canceled)
2. Verify quote is accepted
3. Check if user is the job owner

---

## Sign-Off Checklist

Before deploying to production:

- [ ] All 11 test scenarios pass
- [ ] All 5 edge cases handled
- [ ] Performance targets met (< 2s realtime, < 500ms RPC)
- [ ] Regression tests pass
- [ ] Accessibility tests pass
- [ ] iOS and Android tests pass
- [ ] Database migrations run successfully
- [ ] RLS policies verified
- [ ] Monitoring/analytics set up
- [ ] Documentation complete
- [ ] Code review completed
- [ ] QA sign-off obtained
- [ ] Product owner approval

---

## Post-Deployment Monitoring

### Week 1:
- Monitor cancellation rate daily
- Check for error spikes
- Review user feedback
- Verify realtime updates working

### Week 2-4:
- Analyze cancellation reasons
- Review fee distribution
- Identify patterns
- Optimize based on data

### Ongoing:
- Monthly cancellation rate review
- Quarterly fee structure review
- User satisfaction surveys
- Mechanic feedback collection

---

## Success Criteria

✅ **Functional:**
- Customers can cancel accepted quotes
- Time-protection rules work correctly
- Mechanics see cancellations immediately
- No data inconsistencies

✅ **Performance:**
- < 2 seconds realtime update
- < 500ms RPC execution
- No UI lag or freezing

✅ **User Experience:**
- Clear, professional UI
- Non-punitive messaging
- Smooth navigation
- No confusion or errors

✅ **Business:**
- Cancellation rate < 15%
- Fee collection working
- Mechanic satisfaction maintained
- Customer satisfaction maintained
