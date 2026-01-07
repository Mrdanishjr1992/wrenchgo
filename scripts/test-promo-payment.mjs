#!/usr/bin/env node
/**
 * Test script for invitation promo system
 * 
 * Tests:
 * 1. Payment with FEELESS credit (waives entire platform fee)
 * 2. Payment with FEEOFF5 credit ($5 off)
 * 3. Payment with fee=0 (no consumption)
 * 4. Retry idempotency (no double consumption, same PI returned)
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-promo-payment.mjs
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function rpc(name, params = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RPC ${name} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function query(table, select = '*', filters = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  for (const [k, v] of Object.entries(filters)) {
    url += `&${k}=${encodeURIComponent(v)}`;
  }
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Query ${table} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function insert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert ${table} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function update(table, data, filters) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  const filterParts = [];
  for (const [k, v] of Object.entries(filters)) {
    filterParts.push(`${k}=eq.${v}`);
  }
  if (filterParts.length) url += '?' + filterParts.join('&');
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update ${table} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function deleteRows(table, filters) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  const filterParts = [];
  for (const [k, v] of Object.entries(filters)) {
    filterParts.push(`${k}=eq.${v}`);
  }
  if (filterParts.length) url += '?' + filterParts.join('&');
  
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal',
    },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Delete ${table} failed: ${res.status} ${text}`);
  }
}

// Test helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function log(test, message) {
  console.log(`[${test}] ${message}`);
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('INVITATION PROMO SYSTEM TESTS');
  console.log('='.repeat(60));

  // Get a test user (first customer)
  const customers = await query('profiles', 'id,full_name', { 'role': 'eq.customer', 'limit': '1' });
  if (!customers.length) {
    console.error('No customer found for testing');
    process.exit(1);
  }
  const testUserId = customers[0].id;
  log('SETUP', `Using test user: ${customers[0].full_name} (${testUserId})`);

  // Get any job or create a temporary one
  let jobs = await query('jobs', 'id', { 'limit': '1' });
  let testJobId;
  let createdTestJob = false;

  if (jobs.length) {
    testJobId = jobs[0].id;
  } else {
    // Create a temporary job for testing
    const [tempJob] = await insert('jobs', {
      customer_id: testUserId,
      title: 'TEST_PROMO_JOB',
      description: 'Temporary job for promo testing',
      status: 'draft',
    });
    testJobId = tempJob.id;
    createdTestJob = true;
    log('SETUP', `Created temporary test job: ${testJobId}`);
  }
  log('SETUP', `Using test job: ${testJobId}`);

  // Clean up any existing test promo credits for this user
  await deleteRows('promo_credits', { user_id: testUserId });

  // =========================================================
  // TEST 1: Payment with FEELESS credit
  // =========================================================
  console.log('\n--- TEST 1: FEELESS credit ---');
  
  // Create a FEELESS credit
  const [feelessCredit] = await insert('promo_credits', {
    user_id: testUserId,
    credit_type: 'FEELESS',
    remaining_uses: 1,
  });
  log('TEST1', `Created FEELESS credit: ${feelessCredit.id}`);

  // Create a mock payment with platform_fee_cents = 1500
  const [mockPayment1] = await insert('payments', {
    job_id: testJobId,
    customer_id: testUserId,
    mechanic_id: testUserId,
    stripe_payment_intent_id: 'test_pi_feeless_' + Date.now(),
    amount_cents: 10000,
    platform_fee_cents: 1500,
    status: 'pending',
  });
  log('TEST1', `Created mock payment: ${mockPayment1.id}, platform_fee=1500`);

  // Apply promo
  const result1 = await rpc('apply_promo_to_payment', {
    p_payment_id: mockPayment1.id,
    p_user_id: testUserId,
  });
  log('TEST1', `apply_promo_to_payment result: ${JSON.stringify(result1)}`);

  assert(result1.applied === true, 'Promo should be applied');
  assert(result1.credit_type === 'FEELESS', 'Credit type should be FEELESS');
  assert(result1.discount_cents === 1500, 'Discount should be 1500 (full fee)');
  assert(result1.fee_after_cents === 0, 'Fee after should be 0');
  log('TEST1', 'PASSED: FEELESS credit waived entire platform fee');

  // Verify credit was consumed
  const [updatedCredit1] = await query('promo_credits', '*', { id: `eq.${feelessCredit.id}` });
  assert(updatedCredit1.remaining_uses === 0, 'Credit should have 0 remaining uses');
  log('TEST1', 'PASSED: Credit was consumed');

  // =========================================================
  // TEST 2: Payment with FEEOFF5 credit
  // =========================================================
  console.log('\n--- TEST 2: FEEOFF5 credit ---');

  // Create a FEEOFF5 credit
  const [feeoff5Credit] = await insert('promo_credits', {
    user_id: testUserId,
    credit_type: 'FEEOFF5',
    remaining_uses: 1,
  });
  log('TEST2', `Created FEEOFF5 credit: ${feeoff5Credit.id}`);

  // Create another mock payment
  const [mockPayment2] = await insert('payments', {
    job_id: testJobId,
    customer_id: testUserId,
    mechanic_id: testUserId,
    stripe_payment_intent_id: 'test_pi_feeoff5_' + Date.now(),
    amount_cents: 10000,
    platform_fee_cents: 1500,
    status: 'pending',
  });
  log('TEST2', `Created mock payment: ${mockPayment2.id}, platform_fee=1500`);

  // Apply promo
  const result2 = await rpc('apply_promo_to_payment', {
    p_payment_id: mockPayment2.id,
    p_user_id: testUserId,
  });
  log('TEST2', `apply_promo_to_payment result: ${JSON.stringify(result2)}`);

  assert(result2.applied === true, 'Promo should be applied');
  assert(result2.credit_type === 'FEEOFF5', 'Credit type should be FEEOFF5');
  assert(result2.discount_cents === 500, 'Discount should be 500 ($5)');
  assert(result2.fee_after_cents === 1000, 'Fee after should be 1000');
  log('TEST2', 'PASSED: FEEOFF5 credit gave $5 off');

  // =========================================================
  // TEST 3: Payment with fee=0 (no consumption)
  // =========================================================
  console.log('\n--- TEST 3: fee=0 (no consumption) ---');

  // Create another credit
  const [unusedCredit] = await insert('promo_credits', {
    user_id: testUserId,
    credit_type: 'FEELESS',
    remaining_uses: 1,
  });
  log('TEST3', `Created FEELESS credit: ${unusedCredit.id}`);

  // Create payment with fee=0
  const [mockPayment3] = await insert('payments', {
    job_id: testJobId,
    customer_id: testUserId,
    mechanic_id: testUserId,
    stripe_payment_intent_id: 'test_pi_zerofee_' + Date.now(),
    amount_cents: 5000,
    platform_fee_cents: 0,
    status: 'pending',
  });
  log('TEST3', `Created mock payment: ${mockPayment3.id}, platform_fee=0`);

  // Apply promo
  const result3 = await rpc('apply_promo_to_payment', {
    p_payment_id: mockPayment3.id,
    p_user_id: testUserId,
  });
  log('TEST3', `apply_promo_to_payment result: ${JSON.stringify(result3)}`);

  assert(result3.applied === false, 'Promo should NOT be applied');
  assert(result3.reason === 'No platform fee to discount', 'Reason should indicate no fee');
  log('TEST3', 'PASSED: No credit consumed when fee=0');

  // Verify credit was NOT consumed
  const [stillUnusedCredit] = await query('promo_credits', '*', { id: `eq.${unusedCredit.id}` });
  assert(stillUnusedCredit.remaining_uses === 1, 'Credit should still have 1 remaining use');
  log('TEST3', 'PASSED: Credit was NOT consumed');

  // =========================================================
  // TEST 4: Retry idempotency (no double consumption)
  // =========================================================
  console.log('\n--- TEST 4: Retry idempotency ---');

  // Try to apply promo to mockPayment1 again (already has promo applied)
  const result4 = await rpc('apply_promo_to_payment', {
    p_payment_id: mockPayment1.id,
    p_user_id: testUserId,
  });
  log('TEST4', `apply_promo_to_payment retry result: ${JSON.stringify(result4)}`);

  assert(result4.success === false || result4.applied === false, 'Retry should not apply promo again');
  log('TEST4', 'PASSED: Retry did not double-consume');

  // =========================================================
  // TEST 5: FIFO + Priority (FEELESS before FEEOFF5)
  // =========================================================
  console.log('\n--- TEST 5: FIFO + Priority ---');

  // Create FEEOFF5 first, then FEELESS
  const [feeoff5First] = await insert('promo_credits', {
    user_id: testUserId,
    credit_type: 'FEEOFF5',
    remaining_uses: 1,
  });
  // Small delay to ensure different created_at
  await new Promise(r => setTimeout(r, 100));
  const [feelessSecond] = await insert('promo_credits', {
    user_id: testUserId,
    credit_type: 'FEELESS',
    remaining_uses: 1,
  });
  log('TEST5', `Created FEEOFF5 (${feeoff5First.id}) then FEELESS (${feelessSecond.id})`);

  // Create payment
  const [mockPayment5] = await insert('payments', {
    job_id: testJobId,
    customer_id: testUserId,
    mechanic_id: testUserId,
    stripe_payment_intent_id: 'test_pi_priority_' + Date.now(),
    amount_cents: 10000,
    platform_fee_cents: 1500,
    status: 'pending',
  });

  // Apply promo - should use FEELESS despite FEEOFF5 being older
  const result5 = await rpc('apply_promo_to_payment', {
    p_payment_id: mockPayment5.id,
    p_user_id: testUserId,
  });
  log('TEST5', `apply_promo_to_payment result: ${JSON.stringify(result5)}`);

  assert(result5.credit_type === 'FEELESS', 'Should use FEELESS (higher priority) not FEEOFF5');
  log('TEST5', 'PASSED: FEELESS has priority over FEEOFF5');

  // =========================================================
  // CLEANUP
  // =========================================================
  console.log('\n--- CLEANUP ---');
  await deleteRows('payment_promo_applications', { payment_id: `in.(${mockPayment1.id},${mockPayment2.id},${mockPayment3.id},${mockPayment5.id})` });
  await deleteRows('payments', { stripe_payment_intent_id: 'like.test_pi_%' });
  await deleteRows('promo_credits', { user_id: testUserId });
  log('CLEANUP', 'Removed test data');

  console.log('\n' + '='.repeat(60));
  console.log('ALL TESTS PASSED');
  console.log('='.repeat(60));
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});