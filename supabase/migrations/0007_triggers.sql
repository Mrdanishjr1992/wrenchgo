-- ===================================================================
-- WrenchGo: baseline split (triggers)
-- Generated: 2026-01-22
-- Source: reset-baseline
-- Run these files in order (0001 -> 0011).
-- ===================================================================

SET search_path TO public, extensions;


-- =====================================================
-- UPDATED_AT triggers
-- =====================================================
DO $$
BEGIN
  -- profiles
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_set_updated_at') THEN
    CREATE TRIGGER trg_profiles_set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- vehicles
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vehicles_set_updated_at') THEN
    CREATE TRIGGER trg_vehicles_set_updated_at
    BEFORE UPDATE ON public.vehicles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- mechanic_profiles
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mechanic_profiles_set_updated_at') THEN
    CREATE TRIGGER trg_mechanic_profiles_set_updated_at
    BEFORE UPDATE ON public.mechanic_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- jobs
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_jobs_set_updated_at') THEN
    CREATE TRIGGER trg_jobs_set_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- quotes
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_quotes_set_updated_at') THEN
    CREATE TRIGGER trg_quotes_set_updated_at
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- job_contracts
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_job_contracts_set_updated_at') THEN
    CREATE TRIGGER trg_job_contracts_set_updated_at
    BEFORE UPDATE ON public.job_contracts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- job_progress
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_job_progress_set_updated_at') THEN
    CREATE TRIGGER trg_job_progress_set_updated_at
    BEFORE UPDATE ON public.job_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- =====================================================
-- Auth trigger: create profile on signup
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
