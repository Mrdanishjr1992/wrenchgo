-- ============================================================================
-- DELETE ORPHANED MIGRATIONS FROM HISTORY
-- ============================================================================
-- This script removes orphaned migration entries from the
-- supabase_migrations.schema_migrations table that don't exist in local files.
--
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- ============================================================================

BEGIN;

-- Check for orphaned migrations
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20240101%'
ORDER BY version;

-- Delete the orphaned migration entries
DELETE FROM supabase_migrations.schema_migrations
WHERE version LIKE '20240101%';

-- Verify deletion
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;

COMMIT;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- After running this script:
-- 1. Return to your terminal
-- 2. Run: supabase db push --include-all
-- ============================================================================
