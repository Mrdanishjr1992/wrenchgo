-- ============================================================================
-- Test Data for Payments System
-- Run this in Supabase SQL Editor to create test promotions
-- ============================================================================

-- Insert test promotions
INSERT INTO promotions (
  code,
  type,
  description,
  percent_off,
  amount_cents,
  active,
  start_date,
  end_date,
  max_redemptions,
  max_redemptions_per_user,
  minimum_amount_cents
) VALUES
  -- 10% off promotion
  (
    'WELCOME10',
    'percent_discount',
    '10% off your first service',
    10,
    NULL,
    true,
    NOW(),
    NOW() + INTERVAL '30 days',
    100,
    1,
    5000
  ),
  -- $20 off promotion
  (
    'SAVE20',
    'fixed_discount',
    '$20 off any service over $100',
    NULL,
    2000,
    true,
    NOW(),
    NOW() + INTERVAL '30 days',
    50,
    1,
    10000
  ),
  -- Free platform fee
  (
    'NOFEE',
    'waive_platform_fee',
    'No platform fee on your first booking',
    NULL,
    NULL,
    true,
    NOW(),
    NOW() + INTERVAL '30 days',
    200,
    1,
    NULL
  )
ON CONFLICT (code) DO NOTHING;

-- Verify promotions were created
SELECT 
  code,
  type,
  description,
  active,
  current_redemptions,
  max_redemptions
FROM promotions
ORDER BY created_at DESC;
