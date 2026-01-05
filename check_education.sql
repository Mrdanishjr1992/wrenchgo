SELECT 
  symptom_key, 
  card_key, 
  title,
  CASE 
    WHEN why_it_happens IS NOT NULL THEN '✓'
    ELSE '✗'
  END as has_why,
  CASE 
    WHEN prep_before_visit IS NOT NULL THEN '✓'
    ELSE '✗'
  END as has_prep,
  CASE 
    WHEN quote_expectation IS NOT NULL THEN '✓'
    ELSE '✗'
  END as has_quote,
  CASE 
    WHEN red_flags IS NOT NULL THEN '✓'
    ELSE '✗'
  END as has_red_flags
FROM education_cards 
ORDER BY symptom_key;
