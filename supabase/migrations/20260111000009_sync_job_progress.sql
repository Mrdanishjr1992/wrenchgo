-- =====================================================
-- MIGRATION: Sync Job Progress to Jobs Table
-- =====================================================
-- Creates trigger to sync job_progress milestones back to jobs table

BEGIN;

-- Add scheduled_at trigger - when mechanic departs, job is effectively scheduled
CREATE OR REPLACE FUNCTION public.sync_job_progress_to_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When mechanic departs, set scheduled_at if not already set
  IF NEW.mechanic_departed_at IS NOT NULL AND OLD.mechanic_departed_at IS NULL THEN
    UPDATE jobs 
    SET scheduled_at = NEW.mechanic_departed_at,
        status = 'in_progress',
        updated_at = now()
    WHERE id = NEW.job_id 
      AND scheduled_at IS NULL;
  END IF;
  
  -- When work starts, update status
  IF NEW.work_started_at IS NOT NULL AND OLD.work_started_at IS NULL THEN
    UPDATE jobs 
    SET status = 'work_in_progress',
        updated_at = now()
    WHERE id = NEW.job_id;
  END IF;
  
  -- When finalized (both parties confirmed), mark completed
  IF NEW.finalized_at IS NOT NULL AND OLD.finalized_at IS NULL THEN
    UPDATE jobs 
    SET completed_at = NEW.finalized_at,
        status = 'completed',
        updated_at = now()
    WHERE id = NEW.job_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_sync_job_progress ON public.job_progress;
CREATE TRIGGER trg_sync_job_progress
  AFTER UPDATE ON public.job_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_job_progress_to_jobs();

COMMIT;