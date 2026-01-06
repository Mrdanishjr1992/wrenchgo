-- =====================================================
-- Job Lifecycle Integrity: Automatic Status Transitions
-- =====================================================

-- Trigger: When a quote is inserted, update job status to 'quoted' if still 'searching'
CREATE OR REPLACE FUNCTION public.on_quote_inserted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.jobs
  SET status = 'quoted', updated_at = NOW()
  WHERE id = NEW.job_id
    AND status = 'searching';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_quote_inserted ON public.quotes;
CREATE TRIGGER trg_quote_inserted
  AFTER INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.on_quote_inserted();

-- Trigger: When a quote is accepted, update job status to 'accepted'
CREATE OR REPLACE FUNCTION public.on_quote_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status <> 'accepted') THEN
    UPDATE public.jobs
    SET 
      status = 'accepted',
      accepted_mechanic_id = NEW.mechanic_id,
      updated_at = NOW()
    WHERE id = NEW.job_id
      AND status IN ('searching', 'quoted');
    
    -- Reject all other pending quotes for this job
    UPDATE public.quotes
    SET status = 'rejected', updated_at = NOW()
    WHERE job_id = NEW.job_id
      AND id <> NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_quote_accepted ON public.quotes;
CREATE TRIGGER trg_quote_accepted
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.on_quote_accepted();

-- Trigger: When a quote is withdrawn and no other pending quotes exist, revert to 'searching'
CREATE OR REPLACE FUNCTION public.on_quote_withdrawn()
RETURNS TRIGGER AS $$
DECLARE
  pending_count INT;
BEGIN
  IF NEW.status = 'withdrawn' AND OLD.status = 'pending' THEN
    SELECT COUNT(*) INTO pending_count
    FROM public.quotes
    WHERE job_id = NEW.job_id AND status = 'pending';
    
    IF pending_count = 0 THEN
      UPDATE public.jobs
      SET status = 'searching', updated_at = NOW()
      WHERE id = NEW.job_id AND status = 'quoted';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_quote_withdrawn ON public.quotes;
CREATE TRIGGER trg_quote_withdrawn
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.on_quote_withdrawn();

-- Trigger: When job is cancelled, withdraw all pending quotes
CREATE OR REPLACE FUNCTION public.on_job_cancelled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.quotes
    SET status = 'withdrawn', updated_at = NOW()
    WHERE job_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_cancelled ON public.jobs;
CREATE TRIGGER trg_job_cancelled
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.on_job_cancelled();

-- Function to get accurate job status (considers quotes)
CREATE OR REPLACE FUNCTION public.get_job_effective_status(p_job_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_status TEXT;
  v_has_pending_quotes BOOLEAN;
  v_has_accepted_quote BOOLEAN;
BEGIN
  SELECT status INTO v_status FROM public.jobs WHERE id = p_job_id;
  
  IF v_status IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check for accepted quotes
  SELECT EXISTS(
    SELECT 1 FROM public.quotes WHERE job_id = p_job_id AND status = 'accepted'
  ) INTO v_has_accepted_quote;
  
  IF v_has_accepted_quote AND v_status = 'searching' THEN
    -- Fix inconsistent state
    UPDATE public.jobs SET status = 'accepted', updated_at = NOW() WHERE id = p_job_id;
    RETURN 'accepted';
  END IF;
  
  -- Check for pending quotes
  SELECT EXISTS(
    SELECT 1 FROM public.quotes WHERE job_id = p_job_id AND status = 'pending'
  ) INTO v_has_pending_quotes;
  
  IF v_has_pending_quotes AND v_status = 'searching' THEN
    -- Fix inconsistent state
    UPDATE public.jobs SET status = 'quoted', updated_at = NOW() WHERE id = p_job_id;
    RETURN 'quoted';
  END IF;
  
  RETURN v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_job_effective_status(UUID) TO authenticated;

-- One-time fix: Update any jobs stuck in 'searching' that have quotes
DO $$
BEGIN
  -- Fix jobs with pending quotes still showing as searching
  UPDATE public.jobs j
  SET status = 'quoted', updated_at = NOW()
  WHERE j.status = 'searching'
    AND EXISTS (
      SELECT 1 FROM public.quotes q 
      WHERE q.job_id = j.id AND q.status = 'pending'
    );
    
  -- Fix jobs with accepted quotes still showing as searching/quoted
  UPDATE public.jobs j
  SET status = 'accepted', updated_at = NOW()
  WHERE j.status IN ('searching', 'quoted')
    AND EXISTS (
      SELECT 1 FROM public.quotes q 
      WHERE q.job_id = j.id AND q.status = 'accepted'
    );
END $$;
