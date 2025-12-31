-- ============================================================================
-- POST-RESET DATABASE VERIFICATION SUITE
-- ============================================================================
-- Purpose: Comprehensive verification after `supabase db reset`
-- Run in: Supabase SQL Editor
-- Expected: All checks pass (✅) or show specific issues (❌/⚠️)
-- ============================================================================

-- Expected Schemas
WITH expected_schemas AS (
  SELECT unnest(ARRAY['public', 'auth', 'storage']) AS schema_name
),

-- Expected Tables (public schema only)
expected_tables AS (
  SELECT unnest(ARRAY[
    'profiles',
    'vehicles', 
    'jobs',
    'quote_requests',
    'messages',
    'mechanic_profiles',
    'symptom_mappings',
    'symptom_questions'
  ]) AS table_name
),

-- Expected Columns (table_name, column_name, data_type, is_nullable, column_default)
expected_columns AS (
  SELECT * FROM (VALUES
    -- profiles
    ('profiles', 'id', 'uuid', 'NO', NULL),
    ('profiles', 'role', 'text', 'NO', '''customer''::text'),
    ('profiles', 'created_at', 'timestamp with time zone', 'NO', 'now()'),
    ('profiles', 'updated_at', 'timestamp with time zone', 'NO', 'now()'),
    
    -- vehicles
    ('vehicles', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('vehicles', 'user_id', 'uuid', 'NO', NULL),
    ('vehicles', 'year', 'integer', 'NO', NULL),
    ('vehicles', 'make', 'text', 'NO', NULL),
    ('vehicles', 'model', 'text', 'NO', NULL),
    ('vehicles', 'vin', 'text', 'YES', NULL),
    ('vehicles', 'license_plate', 'text', 'YES', NULL),
    ('vehicles', 'created_at', 'timestamp with time zone', 'NO', 'now()'),
    ('vehicles', 'updated_at', 'timestamp with time zone', 'NO', 'now()'),
    
    -- jobs
    ('jobs', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('jobs', 'customer_id', 'uuid', 'NO', NULL),
    ('jobs', 'vehicle_id', 'uuid', 'NO', NULL),
    ('jobs', 'status', 'text', 'NO', '''pending''::text'),
    ('jobs', 'created_at', 'timestamp with time zone', 'NO', 'now()'),
    ('jobs', 'updated_at', 'timestamp with time zone', 'NO', 'now()'),
    
    -- quote_requests
    ('quote_requests', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('quote_requests', 'job_id', 'uuid', 'NO', NULL),
    ('quote_requests', 'mechanic_id', 'uuid', 'NO', NULL),
    ('quote_requests', 'status', 'text', 'NO', '''pending''::text'),
    ('quote_requests', 'created_at', 'timestamp with time zone', 'NO', 'now()'),
    
    -- messages
    ('messages', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('messages', 'job_id', 'uuid', 'NO', NULL),
    ('messages', 'sender_id', 'uuid', 'NO', NULL),
    ('messages', 'content', 'text', 'NO', NULL),
    ('messages', 'created_at', 'timestamp with time zone', 'NO', 'now()'),
    
    -- mechanic_profiles
    ('mechanic_profiles', 'id', 'uuid', 'NO', NULL),
    ('mechanic_profiles', 'business_name', 'text', 'YES', NULL),
    ('mechanic_profiles', 'license_number', 'text', 'YES', NULL),
    ('mechanic_profiles', 'created_at', 'timestamp with time zone', 'NO', 'now()'),
    
    -- symptom_mappings
    ('symptom_mappings', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('symptom_mappings', 'symptom_label', 'text', 'NO', NULL),
    ('symptom_mappings', 'category', 'text', 'NO', NULL),
    ('symptom_mappings', 'risk_level', 'text', 'YES', NULL),
    ('symptom_mappings', 'created_at', 'timestamp with time zone', 'NO', 'now()'),
    
    -- symptom_questions
    ('symptom_questions', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('symptom_questions', 'symptom_id', 'uuid', 'NO', NULL),
    ('symptom_questions', 'question_text', 'text', 'NO', NULL),
    ('symptom_questions', 'question_type', 'text', 'NO', NULL),
    ('symptom_questions', 'created_at', 'timestamp with time zone', 'NO', 'now()')
  ) AS t(table_name, column_name, data_type, is_nullable, column_default)
),

-- Expected Primary Keys
expected_pks AS (
  SELECT * FROM (VALUES
    ('profiles', 'id'),
    ('vehicles', 'id'),
    ('jobs', 'id'),
    ('quote_requests', 'id'),
    ('messages', 'id'),
    ('mechanic_profiles', 'id'),
    ('symptom_mappings', 'id'),
    ('symptom_questions', 'id')
  ) AS t(table_name, column_name)
),

-- Expected Foreign Keys (child_table, child_column, parent_table, parent_column)
expected_fks AS (
  SELECT * FROM (VALUES
    ('profiles', 'id', 'auth.users', 'id'),
    ('vehicles', 'user_id', 'profiles', 'id'),
    ('jobs', 'customer_id', 'profiles', 'id'),
    ('jobs', 'vehicle_id', 'vehicles', 'id'),
    ('quote_requests', 'job_id', 'jobs', 'id'),
    ('quote_requests', 'mechanic_id', 'mechanic_profiles', 'id'),
    ('messages', 'job_id', 'jobs', 'id'),
    ('messages', 'sender_id', 'profiles', 'id'),
    ('mechanic_profiles', 'id', 'profiles', 'id'),
    ('symptom_questions', 'symptom_id', 'symptom_mappings', 'id')
  ) AS t(child_table, child_column, parent_table, parent_column)
),

-- Expected Indexes (table_name, index_name_pattern)
expected_indexes AS (
  SELECT * FROM (VALUES
    ('vehicles', 'idx_vehicles_user_id'),
    ('jobs', 'idx_jobs_customer_id'),
    ('jobs', 'idx_jobs_vehicle_id'),
    ('quote_requests', 'idx_quote_requests_job_id'),
    ('messages', 'idx_messages_job_id')
  ) AS t(table_name, index_name)
),

-- Expected Triggers (table_name, trigger_name)
expected_triggers AS (
  SELECT * FROM (VALUES
    ('profiles', 'on_auth_user_created'),
    ('profiles', 'handle_updated_at'),
    ('vehicles', 'handle_updated_at'),
    ('jobs', 'handle_updated_at')
  ) AS t(table_name, trigger_name)
),

-- Expected RLS Tables
expected_rls_tables AS (
  SELECT unnest(ARRAY[
    'profiles',
    'vehicles',
    'jobs',
    'quote_requests',
    'messages',
    'mechanic_profiles',
    'symptom_mappings',
    'symptom_questions'
  ]) AS table_name
),

-- Expected Seed Data Counts (minimum expected rows)
expected_seed_counts AS (
  SELECT * FROM (VALUES
    ('symptom_mappings', 18),
    ('symptom_questions', 10)
  ) AS t(table_name, min_count)
),

-- ============================================================================
-- ACTUAL STATE QUERIES
-- ============================================================================

actual_schemas AS (
  SELECT schema_name
  FROM information_schema.schemata
  WHERE schema_name IN ('public', 'auth', 'storage')
),

actual_tables AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
),

actual_columns AS (
  SELECT 
    table_name,
    column_name,
    CASE 
      WHEN data_type = 'USER-DEFINED' THEN udt_name
      ELSE data_type
    END AS data_type,
    is_nullable,
    column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
),

actual_pks AS (
  SELECT 
    tc.table_name,
    kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
),

actual_fks AS (
  SELECT 
    tc.table_name AS child_table,
    kcu.column_name AS child_column,
    ccu.table_schema || '.' || ccu.table_name AS parent_table,
    ccu.column_name AS parent_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
),

actual_indexes AS (
  SELECT 
    schemaname || '.' || tablename AS table_name,
    indexname AS index_name
  FROM pg_indexes
  WHERE schemaname = 'public'
),

actual_triggers AS (
  SELECT 
    event_object_table AS table_name,
    trigger_name
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
),

actual_rls AS (
  SELECT 
    tablename AS table_name,
    rowsecurity AS rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public'
),

actual_seed_counts AS (
  SELECT 'symptom_mappings' AS table_name, COUNT(*) AS actual_count FROM symptom_mappings
  UNION ALL
  SELECT 'symptom_questions', COUNT(*) FROM symptom_questions
),

-- ============================================================================
-- COMPARISON & ISSUE DETECTION
-- ============================================================================

missing_schemas AS (
  SELECT 
    e.schema_name,
    '❌ MISSING SCHEMA' AS issue
  FROM expected_schemas e
  LEFT JOIN actual_schemas a ON e.schema_name = a.schema_name
  WHERE a.schema_name IS NULL
),

missing_tables AS (
  SELECT 
    e.table_name,
    '❌ MISSING TABLE' AS issue
  FROM expected_tables e
  LEFT JOIN actual_tables a ON e.table_name = a.table_name
  WHERE a.table_name IS NULL
),

-- FIX: Ensure all three CTEs return the same column structure
missing_columns AS (
  SELECT 
    e.table_name,
    e.column_name,
    e.data_type::text AS detail_1,
    e.is_nullable::text AS detail_2,
    '❌ MISSING COLUMN' AS issue
  FROM expected_columns e
  LEFT JOIN actual_columns a 
    ON e.table_name = a.table_name 
    AND e.column_name = a.column_name
  WHERE a.column_name IS NULL
),

type_mismatches AS (
  SELECT 
    e.table_name,
    e.column_name,
    e.data_type::text AS detail_1,
    a.data_type::text AS detail_2,
    '❌ TYPE MISMATCH' AS issue
  FROM expected_columns e
  INNER JOIN actual_columns a 
    ON e.table_name = a.table_name 
    AND e.column_name = a.column_name
  WHERE e.data_type != a.data_type
),

nullable_mismatches AS (
  SELECT 
    e.table_name,
    e.column_name,
    e.is_nullable::text AS detail_1,
    a.is_nullable::text AS detail_2,
    '⚠️ NULLABLE MISMATCH' AS issue
  FROM expected_columns e
  INNER JOIN actual_columns a 
    ON e.table_name = a.table_name 
    AND e.column_name = a.column_name
  WHERE e.is_nullable != a.is_nullable
),

-- Now all three have: (table_name, column_name, detail_1, detail_2, issue)
columns_summary AS (
  SELECT * FROM missing_columns
  UNION ALL
  SELECT * FROM type_mismatches
  UNION ALL
  SELECT * FROM nullable_mismatches
),

missing_pks AS (
  SELECT 
    e.table_name,
    e.column_name,
    '❌ MISSING PRIMARY KEY' AS issue
  FROM expected_pks e
  LEFT JOIN actual_pks a 
    ON e.table_name = a.table_name 
    AND e.column_name = a.column_name
  WHERE a.column_name IS NULL
),

missing_fks AS (
  SELECT 
    e.child_table || '.' || e.child_column || ' -> ' || e.parent_table || '.' || e.parent_column AS fk_definition,
    '❌ MISSING FOREIGN KEY' AS issue
  FROM expected_fks e
  LEFT JOIN actual_fks a 
    ON e.child_table = a.child_table 
    AND e.child_column = a.child_column
    AND e.parent_table = a.parent_table
    AND e.parent_column = a.parent_column
  WHERE a.child_table IS NULL
),

missing_indexes AS (
  SELECT 
    e.table_name,
    e.index_name,
    '⚠️ MISSING INDEX' AS issue
  FROM expected_indexes e
  LEFT JOIN actual_indexes a 
    ON e.table_name = 'public.' || e.table_name
    AND a.index_name LIKE '%' || e.index_name || '%'
  WHERE a.index_name IS NULL
),

missing_triggers AS (
  SELECT 
    e.table_name,
    e.trigger_name,
    '❌ MISSING TRIGGER' AS issue
  FROM expected_triggers e
  LEFT JOIN actual_triggers a 
    ON e.table_name = a.table_name 
    AND e.trigger_name = a.trigger_name
  WHERE a.trigger_name IS NULL
),

missing_rls AS (
  SELECT 
    e.table_name,
    CASE 
      WHEN a.rls_enabled IS NULL THEN 'Table does not exist'
      WHEN a.rls_enabled = false THEN 'RLS not enabled'
      ELSE 'OK'
    END AS status,
    '❌ RLS NOT ENABLED' AS issue
  FROM expected_rls_tables e
  LEFT JOIN actual_rls a ON e.table_name = a.table_name
  WHERE a.rls_enabled IS NULL OR a.rls_enabled = false
),

seed_data_issues AS (
  SELECT 
    e.table_name,
    e.min_count AS expected_min,
    COALESCE(a.actual_count, 0) AS actual_count,
    CASE 
      WHEN COALESCE(a.actual_count, 0) < e.min_count THEN '❌ INSUFFICIENT SEED DATA'
      ELSE '✅ SEED DATA OK'
    END AS issue
  FROM expected_seed_counts e
  LEFT JOIN actual_seed_counts a ON e.table_name = a.table_name
),

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

final_summary AS (
  SELECT 
    (SELECT COUNT(*) FROM missing_schemas) AS missing_schemas_count,
    (SELECT COUNT(*) FROM missing_tables) AS missing_tables_count,
    (SELECT COUNT(*) FROM columns_summary) AS column_issues_count,
    (SELECT COUNT(*) FROM missing_pks) AS missing_pks_count,
    (SELECT COUNT(*) FROM missing_fks) AS missing_fks_count,
    (SELECT COUNT(*) FROM missing_indexes) AS missing_indexes_count,
    (SELECT COUNT(*) FROM missing_triggers) AS missing_triggers_count,
    (SELECT COUNT(*) FROM missing_rls) AS missing_rls_count,
    (SELECT COUNT(*) FROM seed_data_issues WHERE issue LIKE '❌%') AS seed_data_issues_count
)

-- ============================================================================
-- OUTPUT
-- ============================================================================

SELECT '═══════════════════════════════════════════════════════════════════════════' AS separator
UNION ALL SELECT '  POST-RESET DATABASE VERIFICATION REPORT'
UNION ALL SELECT '═══════════════════════════════════════════════════════════════════════════'
UNION ALL SELECT ''
UNION ALL SELECT '📊 SUMMARY'
UNION ALL SELECT '─────────────────────────────────────────────────────────────────────────'
UNION ALL SELECT '  Missing Schemas: ' || missing_schemas_count FROM final_summary
UNION ALL SELECT '  Missing Tables: ' || missing_tables_count FROM final_summary
UNION ALL SELECT '  Column Issues: ' || column_issues_count FROM final_summary
UNION ALL SELECT '  Missing Primary Keys: ' || missing_pks_count FROM final_summary
UNION ALL SELECT '  Missing Foreign Keys: ' || missing_fks_count FROM final_summary
UNION ALL SELECT '  Missing Indexes: ' || missing_indexes_count FROM final_summary
UNION ALL SELECT '  Missing Triggers: ' || missing_triggers_count FROM final_summary
UNION ALL SELECT '  RLS Issues: ' || missing_rls_count FROM final_summary
UNION ALL SELECT '  Seed Data Issues: ' || seed_data_issues_count FROM final_summary
UNION ALL SELECT ''
UNION ALL SELECT CASE 
  WHEN (SELECT missing_schemas_count + missing_tables_count + column_issues_count + 
               missing_pks_count + missing_fks_count + missing_triggers_count + 
               missing_rls_count + seed_data_issues_count FROM final_summary) = 0 
  THEN '✅ ALL CHECKS PASSED - Database is correctly configured!'
  ELSE '❌ ISSUES FOUND - See details below'
END
UNION ALL SELECT ''
UNION ALL SELECT '═══════════════════════════════════════════════════════════════════════════'
UNION ALL SELECT '  DETAILED ISSUES'
UNION ALL SELECT '═══════════════════════════════════════════════════════════════════════════'
UNION ALL SELECT ''
UNION ALL SELECT '🔴 MISSING SCHEMAS' WHERE EXISTS (SELECT 1 FROM missing_schemas)
UNION ALL SELECT '─────────────────────────────────────────────────────────────────────────' WHERE EXISTS (SELECT 1 FROM missing_schemas)
UNION ALL SELECT '  ' || schema_name || ' - ' || issue FROM missing_schemas
UNION ALL SELECT '' WHERE EXISTS (SELECT 1 FROM missing_schemas)
UNION ALL SELECT '🔴 MISSING TABLES' WHERE EXISTS (SELECT 1 FROM missing_tables)
UNION ALL SELECT '─────────────────────────────────────────────────────────────────────────' WHERE EXISTS (SELECT 1 FROM missing_tables)
UNION ALL SELECT '  ' || table_name || ' - ' || issue FROM missing_tables
UNION ALL SELECT '' WHERE EXISTS (SELECT 1 FROM missing_tables)
UNION ALL SELECT '🔴 COLUMN ISSUES' WHERE EXISTS (SELECT 1 FROM columns_summary)
UNION ALL SELECT '─────────────────────────────────────────────────────────────────────────' WHERE EXISTS (SELECT 1 FROM columns_summary)
UNION ALL SELECT '  ' || table_name || '.' || column_name || ' - ' || issue || ' (Expected: ' || detail_1 || ', Actual: ' || COALESCE(detail_2, 'N/A') || ')' FROM columns_summary
UNION ALL SELECT '' WHERE EXISTS (SELECT 1 FROM columns_summary)
UNION ALL SELECT '🔴 MISSING PRIMARY KEYS' WHERE EXISTS (SELECT 1 FROM missing_pks)
UNION ALL SELECT '─────────────────────────────────────────────────────────────────────────' WHERE EXISTS (SELECT 1 FROM missing_pks)
UNION ALL SELECT '  ' || table_name || '.' || column_name || ' - ' || issue FROM missing_pks
UNION ALL SELECT '' WHERE EXISTS (SELECT 1 FROM missing_pks)
UNION ALL SELECT '🔴 MISSING FOREIGN KEYS' WHERE EXISTS (SELECT 1 FROM missing_fks)
UNION ALL SELECT '─────────────────────────────────────────────────────────────────────────' WHERE EXISTS (SELECT 1 FROM missing_fks)
UNION ALL SELECT '  ' || fk_definition || ' - ' || issue FROM missing_fks
UNION ALL SELECT '' WHERE EXISTS (SELECT 1 FROM missing_fks)
UNION ALL SELECT '⚠️  MISSING INDEXES' WHERE EXISTS (SELECT 1 FROM missing_indexes)
UNION ALL SELECT '─────────────────────────────────────────────────────────────────────────' WHERE EXISTS (SELECT 1 FROM missing_indexes)
UNION ALL SELECT '  ' || table_name || ' - ' || index_name || ' - ' || issue FROM missing_indexes
UNION ALL SELECT '' WHERE EXISTS (SELECT 1 FROM missing_indexes)
UNION ALL SELECT '🔴 MISSING TRIGGERS' WHERE EXISTS (SELECT 1 FROM missing_triggers)
UNION ALL SELECT '─────────────────────────────────────────────────────────────────────────' WHERE EXISTS (SELECT 1 FROM missing_triggers)
UNION ALL SELECT '  ' || table_name || ' - ' || trigger_name || ' - ' || issue FROM missing_triggers
UNION ALL SELECT '' WHERE EXISTS (SELECT 1 FROM missing_triggers)
UNION ALL SELECT '🔴 RLS ISSUES' WHERE EXISTS (SELECT 1 FROM missing_rls)
UNION ALL SELECT '─────────────────────────────────────────────────────────────────────────' WHERE EXISTS (SELECT 1 FROM missing_rls)
UNION ALL SELECT '  ' || table_name || ' - ' || status || ' - ' || issue FROM missing_rls
UNION ALL SELECT '' WHERE EXISTS (SELECT 1 FROM missing_rls)
UNION ALL SELECT '📦 SEED DATA STATUS'
UNION ALL SELECT '─────────────────────────────────────────────────────────────────────────'
UNION ALL SELECT '  ' || table_name || ': Expected ≥' || expected_min || ', Actual: ' || actual_count || ' - ' || issue FROM seed_data_issues
UNION ALL SELECT ''
UNION ALL SELECT '═══════════════════════════════════════════════════════════════════════════'
UNION ALL SELECT '  END OF REPORT'
UNION ALL SELECT '═══════════════════════════════════════════════════════════════════════════';
