-- Clear migration history to allow fresh migration application
-- Run this in Supabase SQL Editor

TRUNCATE supabase_migrations.schema_migrations;

-- Verify it's empty
SELECT * FROM supabase_migrations.schema_migrations;
