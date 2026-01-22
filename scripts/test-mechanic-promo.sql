-- =====================================================
-- TEST: Mechanic Promo Auto-Apply
-- =====================================================
-- This script tests that mechanic promo credits are auto-applied
-- when a contract is created via accept_quote_and_create_contract.
--
-- Run this manually against your test database.
-- You can run each section step-by-step and verify results.
-- =====================================================

-- =====================================================
-- SETUP: Create test users and data
-- =====================================================
DO $$
DECLARE
  v_mechanic_id uuid;
  v_customer_id uuid;
  v_job_id uuid;
  v_quote_id uuid;
  v_promo_credit_id uuid;
  v_result jsonb;
BEGIN
  RAISE NOTICE '=== MECHANIC PROMO AUTO-APPLY TEST ===';
  
  -- Find or use existing test mechanic
  SELECT id INTO v_mechanic_id FROM auth.users WHERE email LIKE '%test%mechanic%' LIMIT 1;
  IF v_mechanic_id IS NULL THEN
    RAISE NOTICE 'No test mechanic found. Create one first or adjust the query.';
    RETURN;
  END IF;
  
  -- Find or use existing test customer
  SELECT id INTO v_customer_id FROM auth.users WHERE email LIKE '%test%customer%' LIMIT 1;
  IF v_customer_id IS NULL THEN
    RAISE NOTICE 'No test customer found. Create one first or adjust the query.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Using mechanic_id: %', v_mechanic_id;
  RAISE NOTICE 'Using customer_id: %', v_customer_id;
  
  -- =====================================================
  -- TEST 1: Seed mechanic promo credit
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 1: Seed mechanic promo credit ===';
  
  -- Check existing credits
  SELECT COUNT(*) INTO v_result 
  FROM promo_credits 
  WHERE user_id = v_mechanic_id AND remaining_uses > 0;
  
  RAISE NOTICE 'Existing eligible credits for mechanic: %', v_result;
  
  -- Create a new FEELESS credit for testing
  INSERT INTO promo_credits (user_id, credit_type, remaining_uses, source)
  VALUES (v_mechanic_id, 'FEELESS', 1, 'test_mechanic_promo')
  RETURNING id INTO v_promo_credit_id;
  
  RAISE NOTICE 'Created promo credit: %', v_promo_credit_id;
  
  -- Verify credit
  SELECT jsonb_build_object(
    'id', id,
    'credit_type', credit_type,
    'remaining_uses', remaining_uses,
    'paused', paused
  ) INTO v_result
  FROM promo_credits WHERE id = v_promo_credit_id;
  
  RAISE NOTICE 'Promo credit details: %', v_result;
  
  -- =====================================================
  -- TEST 2: Create job and quote
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 2: Create job and quote ===';
  
  -- Create test job
  INSERT INTO jobs (customer_id, title, description, status, urgency)
  VALUES (v_customer_id, 'Test Job for Mechanic Promo', 'Testing mechanic promo auto-apply', 'quoted', 'flexible')
  RETURNING id INTO v_job_id;
  
  RAISE NOTICE 'Created job: %', v_job_id;
  
  -- Create quote from mechanic
  INSERT INTO quotes (job_id, mechanic_id, price_cents, estimated_hours, status, message)
  VALUES (v_job_id, v_mechanic_id, 10000, 2, 'pending', 'Test quote')
  RETURNING id INTO v_quote_id;
  
  RAISE NOTICE 'Created quote: % for $%.00', v_quote_id, 10000/100;
  
  -- Create job acknowledgement (required)
  INSERT INTO job_acknowledgements (job_id, user_id, role)
  VALUES (v_job_id, v_customer_id, 'customer')
  ON CONFLICT DO NOTHING;
  
  -- Ensure customer has accepted terms
  INSERT INTO user_terms_acceptances (user_id, terms_type, terms_version, accepted_at)
  VALUES (v_customer_id, 'customer', '2025.01', now())
  ON CONFLICT (user_id, terms_type) DO UPDATE SET accepted_at = now();
  
  -- =====================================================
  -- TEST 3: Accept quote (should auto-apply mechanic promo)
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 3: Accept quote - auto-apply mechanic promo ===';
  
  -- Accept the quote
  SELECT accept_quote_and_create_contract(v_quote_id, v_customer_id) INTO v_result;
  
  RAISE NOTICE 'Contract creation result: %', v_result;
  
  IF (v_result->>'success')::boolean THEN
    RAISE NOTICE 'SUCCESS: Contract created';
    RAISE NOTICE '  - mechanic_promo_applied: %', v_result->>'mechanic_promo_applied';
    RAISE NOTICE '  - mechanic_promo_discount_cents: %', v_result->>'mechanic_promo_discount_cents';
  ELSE
    RAISE NOTICE 'FAILED: %', v_result->>'error';
    RETURN;
  END IF;
  
  -- =====================================================
  -- TEST 4: Verify contract has promo applied
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 4: Verify contract promo application ===';
  
  SELECT jsonb_build_object(
    'id', id,
    'mechanic_commission_cents', mechanic_commission_cents,
    'mechanic_payout_cents', mechanic_payout_cents,
    'mechanic_promo_discount_cents', mechanic_promo_discount_cents,
    'original_mechanic_commission_cents', original_mechanic_commission_cents,
    'applied_mechanic_promo_credit_id', applied_mechanic_promo_credit_id
  ) INTO v_result
  FROM job_contracts
  WHERE id = (v_result->>'contract_id')::uuid;
  
  RAISE NOTICE 'Contract details: %', v_result;
  
  -- Verify commission was reduced
  IF (v_result->>'mechanic_promo_discount_cents')::int > 0 THEN
    RAISE NOTICE 'SUCCESS: Mechanic promo discount applied: $%.2f', (v_result->>'mechanic_promo_discount_cents')::numeric / 100;
    RAISE NOTICE '  - Original commission: $%.2f', COALESCE((v_result->>'original_mechanic_commission_cents')::numeric, 0) / 100;
    RAISE NOTICE '  - After promo commission: $%.2f', (v_result->>'mechanic_commission_cents')::numeric / 100;
  ELSE
    RAISE NOTICE 'WARNING: No promo discount applied';
  END IF;
  
  -- =====================================================
  -- TEST 5: Verify promo credit was decremented
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 5: Verify promo credit decremented ===';
  
  SELECT jsonb_build_object(
    'remaining_uses', remaining_uses
  ) INTO v_result
  FROM promo_credits WHERE id = v_promo_credit_id;
  
  RAISE NOTICE 'Promo credit remaining_uses: %', v_result->>'remaining_uses';
  
  IF (v_result->>'remaining_uses')::int = 0 THEN
    RAISE NOTICE 'SUCCESS: Promo credit was consumed';
  ELSE
    RAISE NOTICE 'WARNING: Promo credit remaining_uses not decremented';
  END IF;
  
  -- =====================================================
  -- TEST 6: Verify mechanic_promo_applications record
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 6: Verify mechanic_promo_applications record ===';
  
  SELECT jsonb_build_object(
    'id', id,
    'credit_type', credit_type,
    'commission_before_cents', commission_before_cents,
    'discount_cents', discount_cents,
    'commission_after_cents', commission_after_cents
  ) INTO v_result
  FROM mechanic_promo_applications
  WHERE promo_credit_id = v_promo_credit_id;
  
  IF v_result IS NOT NULL THEN
    RAISE NOTICE 'SUCCESS: Application record created';
    RAISE NOTICE '  - Details: %', v_result;
  ELSE
    RAISE NOTICE 'WARNING: No mechanic_promo_applications record found';
  END IF;
  
  -- =====================================================
  -- TEST 7: Test idempotency (retry should not double-apply)
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 7: Idempotency test ===';
  
  -- Try to apply again - should return already_applied
  SELECT apply_mechanic_promo_to_contract(
    (SELECT id FROM job_contracts WHERE job_id = v_job_id),
    v_mechanic_id,
    1200  -- Same commission
  ) INTO v_result;
  
  RAISE NOTICE 'Retry result: %', v_result;
  
  IF (v_result->>'already_applied')::boolean THEN
    RAISE NOTICE 'SUCCESS: Idempotent - already_applied returned';
  ELSE
    RAISE NOTICE 'WARNING: Idempotency check may have failed';
  END IF;
  
  -- =====================================================
  -- CLEANUP (optional - comment out to keep test data)
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== CLEANUP ===';
  
  -- Delete test data (in reverse order of creation)
  DELETE FROM mechanic_promo_applications WHERE promo_credit_id = v_promo_credit_id;
  DELETE FROM job_contracts WHERE job_id = v_job_id;
  DELETE FROM quotes WHERE job_id = v_job_id;
  DELETE FROM job_acknowledgements WHERE job_id = v_job_id;
  DELETE FROM jobs WHERE id = v_job_id;
  DELETE FROM promo_credits WHERE id = v_promo_credit_id;
  
  RAISE NOTICE 'Test data cleaned up';
  RAISE NOTICE '';
  RAISE NOTICE '=== ALL TESTS COMPLETED ===';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR: % - %', SQLERRM, SQLSTATE;
  -- Cleanup on error
  IF v_job_id IS NOT NULL THEN
    DELETE FROM job_contracts WHERE job_id = v_job_id;
    DELETE FROM quotes WHERE job_id = v_job_id;
    DELETE FROM job_acknowledgements WHERE job_id = v_job_id;
    DELETE FROM jobs WHERE id = v_job_id;
  END IF;
  IF v_promo_credit_id IS NOT NULL THEN
    DELETE FROM mechanic_promo_applications WHERE promo_credit_id = v_promo_credit_id;
    DELETE FROM promo_credits WHERE id = v_promo_credit_id;
  END IF;
  RAISE;
END $$;

-- =====================================================
-- MANUAL VERIFICATION QUERIES
-- =====================================================
-- Run these after the test to verify state:

-- Check mechanic promo credits:
-- SELECT * FROM promo_credits WHERE user_id = '<mechanic_id>' ORDER BY created_at DESC;

-- Check mechanic_promo_applications:
-- SELECT * FROM mechanic_promo_applications ORDER BY created_at DESC LIMIT 10;

-- Check contracts with mechanic promo applied:
-- SELECT id, mechanic_id, mechanic_commission_cents, mechanic_promo_discount_cents, 
--        original_mechanic_commission_cents, applied_mechanic_promo_credit_id
-- FROM job_contracts 
-- WHERE mechanic_promo_discount_cents > 0
-- ORDER BY created_at DESC LIMIT 10;

-- Check job events for promo application:
-- SELECT * FROM job_events 
-- WHERE event_type = 'mechanic_promo_applied' 
-- ORDER BY created_at DESC LIMIT 10;
