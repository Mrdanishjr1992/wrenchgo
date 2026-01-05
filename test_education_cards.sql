-- Test education cards are accessible via REST API
-- Run this in Supabase Studio SQL Editor or via psql

-- 1. Verify education cards exist
SELECT 
  'Education Cards' as test,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 7 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM education_cards;

-- 2. Verify RLS policy exists
SELECT 
  'RLS Policy' as test,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM pg_policies 
WHERE tablename = 'education_cards' 
AND policyname = 'Anyone can view education_cards';

-- 3. Show sample education card data
SELECT 
  id,
  symptom_key,
  title,
  LENGTH(summary) as summary_length,
  LENGTH(is_it_safe) as safety_length,
  order_index
FROM education_cards
ORDER BY order_index
LIMIT 3;

-- 4. Verify all required fields are populated
SELECT 
  symptom_key,
  title,
  CASE WHEN summary IS NOT NULL THEN '✅' ELSE '❌' END as has_summary,
  CASE WHEN is_it_safe IS NOT NULL THEN '✅' ELSE '❌' END as has_safety,
  CASE WHEN what_we_check IS NOT NULL THEN '✅' ELSE '❌' END as has_checks,
  CASE WHEN why_it_happens IS NOT NULL THEN '✅' ELSE '❌' END as has_why,
  CASE WHEN prep_before_visit IS NOT NULL THEN '✅' ELSE '❌' END as has_prep,
  CASE WHEN quote_expectation IS NOT NULL THEN '✅' ELSE '❌' END as has_quote,
  CASE WHEN red_flags IS NOT NULL THEN '✅' ELSE '❌' END as has_flags
FROM education_cards
ORDER BY order_index;
