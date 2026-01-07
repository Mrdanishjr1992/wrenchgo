-- =====================================================
-- MIGRATION 0014: TRUST SYSTEM TRIGGERS
-- =====================================================
-- Purpose: Automatic triggers for trust system workflows
-- =====================================================

BEGIN;

-- =====================================================
-- TRIGGER: After job finalized, create review prompts
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_create_review_prompts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
  v_mechanic_id uuid;
BEGIN
  -- Only trigger when finalized_at is set for the first time
  IF NEW.finalized_at IS NOT NULL AND (OLD.finalized_at IS NULL OR OLD.finalized_at IS DISTINCT FROM NEW.finalized_at) THEN
    -- Get customer and mechanic IDs
    SELECT j.customer_id, jc.mechanic_id
    INTO v_customer_id, v_mechanic_id
    FROM public.jobs j
    JOIN public.job_contracts jc ON jc.job_id = j.id
    WHERE j.id = NEW.job_id
    LIMIT 1;
    
    IF v_customer_id IS NOT NULL AND v_mechanic_id IS NOT NULL THEN
      PERFORM public.create_review_prompts(NEW.job_id, v_customer_id, v_mechanic_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_review_prompts_on_finalize ON public.job_progress;
CREATE TRIGGER trigger_create_review_prompts_on_finalize
  AFTER UPDATE ON public.job_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_review_prompts();

-- =====================================================
-- TRIGGER: After review published, process skill verifications
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_process_skill_verifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mechanic_id uuid;
  v_customer_rating int;
BEGIN
  -- Only trigger when review becomes visible
  IF NEW.visibility = 'visible' AND (OLD.visibility IS NULL OR OLD.visibility != 'visible') THEN
    -- Check if this is a customer reviewing a mechanic
    SELECT p.id, NEW.overall_rating
    INTO v_mechanic_id, v_customer_rating
    FROM public.profiles p
    WHERE p.id = NEW.reviewee_id
      AND p.role = 'mechanic';
    
    IF v_mechanic_id IS NOT NULL THEN
      PERFORM public.process_skill_verifications(NEW.job_id, v_mechanic_id, v_customer_rating);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_process_skill_verifications_on_review ON public.reviews;
CREATE TRIGGER trigger_process_skill_verifications_on_review
  AFTER UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_process_skill_verifications();

-- =====================================================
-- TRIGGER: After review published, evaluate badges
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_evaluate_badges_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger when review becomes visible
  IF NEW.visibility = 'visible' AND (OLD.visibility IS NULL OR OLD.visibility != 'visible') THEN
    -- Evaluate badges for both reviewer and reviewee
    PERFORM public.evaluate_and_award_badges(NEW.reviewer_id, 'review_published', NEW.job_id);
    PERFORM public.evaluate_and_award_badges(NEW.reviewee_id, 'review_published', NEW.job_id);
    
    -- Recalculate trust scores
    PERFORM public.calculate_trust_score(NEW.reviewer_id);
    PERFORM public.calculate_trust_score(NEW.reviewee_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_evaluate_badges_on_review ON public.reviews;
CREATE TRIGGER trigger_evaluate_badges_on_review
  AFTER UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_evaluate_badges_on_review();

-- =====================================================
-- TRIGGER: After job completed, evaluate badges
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_evaluate_badges_on_job_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger when status changes to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Evaluate badges for mechanic
    PERFORM public.evaluate_and_award_badges(NEW.mechanic_id, 'job_completed', NEW.job_id);
    
    -- Recalculate trust score
    PERFORM public.calculate_trust_score(NEW.mechanic_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_evaluate_badges_on_job_complete ON public.job_contracts;
CREATE TRIGGER trigger_evaluate_badges_on_job_complete
  AFTER UPDATE ON public.job_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_evaluate_badges_on_job_complete();

-- =====================================================
-- TRIGGER: Lock job skills when work starts
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_lock_job_skills()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Lock skills when work_started_at is set
  IF NEW.work_started_at IS NOT NULL AND (OLD.work_started_at IS NULL OR OLD.work_started_at IS DISTINCT FROM NEW.work_started_at) THEN
    PERFORM public.lock_job_skills(NEW.job_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_lock_job_skills_on_work_start ON public.job_progress;
CREATE TRIGGER trigger_lock_job_skills_on_work_start
  AFTER UPDATE ON public.job_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_lock_job_skills();

COMMIT;
