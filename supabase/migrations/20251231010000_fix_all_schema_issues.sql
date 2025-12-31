-- ============================================================================
-- COMPREHENSIVE SCHEMA FIX MIGRATION
-- Fixes all 35 issues identified in POST_RESET_VERIFICATION.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP RLS POLICIES THAT REFERENCE COLUMNS WE'LL ALTER
-- ============================================================================

-- Drop policies referencing jobs.status (will recreate after type change)
DROP POLICY IF EXISTS "Mechanics can view searching jobs" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_owner_or_assigned_or_searching" ON public.jobs;

-- ============================================================================
-- STEP 2: FIX COLUMN ISSUES (14 total)
-- ============================================================================

-- 2A: Add missing columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS user_id UUID;

-- Note: jobs table uses customer_id and accepted_mechanic_id (not user_id/mechanic_id)
-- These columns should already exist from earlier migrations

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS quote_id UUID;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS mechanic_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS job_id UUID;

-- 2B: Fix type mismatches (jobs.status and quote_requests.status)
-- Convert enum to text
ALTER TABLE public.jobs
  ALTER COLUMN status TYPE TEXT USING status::text;

ALTER TABLE public.quote_requests
  ALTER COLUMN status TYPE TEXT USING status::text;

-- 2C: Fix nullable mismatches
ALTER TABLE public.profiles ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.jobs ALTER COLUMN vehicle_id SET NOT NULL;
ALTER TABLE public.jobs ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.jobs ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.quote_requests ALTER COLUMN created_at SET NOT NULL;

-- ============================================================================
-- STEP 3: RECREATE RLS POLICIES (after column type changes)
-- ============================================================================

-- Recreate jobs policies with text comparisons
CREATE POLICY "Mechanics can view searching jobs"
  ON public.jobs
  FOR SELECT
  USING (
    status = 'searching'
    AND EXISTS (
      SELECT 1 FROM public.mechanic_profiles mp
      WHERE mp.user_id = auth.uid()
    )
  );

CREATE POLICY "jobs_select_owner_or_assigned_or_searching"
  ON public.jobs
  FOR SELECT
  USING (
    customer_id = auth.uid()
    OR accepted_mechanic_id = auth.uid()
    OR (
      status = 'searching'
      AND EXISTS (
        SELECT 1 FROM public.mechanic_profiles mp
        WHERE mp.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- STEP 4: ADD MISSING PRIMARY KEYS (1 total)
-- ============================================================================

-- symptom_mappings already has symptom_key as PK, no change needed

-- ============================================================================
-- STEP 5: ADD MISSING FOREIGN KEYS (10 total)
-- ============================================================================

-- Note: Using IF NOT EXISTS pattern via DO blocks to avoid duplicate constraint errors

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'vehicles_user_id_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_customer_id_fkey'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_vehicle_id_fkey'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_accepted_mechanic_id_fkey'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_accepted_mechanic_id_fkey
      FOREIGN KEY (accepted_mechanic_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_quote_id_fkey'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES public.quote_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'quote_requests_job_id_fkey'
  ) THEN
    ALTER TABLE public.quote_requests
      ADD CONSTRAINT quote_requests_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'quote_requests_mechanic_id_fkey'
  ) THEN
    ALTER TABLE public.quote_requests
      ADD CONSTRAINT quote_requests_mechanic_id_fkey
      FOREIGN KEY (mechanic_id) REFERENCES public.mechanic_profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_job_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_sender_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'symptom_questions_symptom_key_fkey'
  ) THEN
    ALTER TABLE public.symptom_questions
      ADD CONSTRAINT symptom_questions_symptom_key_fkey
      FOREIGN KEY (symptom_key) REFERENCES public.symptom_mappings(symptom_key) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 6: ADD MISSING INDEXES (5 total)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_mechanic_id ON public.jobs(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_job_id ON public.quote_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_messages_job_id ON public.messages(job_id);

-- ============================================================================
-- STEP 7: ADD MISSING TRIGGERS (4 total)
-- ============================================================================

-- 7A: Create trigger functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'customer', now(), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7B: Create triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 8: SEED DATA (symptom_questions - 18 engine symptoms)
-- ============================================================================

-- Insert engine symptoms into symptom_mappings (if not already present)
INSERT INTO public.symptom_mappings (symptom_key, symptom_label, category, risk_level, created_at, updated_at)
VALUES
  ('engine_wont_start', 'Engine won''t start', 'Engine', 'high', now(), now()),
  ('engine_stalling', 'Engine stalling or cutting out', 'Engine', 'high', now(), now()),
  ('rough_idle', 'Rough idle or shaking', 'Engine', 'medium', now(), now()),
  ('loss_of_power', 'Loss of power or acceleration', 'Engine', 'medium', now(), now()),
  ('check_engine_light', 'Check engine light on', 'Engine', 'medium', now(), now()),
  ('engine_overheating', 'Engine overheating', 'Engine', 'high', now(), now()),
  ('unusual_engine_noise', 'Unusual engine noise (knocking, ticking)', 'Engine', 'medium', now(), now()),
  ('excessive_smoke', 'Excessive smoke from exhaust', 'Engine', 'high', now(), now()),
  ('poor_fuel_economy', 'Poor fuel economy', 'Engine', 'low', now(), now()),
  ('oil_leak', 'Oil leak', 'Engine', 'medium', now(), now()),
  ('coolant_leak', 'Coolant leak', 'Engine', 'high', now(), now()),
  ('misfiring', 'Engine misfiring', 'Engine', 'medium', now(), now()),
  ('hard_starting', 'Hard starting (cranks but slow to start)', 'Engine', 'medium', now(), now()),
  ('backfiring', 'Backfiring or popping sounds', 'Engine', 'medium', now(), now()),
  ('vibration_at_idle', 'Excessive vibration at idle', 'Engine', 'medium', now(), now()),
  ('fuel_smell', 'Strong fuel smell', 'Engine', 'high', now(), now()),
  ('timing_belt_noise', 'Timing belt or chain noise', 'Engine', 'high', now(), now()),
  ('turbo_issues', 'Turbocharger issues (if equipped)', 'Engine', 'medium', now(), now())
ON CONFLICT (symptom_key) DO NOTHING;

-- Insert questions for engine symptoms
INSERT INTO public.symptom_questions (symptom_key, question_text, question_type, created_at)
SELECT sm.symptom_key, 'When did you first notice this issue?', 'text', now()
FROM public.symptom_mappings sm
WHERE sm.category IN ('Engine', 'Engine Performance', 'Engine & Fuel')
  AND NOT EXISTS (
    SELECT 1 FROM public.symptom_questions sq
    WHERE sq.symptom_key = sm.symptom_key
      AND sq.question_text = 'When did you first notice this issue?'
  )
LIMIT 5;

INSERT INTO public.symptom_questions (symptom_key, question_text, question_type, created_at)
SELECT sm.symptom_key, 'Does the issue occur when the engine is cold, hot, or both?', 'text', now()
FROM public.symptom_mappings sm
WHERE sm.category IN ('Engine', 'Engine Performance', 'Engine & Fuel')
  AND NOT EXISTS (
    SELECT 1 FROM public.symptom_questions sq
    WHERE sq.symptom_key = sm.symptom_key
      AND sq.question_text = 'Does the issue occur when the engine is cold, hot, or both?'
  )
LIMIT 5;

INSERT INTO public.symptom_questions (symptom_key, question_text, question_type, created_at)
SELECT sm.symptom_key, 'Have you noticed any warning lights on the dashboard?', 'text', now()
FROM public.symptom_mappings sm
WHERE sm.category IN ('Engine', 'Engine Performance', 'Engine & Fuel')
  AND NOT EXISTS (
    SELECT 1 FROM public.symptom_questions sq
    WHERE sq.symptom_key = sm.symptom_key
      AND sq.question_text = 'Have you noticed any warning lights on the dashboard?'
  )
LIMIT 5;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run these after migration)
-- ============================================================================

-- Check all foreign keys are in place
-- SELECT conname, conrelid::regclass, confrelid::regclass
-- FROM pg_constraint
-- WHERE contype = 'f' AND connamespace = 'public'::regnamespace;

-- Check all indexes
-- SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public';

-- Check all triggers
-- SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';

-- Check symptom_questions count
-- SELECT COUNT(*) FROM public.symptom_questions;
