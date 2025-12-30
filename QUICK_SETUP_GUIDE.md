# 🚀 Quick Setup Guide - Customer Quote Cancellation

## ⚠️ IMPORTANT: Run Database Migrations First!

The error `column quote_requests.accepted_at does not exist` means the database migrations haven't been run yet.

---

## Step 1: Run Database Migrations

### Option A: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste Migration Script**
   - Open the file: `supabase/migrations/RUN_ALL_CANCELLATION_MIGRATIONS.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Script**
   - Click "Run" button (or press Ctrl+Enter / Cmd+Enter)
   - Wait for completion (should take 2-5 seconds)

5. **Verify Success**
   - Check the output panel for success messages
   - You should see:
     ```
     ✓ accepted_at column exists
     ✓ canceled_at column exists
     ✓ cancel_quote_by_customer function exists
     Migration complete!
     ```

### Option B: Using Supabase CLI (If Installed)

```bash
# Navigate to project root
cd /c:/Users/Mohamed\ Abdulah/Desktop/wrenchgo

# Run migrations
supabase db push

# Or run individual migrations
supabase migration up
```

---

## Step 2: Verify Database Changes

Run this query in Supabase SQL Editor to verify:

```sql
-- Check quote_requests columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quote_requests' 
AND column_name IN (
  'accepted_at', 
  'canceled_at', 
  'canceled_by', 
  'cancel_reason', 
  'cancel_note', 
  'cancellation_fee_cents'
);

-- Check jobs columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('canceled_at', 'canceled_by');

-- Check RPC function
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'cancel_quote_by_customer';
```

**Expected Results:**
- 6 columns from `quote_requests`
- 2 columns from `jobs`
- 1 function `cancel_quote_by_customer`

---

## Step 3: Test the App

### Test 1: Basic Flow
1. **Start the app:**
   ```bash
   npm start
   # or
   npx expo start
   ```

2. **Log in as customer**

3. **Create a job and accept a quote**

4. **Navigate to job details**
   - You should see a "Cancel Job" button

5. **Tap "Cancel Job"**
   - Modal should open with cancellation reasons

6. **Select a reason and confirm**
   - Should succeed without errors

### Test 2: Verify Realtime Updates
1. **Open two devices/browsers:**
   - Device 1: Customer account
   - Device 2: Mechanic account (same job)

2. **Customer cancels job on Device 1**

3. **Watch Device 2 (mechanic)**
   - Should see cancellation appear within 1-2 seconds
   - No manual refresh needed

---

## Step 4: Troubleshooting

### Error: "column quote_requests.accepted_at does not exist"

**Cause:** Migrations not run yet

**Solution:**
1. Run the migration script (Step 1 above)
2. Restart your app
3. Try again

---

### Error: "function cancel_quote_by_customer does not exist"

**Cause:** RPC function not created

**Solution:**
1. Run the migration script (Step 1 above)
2. Verify function exists:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'cancel_quote_by_customer';
   ```

---

### Error: "Not authenticated"

**Cause:** User session expired

**Solution:**
1. Log out and log back in
2. Check Supabase auth token is valid

---

### Error: "You can only cancel your own quotes"

**Cause:** Trying to cancel another user's quote

**Solution:**
1. Verify you're logged in as the correct customer
2. Check the job belongs to your account

---

### Cancellation button not visible

**Possible Causes:**
1. Job is already completed
2. Job is already canceled
3. Quote is not accepted yet

**Solution:**
- Check job status in database:
  ```sql
  SELECT id, status, accepted_mechanic_id 
  FROM jobs 
  WHERE id = 'YOUR_JOB_ID';
  ```

---

### Realtime updates not working

**Possible Causes:**
1. Realtime not enabled in Supabase
2. RLS policies blocking access

**Solution:**
1. Enable Realtime in Supabase Dashboard:
   - Go to Database > Replication
   - Enable replication for `jobs` and `quote_requests` tables

2. Verify RLS policies:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename IN ('jobs', 'quote_requests');
   ```

---

## Step 5: Next Steps

Once migrations are run and basic testing is complete:

1. **Read the documentation:**
   - `CANCELLATION_IMPLEMENTATION.md` - Full implementation details
   - `CANCELLATION_TESTING_GUIDE.md` - Comprehensive testing scenarios

2. **Run full test suite:**
   - See `CANCELLATION_TESTING_GUIDE.md` for 11 test scenarios
   - Test all edge cases
   - Verify on iOS and Android

3. **Monitor in production:**
   - Track cancellation rate
   - Monitor fee distribution
   - Review user feedback

---

## Quick Reference

### Migration Files (Already Created)
- ✅ `supabase/migrations/20240105000000_add_cancellation_fields.sql`
- ✅ `supabase/migrations/20240106000000_create_cancel_quote_function.sql`
- ✅ `supabase/migrations/20240107000000_update_cancellation_rls.sql`
- ✅ `supabase/migrations/RUN_ALL_CANCELLATION_MIGRATIONS.sql` (Combined)

### App Files (Already Updated)
- ✅ `src/components/CancelQuoteModal.tsx` (New component)
- ✅ `app/(customer)/job/[id].tsx` (Cancel button + UI)
- ✅ `app/(mechanic)/job-details/[id].tsx` (Cancellation display)

### Documentation Files (Already Created)
- ✅ `CANCELLATION_IMPLEMENTATION.md`
- ✅ `CANCELLATION_TESTING_GUIDE.md`
- ✅ `QUICK_SETUP_GUIDE.md` (This file)

---

## Time-Protection Rules Summary

```
┌─────────────────────────────────────────────────────────┐
│ Time Since Acceptance │ Fee      │ Status              │
├─────────────────────────────────────────────────────────┤
│ 0-5 minutes           │ $0       │ ✅ Free cancellation│
│ 5+ minutes            │ $15      │ ⚠️ Standard fee     │
│ Job in_progress       │ $25      │ 🚫 Work started     │
│ Job completed         │ Blocked  │ ❌ Cannot cancel    │
└─────────────────────────────────────────────────────────┘
```

---

## Support

**Questions?**
- Check `CANCELLATION_TESTING_GUIDE.md` for troubleshooting
- Review `CANCELLATION_IMPLEMENTATION.md` for technical details
- Test queries are in the testing guide

**Ready to deploy?**
- Run all test scenarios
- Verify on iOS and Android
- Enable monitoring queries
- Deploy with confidence! 🚀
