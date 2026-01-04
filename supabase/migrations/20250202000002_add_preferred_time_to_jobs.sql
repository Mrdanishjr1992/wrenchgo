-- Migration: Add missing preferred_time column to jobs table
-- This column exists in baseline schema but may be missing in remote database

-- Add preferred_time column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'preferred_time'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN preferred_time text;
    COMMENT ON COLUMN public.jobs.preferred_time IS 'Customer preferred time for service (free text)';
  END IF;
END $$;
