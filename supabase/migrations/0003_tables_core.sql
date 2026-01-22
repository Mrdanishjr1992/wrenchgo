-- ===================================================================
-- WrenchGo: baseline split (tables - core)
-- Generated: 2026-01-22
-- Source: reset-baseline
-- Run these files in order (0001 -> 0011).
-- ===================================================================

SET search_path TO public, extensions;


-- Core tables only (reset-safe).
-- Design goals:
-- - Minimal surface area that still supports the app’s core flow.
-- - No duplicated state: each concept has exactly one home.
-- - No dead columns: every column is used by the product flow or by governance (auditability).

-- =====================================================
-- TABLE: profiles
-- Why it exists:
-- - 1 row per auth user for app-facing identity + preferences.
-- - We keep auth in auth.users, and app profile data here.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity / contact (non-auth)
  email text,
  full_name text,
  display_name text,
  phone text,
  avatar_url text,

  -- Role & preferences
  role public.user_role NOT NULL DEFAULT 'customer',
  theme_preference public.theme_mode NOT NULL DEFAULT 'system',

  -- Customer “home base” (used for prefill + proximity search)
  city text,
  state text,
  home_lat double precision,
  home_lng double precision,

  -- Notifications
  push_token text,

  -- Soft delete for user-initiated deletion requests
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profiles_valid_lat CHECK (home_lat IS NULL OR (home_lat BETWEEN -90 AND 90)),
  CONSTRAINT profiles_valid_lng CHECK (home_lng IS NULL OR (home_lng BETWEEN -180 AND 180))
);

-- =====================================================
-- TABLE: vehicles
-- Why it exists:
-- - Customer-owned vehicles to avoid re-entering details per job.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  year int,
  make text,
  model text,
  nickname text,
  vin text,
  license_plate text,
  color text,
  notes text,

  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vehicles_year_check CHECK (year IS NULL OR (year BETWEEN 1900 AND 2100))
);

-- =====================================================
-- TABLE: mechanic_profiles
-- Why it exists:
-- - Mechanic-specific attributes that should not live on the base profile.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  bio text,
  years_experience int,
  hourly_rate_cents int,

  -- Availability
  is_available boolean NOT NULL DEFAULT true,
  mobile_service boolean NOT NULL DEFAULT true,
  service_radius_km double precision NOT NULL DEFAULT 50,

  -- Reputation snapshot (can be recalculated later; stored for fast reads)
  rating_avg numeric(3,2) NOT NULL DEFAULT 0.00,
  rating_count int NOT NULL DEFAULT 0,
  jobs_completed int NOT NULL DEFAULT 0,

  -- Payout setup
  stripe_account_id text,
  stripe_onboarding_complete boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mechanic_profiles_positive_rate CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents >= 0),
  CONSTRAINT mechanic_profiles_rating_range CHECK (rating_avg BETWEEN 0 AND 5)
);

-- =====================================================
-- TABLE: jobs
-- Why it exists:
-- - Primary workflow object: customer request -> scheduling -> completion.
-- - Scheduling source of truth stays on jobs (scheduled_at).
-- - Location is represented once as (job_lat, job_lng) + generated geography for spatial search.
-- =====================================================
-- =====================================================
-- DROP-IN FIX: jobs (PostGIS-safe)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  accepted_mechanic_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  title text NOT NULL,
  description text,

  status public.job_status NOT NULL DEFAULT 'draft',
  symptom_key text,

  job_lat decimal(9,6),
  job_lng decimal(9,6),

  job_location extensions.geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN job_lat IS NOT NULL AND job_lng IS NOT NULL THEN
        extensions.ST_SetSRID(
          extensions.ST_MakePoint(
            job_lng::double precision,
            job_lat::double precision
          ),
          4326
        )::extensions.geography
    END
  ) STORED,

  location_address text,

  preferred_time text,
  scheduled_at timestamptz,

  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles(id),

  final_price_cents int,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT jobs_positive_price CHECK (final_price_cents IS NULL OR final_price_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.platform_terms_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text UNIQUE NOT NULL,
  role text NOT NULL,
  title text NOT NULL,
  summary text,
  full_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- TABLE: quotes
-- Why it exists:
-- - Mechanic offers for a job. One quote per mechanic per job.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  price_cents int,
  estimated_hours numeric,
  notes text,

  status public.quote_status NOT NULL DEFAULT 'pending',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quotes_positive_price CHECK (price_cents IS NULL OR price_cents >= 0),
  UNIQUE(job_id, mechanic_id)
);

-- =====================================================
-- TABLE: job_contracts
-- Why it exists:
-- - Immutable snapshot once a quote is accepted.
-- - Separates “agreement” from a mutable quote.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.job_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  status public.contract_status NOT NULL DEFAULT 'pending_payment',

  -- Snapshot amounts at acceptance
  quoted_price_cents int NOT NULL,
  platform_fee_cents int NOT NULL DEFAULT 1500,

  -- Totals (can be re-derived later; stored for fast reads)
  subtotal_cents int NOT NULL,
  total_customer_cents int NOT NULL,
  mechanic_commission_cents int NOT NULL,
  mechanic_payout_cents int NOT NULL,

  -- Terms versioning
  terms_version text NOT NULL DEFAULT '2026.01',
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),

  -- Cancellation
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles(id),
  cancellation_reason public.cancellation_reason,
  cancellation_note text,
  refund_amount_cents int,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(job_id),
  UNIQUE(quote_id),

  CONSTRAINT job_contracts_positive_amounts CHECK (
    quoted_price_cents >= 0 AND
    platform_fee_cents >= 0 AND
    subtotal_cents >= 0 AND
    total_customer_cents >= 0 AND
    mechanic_commission_cents >= 0 AND
    mechanic_payout_cents >= 0
  )
);

-- =====================================================
-- TABLE: job_progress
-- Why it exists:
-- - Fine-grained milestone timestamps without bloating jobs.
-- - Allows dual-confirm completion in the future.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.job_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid UNIQUE NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.job_contracts(id) ON DELETE SET NULL,

  mechanic_departed_at timestamptz,
  mechanic_arrived_at timestamptz,
  customer_confirmed_arrival_at timestamptz,
  work_started_at timestamptz,

  mechanic_completed_at timestamptz,
  customer_completed_at timestamptz,
  finalized_at timestamptz,

  estimated_arrival_at timestamptz,
  actual_work_duration_minutes int,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

