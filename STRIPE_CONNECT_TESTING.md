# Stripe Connect End-to-End Testing Checklist

## Prerequisites
- [ ] Stripe test account created
- [ ] Stripe Connect enabled in test mode
- [ ] Test API keys configured in Supabase secrets
- [ ] Database migration applied
- [ ] Edge functions deployed
- [ ] App scheme configured in app.json
- [ ] Deep links registered on device

## Test Environment Setup

### 1. Verify Environment Variables
```bash
# Check Supabase secrets
supabase secrets list

# Should show:
# - STRIPE_SECRET_KEY
# - APP_SCHEME
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
```

### 2. Verify Database
```sql
-- Check table exists
SELECT * FROM mechanic_payout_accounts LIMIT 1;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'mechanic_payout_accounts';

-- Should return: rowsecurity = true
```

### 3. Verify Edge Functions
```bash
# Test create-account-link function
curl -X POST \
  https://your-project.supabase.co/functions/v1/stripe-connect-create-account-link \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Should return: { "onboardingUrl": "https://connect.stripe.com/...", "stripeAccountId": "acct_..." }
```

## Mechanic Onboarding Flow

### Test Case 1: First-Time Onboarding
**Objective**: Verify a mechanic can complete initial bank account setup

- [ ] **Step 1**: Sign in as a mechanic user
  - Expected: Successfully authenticated
  - Verify: JWT token present in session

- [ ] **Step 2**: Navigate to Profile tab
  - Expected: Profile screen loads
  - Verify: "Payout Account" section visible

- [ ] **Step 3**: Check initial payout account state
  - Expected: "Set up your bank account..." message shown
  - Expected: "ADD BANK INFO" button visible
  - Verify: No existing payout account in database

- [ ] **Step 4**: Tap "ADD BANK INFO" button
  - Expected: Loading indicator appears
  - Expected: Edge function called successfully
  - Verify: Network request to `stripe-connect-create-account-link`

- [ ] **Step 5**: Stripe onboarding opens
  - Expected: Browser/webview opens with Stripe Connect URL
  - Expected: URL starts with `https://connect.stripe.com/`
  - Verify: Mechanic sees Stripe onboarding form

- [ ] **Step 6**: Complete Stripe onboarding
  - Fill in test data:
    - Business type: Individual
    - First name: Test
    - Last name: Mechanic
    - DOB: 01/01/1990
    - SSN (test): 000-00-0000
    - Address: 123 Test St, San Francisco, CA 94102
    - Phone: (555) 555-5555
    - Bank routing: 110000000
    - Bank account: 000123456789
  - Expected: All fields accept test data
  - Expected: No validation errors

- [ ] **Step 7**: Submit onboarding
  - Expected: Stripe shows success message
  - Expected: Redirect to `wrenchgo://stripe-connect-return`
  - Verify: App comes back to foreground

- [ ] **Step 8**: Verify deep link handling
  - Expected: `refreshPayoutStatus` function called automatically
  - Expected: Loading indicator shown briefly
  - Verify: Network request to `stripe-connect-refresh-status`

- [ ] **Step 9**: Check updated payout account UI
  - Expected: Payout Account section shows:
    - Status: "Complete" (green)
    - Charges enabled: "✓ Yes"
    - Payouts enabled: "✓ Yes"
  - Expected: "ADD BANK INFO" button replaced with status info
  - Verify: No "COMPLETE SETUP" button shown

- [ ] **Step 10**: Verify database record
  ```sql
  SELECT * FROM mechanic_payout_accounts 
  WHERE mechanic_id = 'YOUR_USER_ID';
  ```
  - Expected: Record exists
  - Expected: `stripe_account_id` starts with `acct_`
  - Expected: `onboarding_status` = 'complete'
  - Expected: `charges_enabled` = true
  - Expected: `payouts_enabled` = true
  - Expected: `requirements_due` = []

### Test Case 2: Incomplete Onboarding
**Objective**: Verify handling when mechanic abandons onboarding

- [ ] **Step 1**: Sign in as a new mechanic (no payout account)
- [ ] **Step 2**: Tap "ADD BANK INFO"
- [ ] **Step 3**: Stripe onboarding opens
- [ ] **Step 4**: Close browser without completing
  - Expected: App returns to profile screen
  - Expected: Payout account still shows "ADD BANK INFO"

- [ ] **Step 5**: Tap "ADD BANK INFO" again
  - Expected: Same Stripe account used (not creating duplicate)
  - Expected: Onboarding resumes from where left off
  - Verify: Only one record in `mechanic_payout_accounts` table

- [ ] **Step 6**: Complete partial information
  - Fill only name and DOB
  - Click "Save and continue later"

- [ ] **Step 7**: Return to app
  - Expected: Status shows "Incomplete" or "Pending"
  - Expected: "COMPLETE SETUP" button visible
  - Expected: Charges enabled: "✗ No"
  - Expected: Payouts enabled: "✗ No"

### Test Case 3: Refresh Status
**Objective**: Verify manual status refresh works

- [ ] **Step 1**: Sign in as mechanic with existing payout account
- [ ] **Step 2**: Navigate to Profile tab
- [ ] **Step 3**: Tap refresh icon next to "Payout Account"
  - Expected: Icon spins/animates
  - Expected: Loading state shown
  - Expected: Network request to `stripe-connect-refresh-status`

- [ ] **Step 4**: Verify status updates
  - Expected: Success alert shown
  - Expected: UI reflects current Stripe account status
  - Expected: Database record updated with latest info

### Test Case 4: Re-onboarding (Update Info)
**Objective**: Verify mechanic can update bank information

- [ ] **Step 1**: Sign in as mechanic with complete payout account
- [ ] **Step 2**: Manually update Stripe account to require additional info
  ```bash
  # In Stripe Dashboard:
  # Connect → Accounts → [Select account] → Add requirement
  ```

- [ ] **Step 3**: Tap refresh in app
  - Expected: Status changes to "Pending"
  - Expected: "COMPLETE SETUP" button appears

- [ ] **Step 4**: Tap "COMPLETE SETUP"
  - Expected: Stripe onboarding opens
  - Expected: Shows only required fields

- [ ] **Step 5**: Complete additional requirements
- [ ] **Step 6**: Return to app
  - Expected: Status returns to "Complete"
  - Expected: All capabilities enabled

## Error Handling Tests

### Test Case 5: Network Errors
- [ ] **Test 5a**: No internet connection
  - Turn off WiFi/cellular
  - Tap "ADD BANK INFO"
  - Expected: Error alert shown
  - Expected: User-friendly message

- [ ] **Test 5b**: Edge function timeout
  - Expected: Timeout error after 30s
  - Expected: User can retry

- [ ] **Test 5c**: Invalid JWT token
  - Sign out and sign back in
  - Expected: New token obtained
  - Expected: Onboarding works

### Test Case 6: Permission Errors
- [ ] **Test 6a**: RLS policy enforcement
  ```sql
  -- Try to access another mechanic's account
  SELECT * FROM mechanic_payout_accounts 
  WHERE mechanic_id != auth.uid();
  ```
  - Expected: Returns empty result (RLS blocks)

- [ ] **Test 6b**: Unauthenticated request
  - Call edge function without Authorization header
  - Expected: 401 Unauthorized response

### Test Case 7: Stripe API Errors
- [ ] **Test 7a**: Invalid API key
  - Temporarily set wrong STRIPE_SECRET_KEY
  - Tap "ADD BANK INFO"
  - Expected: Error alert shown
  - Expected: Error logged in Supabase function logs

- [ ] **Test 7b**: Account creation failure
  - Use Stripe test mode to simulate failure
  - Expected: Graceful error handling
  - Expected: No partial records in database

## Deep Link Tests

### Test Case 8: Deep Link Handling
- [ ] **Test 8a**: Return URL
  - Complete onboarding
  - Verify `wrenchgo://stripe-connect-return` triggers refresh
  - Expected: Status updated automatically

- [ ] **Test 8b**: Refresh URL
  - Abandon onboarding (click back)
  - Verify `wrenchgo://stripe-connect-refresh` triggers refresh
  - Expected: Status remains incomplete

- [ ] **Test 8c**: App in background
  - Start onboarding
  - Put app in background
  - Complete onboarding in browser
  - Return to app
  - Expected: Deep link brings app to foreground
  - Expected: Status refreshes

- [ ] **Test 8d**: App killed
  - Start onboarding
  - Kill app completely
  - Complete onboarding
  - Tap return link
  - Expected: App launches
  - Expected: Status refreshes on next profile visit

## Integration Tests

### Test Case 9: Customer Payment Flow (Separate)
**Objective**: Verify customer card-on-file doesn't interfere with mechanic payouts

- [ ] **Step 1**: Sign in as customer
- [ ] **Step 2**: Add payment method (SetupIntent)
  - Expected: Works independently
  - Expected: No payout account created for customer

- [ ] **Step 3**: Sign out and sign in as mechanic
- [ ] **Step 4**: Verify payout account still accessible
  - Expected: Mechanic sees their payout info
  - Expected: Customer payment methods not visible

### Test Case 10: Multi-Mechanic Test
- [ ] **Step 1**: Create 3 mechanic accounts
- [ ] **Step 2**: Complete onboarding for all 3
- [ ] **Step 3**: Verify each has unique Stripe account
  ```sql
  SELECT mechanic_id, stripe_account_id 
  FROM mechanic_payout_accounts;
  ```
  - Expected: 3 different `stripe_account_id` values
  - Expected: No duplicates

- [ ] **Step 4**: Sign in as each mechanic
  - Expected: Each sees only their own payout info
  - Expected: RLS prevents cross-access

## Performance Tests

### Test Case 11: Load Time
- [ ] Profile screen loads in < 2 seconds
- [ ] Payout account data fetched with profile data
- [ ] No unnecessary re-renders
- [ ] Refresh completes in < 3 seconds

### Test Case 12: Concurrent Requests
- [ ] Multiple mechanics onboarding simultaneously
- [ ] No race conditions in database
- [ ] Each gets unique Stripe account

## Production Readiness

### Pre-Launch Checklist
- [ ] Switch to live Stripe API keys
- [ ] Update redirect URLs to production scheme
- [ ] Test with real bank account (small amount)
- [ ] Verify webhook endpoint configured
- [ ] Set up monitoring/alerts for failed payouts
- [ ] Update privacy policy with Stripe mention
- [ ] Review Stripe Connected Account Agreement
- [ ] Test on both iOS and Android
- [ ] Test on various device sizes
- [ ] Verify deep links work on physical devices

### Monitoring Setup
- [ ] Supabase function logs monitored
- [ ] Stripe webhook delivery monitored
- [ ] Database query performance acceptable
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Alert on failed onboardings
- [ ] Alert on disabled payout accounts

## Test Data Cleanup

After testing, clean up test data:
```sql
-- Delete test payout accounts
DELETE FROM mechanic_payout_accounts 
WHERE stripe_account_id LIKE 'acct_test_%';

-- In Stripe Dashboard:
-- Connect → Accounts → Delete test accounts
```

## Sign-Off

- [ ] All test cases passed
- [ ] No critical bugs found
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation complete
- [ ] Team trained on support procedures

**Tested by**: _______________  
**Date**: _______________  
**Environment**: Test / Production  
**Notes**: _______________
