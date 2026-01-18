-- Add unique constraint on reviews for ON CONFLICT to work
BEGIN;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'reviews_job_id_reviewer_id_key'
  ) THEN
    ALTER TABLE public.reviews 
    ADD CONSTRAINT reviews_job_id_reviewer_id_key 
    UNIQUE (job_id, reviewer_id);
  END IF;
END $$;

COMMIT;