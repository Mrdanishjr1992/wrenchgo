-- Temporarily disable review triggers to debug submit_review issue
-- Also wrap trust score recalculation in exception handler to prevent blocking

BEGIN;

-- Make the review trigger function safe - catch any errors
CREATE OR REPLACE FUNCTION public.trigger_recalc_trust_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Wrap in exception handler to prevent blocking review inserts
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.recalculate_trust_score(NEW.reviewee_id, 'review_added', NEW.job_id);
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.visibility::text = 'visible' AND (OLD.visibility IS NULL OR OLD.visibility::text != 'visible') THEN
      PERFORM public.recalculate_trust_score(NEW.reviewee_id, 'review_visible', NEW.job_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Trust score recalculation failed for user %: %', NEW.reviewee_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMIT;