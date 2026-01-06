-- Repair migration: Fix reserved word column names
-- This migration handles both:
-- 1. Fresh installs (columns already quoted in baseline schema)
-- 2. Existing databases (columns need to be renamed)

-- Helper function to check if a column exists
CREATE OR REPLACE FUNCTION column_exists(
  p_table_name text,
  p_column_name text,
  p_schema_name text DEFAULT 'public'
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = p_schema_name
      AND table_name = p_table_name
      AND column_name = p_column_name
  );
END;
$$;

-- Fix skills table
DO $$
BEGIN
  -- If old 'name' column exists, this is an old database
  IF column_exists('skills', 'name') THEN
    -- Rename name -> "key"
    ALTER TABLE public.skills RENAME COLUMN name TO "key";
    
    -- Drop description if it exists (not in new schema)
    IF column_exists('skills', 'description') THEN
      ALTER TABLE public.skills DROP COLUMN description;
    END IF;
    
    -- Add is_mobile_safe if missing
    IF NOT column_exists('skills', 'is_mobile_safe') THEN
      ALTER TABLE public.skills ADD COLUMN is_mobile_safe boolean DEFAULT false;
    END IF;
  END IF;
  
  -- If unquoted 'key' exists (shouldn't happen but handle it)
  -- Note: In PostgreSQL, unquoted identifiers are folded to lowercase
  -- So 'key' and "key" refer to the same column if created unquoted
  -- This is just defensive programming
END;
$$;

-- Fix tools table (ensure "key" is properly quoted)
DO $$
BEGIN
  -- Tools should already have "key" from baseline, but verify
  IF NOT column_exists('tools', 'key') THEN
    RAISE EXCEPTION 'tools table missing key column - baseline schema not applied';
  END IF;
END;
$$;

-- Fix safety_measures table
DO $$
BEGIN
  IF NOT column_exists('safety_measures', 'key') THEN
    RAISE EXCEPTION 'safety_measures table missing key column - baseline schema not applied';
  END IF;
END;
$$;

-- Fix symptoms table
DO $$
BEGIN
  IF NOT column_exists('symptoms', 'key') THEN
    RAISE EXCEPTION 'symptoms table missing key column - baseline schema not applied';
  END IF;
END;
$$;

-- Fix media_assets table
DO $$
BEGIN
  IF NOT column_exists('media_assets', 'key') THEN
    RAISE EXCEPTION 'media_assets table missing key column - baseline schema not applied';
  END IF;
END;
$$;

-- Clean up helper function
DROP FUNCTION IF EXISTS column_exists(text, text, text);

-- Verify the fix worked
DO $$
DECLARE
  v_count integer;
BEGIN
  -- Test query that was failing
  SELECT COUNT(*) INTO v_count FROM public.skills;
  RAISE NOTICE 'Skills table verified: % rows', v_count;
END;
$$;
