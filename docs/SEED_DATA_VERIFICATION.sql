-- =====================================================
-- SEED DATA VERIFICATION QUERIES
-- =====================================================
-- Run these queries to verify seed data integrity

-- 1. Count rows per table
SELECT 'skills' AS table_name, COUNT(*) AS count FROM skills
UNION ALL
SELECT 'tools', COUNT(*) FROM tools
UNION ALL
SELECT 'safety_measures', COUNT(*) FROM safety_measures
UNION ALL
SELECT 'symptoms', COUNT(*) FROM symptoms
UNION ALL
SELECT 'symptom_mappings', COUNT(*) FROM symptom_mappings
UNION ALL
SELECT 'symptom_education', COUNT(*) FROM symptom_education
UNION ALL
SELECT 'education_cards', COUNT(*) FROM education_cards
UNION ALL
SELECT 'symptom_questions', COUNT(*) FROM symptom_questions;

-- Expected:
-- skills: 9
-- tools: 7
-- safety_measures: 5
-- symptoms: 17
-- symptom_mappings: 17
-- symptom_education: 17
-- education_cards: 7
-- symptom_questions: 52

-- 2. Confirm icons are not null
SELECT key, label, icon 
FROM symptoms 
WHERE icon IS NULL OR icon = '';
-- Expected: 0 rows (all symptoms should have icons)

-- 3. Confirm foreign keys are valid (symptom_mappings → symptoms)
SELECT sm.symptom_key 
FROM symptom_mappings sm
LEFT JOIN symptoms s ON sm.symptom_key = s.key
WHERE s.key IS NULL;
-- Expected: 0 rows (all symptom_keys should exist in symptoms)

-- 4. Confirm foreign keys are valid (symptom_education → symptoms)
SELECT se.symptom_key 
FROM symptom_education se
LEFT JOIN symptoms s ON se.symptom_key = s.key
WHERE s.key IS NULL;
-- Expected: 0 rows

-- 5. Confirm foreign keys are valid (symptom_questions → symptoms)
SELECT DISTINCT sq.symptom_key 
FROM symptom_questions sq
LEFT JOIN symptoms s ON sq.symptom_key = s.key
WHERE s.key IS NULL;
-- Expected: 0 rows

-- 6. Verify risk levels are valid
SELECT DISTINCT risk_level 
FROM symptom_mappings 
WHERE risk_level NOT IN ('low', 'medium', 'high');
-- Expected: 0 rows

-- 7. Verify quote strategies are valid
SELECT DISTINCT quote_strategy 
FROM symptom_mappings 
WHERE quote_strategy NOT IN ('fixed_simple', 'inspection_required', 'diagnostic_only', 'diagnosis-first');
-- Expected: 0 rows (note: 'diagnosis-first' is legacy, should be 'diagnostic_only')

-- 8. Verify question types are valid
SELECT DISTINCT question_type 
FROM symptom_questions 
WHERE question_type NOT IN ('yes_no', 'single_choice', 'multi_choice', 'numeric', 'photo', 'audio');
-- Expected: 0 rows

-- 9. Check for duplicate symptom_keys
SELECT symptom_key, COUNT(*) 
FROM symptom_mappings 
GROUP BY symptom_key 
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 10. Check for duplicate (symptom_key, question_key) pairs
SELECT symptom_key, question_key, COUNT(*) 
FROM symptom_questions 
GROUP BY symptom_key, question_key 
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 11. Verify all symptoms have education content
SELECT s.key, s.label
FROM symptoms s
LEFT JOIN symptom_education se ON s.key = se.symptom_key
WHERE se.symptom_key IS NULL;
-- Expected: 0 rows (all symptoms should have education content)

-- 12. Sample data check - verify icons render correctly
SELECT key, label, icon, LENGTH(icon) AS icon_length
FROM symptoms
LIMIT 5;
-- Expected: All icons should be 1-4 characters (emoji)

-- 13. Sample symptom_mappings data
SELECT symptom_key, symptom_label, category, risk_level, quote_strategy
FROM symptom_mappings
ORDER BY category, symptom_label
LIMIT 10;

-- 14. Sample symptom_questions data
SELECT symptom_key, question_key, question_text, question_type, affects_safety, affects_quote
FROM symptom_questions
ORDER BY symptom_key, display_order
LIMIT 10;

-- 15. Verify symptom_education has all required fields
SELECT symptom_key, 
       LENGTH(title) AS title_length,
       LENGTH(summary) AS summary_length,
       LENGTH(is_it_safe) AS safety_length,
       LENGTH(what_we_check) AS check_length,
       LENGTH(how_quotes_work) AS quotes_length
FROM symptom_education
WHERE title IS NULL 
   OR summary IS NULL 
   OR is_it_safe IS NULL 
   OR what_we_check IS NULL 
   OR how_quotes_work IS NULL;
-- Expected: 0 rows (all fields should be populated)
