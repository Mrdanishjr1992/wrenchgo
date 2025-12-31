-- Check and clean migration history
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- Delete the orphaned 20240101 migration
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20240101';

-- Verify it's gone
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
