-- Mandatory Review System Migration
-- Adds helper functions and columns for enforcing mandatory post-job reviews

BEGIN;

-- Add reviewed_at columns to jobs table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'customer_reviewed_at'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN customer_reviewed_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'mechanic_reviewed_at'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN mechanic_reviewed_at timestamptz;
  END IF;
END $$;

-- Create function to check if user has submitted review for a job
CREATE OR REPLACE FUNCTION public.has_submitted_review(p_job_id uuid, p_reviewer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.reviews
    WHERE job_id = p_job_id
    AND reviewer_id = p_reviewer_id
    AND deleted_at IS NULL
  );
END;
$$;

-- Create function to get pending review job for a user
-- Returns the oldest completed job that the user hasn't reviewed yet
CREATE OR REPLACE FUNCTION public.get_pending_review_job(p_user_id uuid)
RETURNS TABLE (
  job_id uuid,
  job_title text,
  other_party_id uuid,
  other_party_name text,
  reviewer_role text,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_job RECORD;
BEGIN
  -- Check for jobs where user is customer and hasn't reviewed
  SELECT 
    j.id as job_id,
    j.title as job_title,
    jc.mechanic_id as other_party_id,
    COALESCE(p.full_name, 'Mechanic') as other_party_name,
    'customer'::text as reviewer_role,
    COALESCE(jp.finalized_at, jp.customer_completed_at, j.updated_at) as completed_at
  INTO v_pending_job
  FROM public.jobs j
  INNER JOIN public.job_contracts jc ON jc.job_id = j.id
  LEFT JOIN public.job_progress jp ON jp.job_id = j.id
  LEFT JOIN public.profiles p ON p.id = jc.mechanic_id
  WHERE j.customer_id = p_user_id
  AND j.status = 'completed'
  AND j.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.job_id = j.id
    AND r.reviewer_id = p_user_id
    AND r.deleted_at IS NULL
  )
  ORDER BY COALESCE(jp.finalized_at, jp.customer_completed_at, j.updated_at) ASC
  LIMIT 1;
  
  IF v_pending_job.job_id IS NOT NULL THEN
    RETURN QUERY SELECT 
      v_pending_job.job_id,
      v_pending_job.job_title,
      v_pending_job.other_party_id,
      v_pending_job.other_party_name,
      v_pending_job.reviewer_role,
      v_pending_job.completed_at;
    RETURN;
  END IF;
  
  -- Check for jobs where user is mechanic and hasn't reviewed
  SELECT 
    j.id as job_id,
    j.title as job_title,
    j.customer_id as other_party_id,
    COALESCE(p.full_name, 'Customer') as other_party_name,
    'mechanic'::text as reviewer_role,
    COALESCE(jp.finalized_at, jp.mechanic_completed_at, j.updated_at) as completed_at
  INTO v_pending_job
  FROM public.jobs j
  INNER JOIN public.job_contracts jc ON jc.job_id = j.id
  LEFT JOIN public.job_progress jp ON jp.job_id = j.id
  LEFT JOIN public.profiles p ON p.id = j.customer_id
  WHERE jc.mechanic_id = p_user_id
  AND j.status = 'completed'
  AND j.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.job_id = j.id
    AND r.reviewer_id = p_user_id
    AND r.deleted_at IS NULL
  )
  ORDER BY COALESCE(jp.finalized_at, jp.mechanic_completed_at, j.updated_at) ASC
  LIMIT 1;
  
  IF v_pending_job.job_id IS NOT NULL THEN
    RETURN QUERY SELECT 
      v_pending_job.job_id,
      v_pending_job.job_title,
      v_pending_job.other_party_id,
      v_pending_job.other_party_name,
      v_pending_job.reviewer_role,
      v_pending_job.completed_at;
    RETURN;
  END IF;
  
  -- No pending reviews
  RETURN;
END;
$$;

-- Create trigger to update reviewed_at columns when review is inserted
CREATE OR REPLACE FUNCTION public.update_job_reviewed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
BEGIN
  -- Get job info
  SELECT customer_id INTO v_job
  FROM public.jobs
  WHERE id = NEW.job_id;
  
  -- Update the appropriate column based on reviewer role
  IF NEW.reviewer_id = v_job.customer_id THEN
    UPDATE public.jobs
    SET customer_reviewed_at = NEW.created_at
    WHERE id = NEW.job_id;
  ELSE
    UPDATE public.jobs
    SET mechanic_reviewed_at = NEW.created_at
    WHERE id = NEW.job_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_job_reviewed_at ON public.reviews;
CREATE TRIGGER trigger_update_job_reviewed_at
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_job_reviewed_at();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.has_submitted_review(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_review_job(uuid) TO authenticated;

COMMIT;
