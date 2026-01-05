-- Quick verification queries for seed data

-- 1. Count all tables
SELECT 'Symptoms' as table_name, COUNT(*)::text as count FROM symptoms
UNION ALL
SELECT 'Symptom Mappings', COUNT(*)::text FROM symptom_mappings
UNION ALL
SELECT 'Education Cards', COUNT(*)::text FROM education_cards
UNION ALL
SELECT 'Skills', COUNT(*)::text FROM skills
UNION ALL
SELECT 'Tools', COUNT(*)::text FROM tools
UNION ALL
SELECT 'Safety Measures', COUNT(*)::text FROM safety_measures;

-- 2. Show symptom mappings by risk level
SELECT 
  risk_level,
  COUNT(*) as count,
  STRING_AGG(symptom_label, ', ' ORDER BY symptom_label) as symptoms
FROM symptom_mappings
GROUP BY risk_level
ORDER BY 
  CASE risk_level
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END;

-- 3. Show education cards
SELECT 
  symptom_key,
  title,
  CASE 
    WHEN why_it_happens IS NOT NULL THEN '✓' ELSE '✗'
  END as has_details
FROM education_cards
ORDER BY symptom_key;
