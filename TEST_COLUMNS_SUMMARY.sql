-- Test to isolate columns_summary issue
WITH expected_columns AS (
  SELECT * FROM (VALUES
    ('profiles', 'id', 'uuid', 'NO', NULL),
    ('profiles', 'role', 'text', 'NO', '''customer''::text'),
    ('profiles', 'created_at', 'timestamp with time zone', 'NO', 'now()')
  ) AS t(table_name, column_name, data_type, is_nullable, column_default)
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

missing_columns AS (
  SELECT 
    e.table_name,
    e.column_name,
    e.data_type AS expected_type,
    e.is_nullable AS expected_nullable,
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
    e.data_type AS expected_type,
    a.data_type AS actual_type,
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
    e.is_nullable AS expected_nullable,
    a.is_nullable AS actual_nullable,
    '⚠️ NULLABLE MISMATCH' AS issue
  FROM expected_columns e
  INNER JOIN actual_columns a 
    ON e.table_name = a.table_name 
    AND e.column_name = a.column_name
  WHERE e.is_nullable != a.is_nullable
)

-- Test each CTE individually
SELECT 'missing_columns' AS test, COUNT(*) AS row_count, COUNT(*) FILTER (WHERE table_name IS NOT NULL) AS has_data FROM missing_columns
UNION ALL
SELECT 'type_mismatches', COUNT(*), COUNT(*) FILTER (WHERE table_name IS NOT NULL) FROM type_mismatches
UNION ALL
SELECT 'nullable_mismatches', COUNT(*), COUNT(*) FILTER (WHERE table_name IS NOT NULL) FROM nullable_mismatches;
