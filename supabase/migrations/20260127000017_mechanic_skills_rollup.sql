-- =====================================================
-- Migration: Mechanic Skills Rollup from skill_verifications
-- Purpose: Keep mechanic_skills as canonical source for verified skills display
-- =====================================================

-- =====================================================
-- A) RPC Function: recalculate_mechanic_skills
-- SECURITY DEFINER for manual/repair usage
-- =====================================================
CREATE OR REPLACE FUNCTION public.recalculate_mechanic_skills(p_mechanic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert mechanic_skills for all skill_keys found in skill_verifications
  INSERT INTO mechanic_skills (mechanic_id, skill_key, verified_job_count, avg_job_rating, last_verified_at, is_verified, updated_at)
  SELECT 
    sv.mechanic_id,
    sv.skill_key,
    COUNT(*)::int AS verified_job_count,
    AVG(sv.customer_rating)::numeric(3,2) AS avg_job_rating,
    MAX(sv.verified_at) AS last_verified_at,
    true AS is_verified,
    now() AS updated_at
  FROM skill_verifications sv
  WHERE sv.mechanic_id = p_mechanic_id
  GROUP BY sv.mechanic_id, sv.skill_key
  ON CONFLICT (mechanic_id, skill_key) DO UPDATE SET
    verified_job_count = EXCLUDED.verified_job_count,
    avg_job_rating = EXCLUDED.avg_job_rating,
    last_verified_at = EXCLUDED.last_verified_at,
    is_verified = EXCLUDED.is_verified,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.recalculate_mechanic_skills(uuid) IS 'Recalculate all verified skill aggregates for a mechanic from skill_verifications';

-- =====================================================
-- B) Trigger Function: on_skill_verification_insert_update_mechanic_skills
-- Efficient: only updates the affected mechanic_id + skill_key
-- =====================================================
CREATE OR REPLACE FUNCTION public.on_skill_verification_insert_update_mechanic_skills()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_avg numeric(3,2);
  v_last timestamptz;
BEGIN
  -- Compute aggregates for the specific mechanic_id + skill_key
  SELECT 
    COUNT(*)::int,
    AVG(customer_rating)::numeric(3,2),
    MAX(verified_at)
  INTO v_count, v_avg, v_last
  FROM skill_verifications
  WHERE mechanic_id = NEW.mechanic_id
    AND skill_key = NEW.skill_key;

  -- Upsert into mechanic_skills
  INSERT INTO mechanic_skills (mechanic_id, skill_key, verified_job_count, avg_job_rating, last_verified_at, is_verified, updated_at)
  VALUES (NEW.mechanic_id, NEW.skill_key, v_count, v_avg, v_last, v_count >= 1, now())
  ON CONFLICT (mechanic_id, skill_key) DO UPDATE SET
    verified_job_count = v_count,
    avg_job_rating = v_avg,
    last_verified_at = v_last,
    is_verified = v_count >= 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.on_skill_verification_insert_update_mechanic_skills() IS 'Trigger function to update mechanic_skills when skill_verifications changes';

-- =====================================================
-- Create Trigger: AFTER INSERT on skill_verifications
-- =====================================================
DROP TRIGGER IF EXISTS trg_skill_verification_update_mechanic_skills ON skill_verifications;

CREATE TRIGGER trg_skill_verification_update_mechanic_skills
  AFTER INSERT ON skill_verifications
  FOR EACH ROW
  EXECUTE FUNCTION on_skill_verification_insert_update_mechanic_skills();

-- =====================================================
-- C) Backfill: Recalculate for all existing mechanics with verifications
-- =====================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT mechanic_id FROM skill_verifications
  LOOP
    PERFORM recalculate_mechanic_skills(r.mechanic_id);
  END LOOP;
END;
$$;

-- =====================================================
-- Diagnostic Queries (for verification - run manually)
-- =====================================================
-- 1) Check that mechanic_skills now has verified_job_count > 0:
-- SELECT * FROM mechanic_skills WHERE mechanic_id = :id AND verified_job_count > 0;

-- 2) Verify verifications exist:
-- SELECT mechanic_id, skill_key, COUNT(*) FROM skill_verifications WHERE mechanic_id = :id GROUP BY 1,2;
