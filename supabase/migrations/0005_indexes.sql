-- ===================================================================
-- WrenchGo: baseline split (indexes)
-- Generated: 2026-01-22
-- Source: reset-baseline
-- Run these files in order (0001 -> 0011).
-- ===================================================================

SET search_path TO public, extensions;


-- Indexes are designed to match 0003_tables_core.sql exactly.
-- No index references a column that doesn't exist.

-- =====================================================
-- PROFILES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role_active
  ON public.profiles(role)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email_active
  ON public.profiles(email)
  WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_home_location_active
  ON public.profiles(home_lat, home_lng)
  WHERE deleted_at IS NULL AND home_lat IS NOT NULL AND home_lng IS NOT NULL;

-- =====================================================
-- VEHICLES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_active
  ON public.vehicles(customer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_vin_active
  ON public.vehicles(vin)
  WHERE deleted_at IS NULL AND vin IS NOT NULL;

-- =====================================================
-- MECHANIC_PROFILES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_available
  ON public.mechanic_profiles(is_available);

CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_rating
  ON public.mechanic_profiles(rating_avg DESC);

CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_stripe
  ON public.mechanic_profiles(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- =====================================================
-- JOBS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_jobs_customer
  ON public.jobs(customer_id);

CREATE INDEX IF NOT EXISTS idx_jobs_mechanic
  ON public.jobs(accepted_mechanic_id)
  WHERE accepted_mechanic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_status
  ON public.jobs(status);

CREATE INDEX IF NOT EXISTS idx_jobs_created
  ON public.jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at
  ON public.jobs(scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- Spatial (PostGIS)
CREATE INDEX IF NOT EXISTS idx_jobs_location_gix
  ON public.jobs
  USING GIST(job_location);

-- =====================================================
-- QUOTES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_quotes_job
  ON public.quotes(job_id);

CREATE INDEX IF NOT EXISTS idx_quotes_mechanic
  ON public.quotes(mechanic_id);

CREATE INDEX IF NOT EXISTS idx_quotes_status
  ON public.quotes(status);

-- =====================================================
-- JOB_CONTRACTS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_job_contracts_customer
  ON public.job_contracts(customer_id);

CREATE INDEX IF NOT EXISTS idx_job_contracts_mechanic
  ON public.job_contracts(mechanic_id);

CREATE INDEX IF NOT EXISTS idx_job_contracts_status
  ON public.job_contracts(status);

CREATE INDEX IF NOT EXISTS idx_job_contracts_created
  ON public.job_contracts(created_at DESC);

-- =====================================================
-- JOB_PROGRESS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_job_progress_contract
  ON public.job_progress(contract_id)
  WHERE contract_id IS NOT NULL;
