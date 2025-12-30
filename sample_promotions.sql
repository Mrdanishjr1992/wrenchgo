-- Sample Promotions for Testing
-- Run these in Supabase SQL Editor to create test promotion codes

-- 10% off promotion (good for testing percentage discounts)
INSERT INTO promotions (
  code,
  type,
  percent_off,
  description,
  start_date,
  end_date,
  max_redemptions,
  max_redemptions_per_user,
  active
) VALUES (
  'WELCOME10',
  'percent_discount',
  10.00,
  '10% off your first job',
  NOW(),
  NOW() + INTERVAL '90 days',
  1000,
  1,
  true
);

-- Fixed $20 off (with minimum order requirement)
INSERT INTO promotions (
  code,
  type,
  amount_cents,
  description,
  minimum_amount_cents,
  start_date,
  max_redemptions,
  max_redemptions_per_user,
  active
) VALUES (
  'SAVE20',
  'fixed_discount',
  2000,
  '$20 off orders over $100',
  10000,
  NOW(),
  500,
  1,
  true
);

-- Waive platform fee (removes the $15 fee)
INSERT INTO promotions (
  code,
  type,
  description,
  start_date,
  end_date,
  max_redemptions,
  max_redemptions_per_user,
  active
) VALUES (
  'NOFEE',
  'waive_platform_fee',
  'No platform fee for this job',
  NOW(),
  NOW() + INTERVAL '30 days',
  100,
  1,
  true
);

-- First-time customer promotion (50% off, first job only)
INSERT INTO promotions (
  code,
  type,
  percent_off,
  description,
  first_job_only,
  start_date,
  max_redemptions_per_user,
  active
) VALUES (
  'FIRST50',
  'percent_discount',
  50.00,
  '50% off your first job',
  true,
  NOW(),
  1,
  true
);

-- Limited time flash sale (25% off, expires in 7 days)
INSERT INTO promotions (
  code,
  type,
  percent_off,
  description,
  start_date,
  end_date,
  max_redemptions,
  active
) VALUES (
  'FLASH25',
  'percent_discount',
  25.00,
  'Flash sale - 25% off!',
  NOW(),
  NOW() + INTERVAL '7 days',
  50,
  true
);

-- Fixed $5 off (no minimum, unlimited uses per user)
INSERT INTO promotions (
  code,
  type,
  amount_cents,
  description,
  start_date,
  max_redemptions_per_user,
  active
) VALUES (
  'SAVE5',
  'fixed_discount',
  500,
  '$5 off any service',
  NOW(),
  999,
  true
);

-- Referral bonus (for future implementation)
INSERT INTO promotions (
  code,
  type,
  amount_cents,
  description,
  start_date,
  active
) VALUES (
  'REFER10',
  'referral_bonus',
  1000,
  '$10 referral bonus',
  NOW(),
  true
);

-- Test promotion (for development/testing)
INSERT INTO promotions (
  code,
  type,
  percent_off,
  description,
  start_date,
  active
) VALUES (
  'TEST10',
  'percent_discount',
  10.00,
  'Test promotion - 10% off',
  NOW(),
  true
);

-- Verify promotions were created
SELECT 
  code,
  type,
  COALESCE(percent_off::text, (amount_cents / 100.0)::text, 'N/A') as discount,
  description,
  active,
  CASE 
    WHEN end_date IS NULL THEN 'No expiry'
    WHEN end_date > NOW() THEN 'Active until ' || end_date::date
    ELSE 'Expired'
  END as status
FROM promotions
ORDER BY created_at DESC;
