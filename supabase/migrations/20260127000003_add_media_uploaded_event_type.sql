-- Add media_uploaded to job_event_type enum
DO $$
BEGIN
  ALTER TYPE public.job_event_type ADD VALUE IF NOT EXISTS 'media_uploaded';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
