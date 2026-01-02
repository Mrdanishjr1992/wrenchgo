-- =====================================================
-- BASELINE SCHEMA: Extensions, Types, Tables, FKs
-- =====================================================
-- Purpose: Create all database objects in dependency order
-- Safe for: supabase db reset

-- 1) EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- 2) ENUMS / TYPES
DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM (
    'searching',
    'quoted',
    'accepted',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.quote_request_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'expired',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.quote_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'expired',
    'canceled_by_customer',
    'canceled_by_mechanic'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3) TABLES (in dependency order)

-- profiles (no FK dependencies)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role text CHECK (role = ANY (ARRAY['customer'::text, 'mechanic'::text])),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  deleted_reason text,
  deletion_requested_by uuid,
  can_reapply boolean DEFAULT false,
  reapplication_notes text,
  id_photo_path text,
  id_status text DEFAULT 'none' CHECK (id_status = ANY (ARRAY['none'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  id_uploaded_at timestamptz,
  id_verified_at timestamptz,
  id_rejected_reason text,
  id_verified_by uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- mechanic_profiles (depends on auth.users)
CREATE TABLE IF NOT EXISTS public.mechanic_profiles (
  id uuid NOT NULL,
  business_name text,
  bio text,
  years_experience integer,
  service_radius_km integer DEFAULT 50,
  base_location_lat numeric,
  base_location_lng numeric,
  is_available boolean DEFAULT true,
  jobs_completed integer DEFAULT 0,
  average_rating numeric DEFAULT 0.00,
  total_reviews integer DEFAULT 0,
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mechanic_profiles_pkey PRIMARY KEY (id)
);

-- vehicles (depends on auth.users)
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  year integer NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  nickname text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicles_pkey PRIMARY KEY (id)
);

-- symptoms (no dependencies)
CREATE TABLE IF NOT EXISTS public.symptoms (
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text NOT NULL,
  CONSTRAINT symptoms_pkey PRIMARY KEY (key)
);

-- symptom_mappings (depends on symptoms)
CREATE TABLE IF NOT EXISTS public.symptom_mappings (
  symptom_key text NOT NULL UNIQUE,
  symptom_label text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY[
    'Engine'::text, 'Engine Performance'::text, 'Engine & Fuel'::text, 'Fuel System'::text,
    'Transmission'::text, 'Drivetrain'::text, 'Brakes'::text, 'Brake System'::text,
    'Electrical'::text, 'Electrical & Charging'::text, 'Battery'::text,
    'Cooling System'::text, 'Cooling'::text, 'Suspension'::text, 'Steering'::text,
    'Steering & Suspension'::text, 'Suspension & Steering'::text, 'HVAC'::text,
    'Climate Control'::text, 'Air Conditioning'::text, 'Exhaust'::text,
    'Exhaust & Emissions'::text, 'Emissions'::text, 'Tires'::text, 'Wheels'::text,
    'Tires & Wheels'::text, 'Wheels & Tires'::text, 'Lights'::text, 'Lighting'::text,
    'Body'::text, 'Interior'::text, 'Maintenance'::text, 'General Maintenance'::text,
    'Safety'::text, 'Safety Systems'::text, 'Other'::text, 'Unknown'::text
  ])),
  required_skill_keys text[] DEFAULT '{}',
  suggested_tool_keys text[] DEFAULT '{}',
  required_safety_keys text[] DEFAULT '{}',
  quote_strategy text DEFAULT 'diagnosis-first' CHECK (quote_strategy = ANY (ARRAY[
    'diagnosis-first'::text, 'diagnostic_only'::text, 'inspection_required'::text, 'fixed_simple'::text
  ])),
  risk_level text DEFAULT 'low',
  customer_explainer text,
  mechanic_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  id uuid NOT NULL UNIQUE,
  CONSTRAINT symptom_mappings_pkey PRIMARY KEY (symptom_key)
);

-- symptom_questions (depends on symptom_mappings)
CREATE TABLE IF NOT EXISTS public.symptom_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  symptom_key text NOT NULL,
  question_key text NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL,
  options jsonb,
  affects_safety boolean DEFAULT false,
  affects_quote boolean DEFAULT false,
  affects_tools boolean DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT symptom_questions_pkey PRIMARY KEY (id),
  CONSTRAINT symptom_questions_unique_key UNIQUE (symptom_key, question_key)
);

-- symptom_question_options (depends on symptom_questions)
CREATE TABLE IF NOT EXISTS public.symptom_question_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid,
  label text NOT NULL,
  order_index integer NOT NULL,
  CONSTRAINT symptom_question_options_pkey PRIMARY KEY (id)
);

-- symptom_refinements (depends on symptom_mappings)
CREATE TABLE IF NOT EXISTS public.symptom_refinements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  symptom_key text NOT NULL,
  question_key text NOT NULL,
  match_type text NOT NULL CHECK (match_type = ANY (ARRAY['equals'::text, 'in'::text, 'contains'::text, 'any'::text])),
  match_value jsonb,
  override_category text,
  override_risk_level text CHECK (override_risk_level IS NULL OR (override_risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
  override_quote_strategy text,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT symptom_refinements_pkey PRIMARY KEY (id),
  CONSTRAINT symptom_refinements_symptom_key_question_key_match_type_mat_key UNIQUE (symptom_key, question_key, match_type, match_value)
);

-- symptom_education (depends on symptoms)
CREATE TABLE IF NOT EXISTS public.symptom_education (
  symptom_key text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  is_it_safe text NOT NULL,
  what_we_check text NOT NULL,
  how_quotes_work text NOT NULL,
  CONSTRAINT symptom_education_pkey PRIMARY KEY (symptom_key)
);

-- education_cards (no FK in schema, but logically depends on symptoms)
CREATE TABLE IF NOT EXISTS public.education_cards (
  symptom_key text NOT NULL,
  card_key text NOT NULL,
  title text,
  summary text,
  why_it_happens text,
  what_we_check text,
  is_it_safe text,
  prep_before_visit text,
  quote_expectation text,
  red_flags text,
  order_index integer,
  id uuid NOT NULL,
  CONSTRAINT education_cards_pkey PRIMARY KEY (symptom_key, card_key),
  CONSTRAINT education_cards_symptom_card_unique UNIQUE (symptom_key, card_key)
);

-- skills (no dependencies)
CREATE TABLE IF NOT EXISTS public.skills (
  key text NOT NULL,
  label text NOT NULL,
  category text,
  is_mobile_safe boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT skills_pkey PRIMARY KEY (key)
);

-- tools (no dependencies)
CREATE TABLE IF NOT EXISTS public.tools (
  key text NOT NULL,
  label text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT tools_pkey PRIMARY KEY (key)
);

-- safety_measures (no dependencies)
CREATE TABLE IF NOT EXISTS public.safety_measures (
  key text NOT NULL,
  label text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT safety_measures_pkey PRIMARY KEY (key)
);

-- jobs (depends on auth.users, vehicles)
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  accepted_mechanic_id uuid,
  title text NOT NULL,
  description text NOT NULL,
  symptom_id uuid,
  location_lat numeric,
  location_lng numeric,
  location_address text,
  status public.job_status NOT NULL DEFAULT 'searching',
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  vehicle_id uuid,
  canceled_at timestamptz,
  canceled_by text CHECK (canceled_by = ANY (ARRAY['customer'::text, 'mechanic'::text, 'system'::text])),
  preferred_time text,
  CONSTRAINT jobs_pkey PRIMARY KEY (id)
);

-- quote_requests (depends on jobs, auth.users)
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  mechanic_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  price_cents integer NOT NULL,
  estimated_hours numeric,
  notes text,
  status public.quote_request_status NOT NULL DEFAULT 'pending',
  accepted_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz,
  canceled_by text CHECK (canceled_by = ANY (ARRAY['customer'::text, 'mechanic'::text, 'system'::text])),
  cancel_reason text,
  cancel_note text,
  cancellation_fee_cents integer CHECK (cancellation_fee_cents >= 0),
  CONSTRAINT quote_requests_pkey PRIMARY KEY (id)
);

-- quotes (depends on jobs, auth.users)
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  mechanic_id uuid NOT NULL,
  price_cents integer NOT NULL,
  estimated_hours numeric,
  notes text,
  status public.quote_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotes_pkey PRIMARY KEY (id)
);

-- messages (depends on jobs, auth.users)
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id)
);

-- 4) FOREIGN KEYS (added after all tables exist)

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_auth_id_fkey,
  ADD CONSTRAINT profiles_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_deletion_requested_by_fkey,
  ADD CONSTRAINT profiles_deletion_requested_by_fkey FOREIGN KEY (deletion_requested_by) REFERENCES auth.users(id);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_verified_by_fkey,
  ADD CONSTRAINT profiles_id_verified_by_fkey FOREIGN KEY (id_verified_by) REFERENCES auth.users(id);

ALTER TABLE public.mechanic_profiles
  DROP CONSTRAINT IF EXISTS mechanic_profiles_id_fkey,
  ADD CONSTRAINT mechanic_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_customer_id_fkey,
  ADD CONSTRAINT vehicles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.symptom_mappings
  DROP CONSTRAINT IF EXISTS symptom_mappings_symptom_key_fkey,
  ADD CONSTRAINT symptom_mappings_symptom_key_fkey FOREIGN KEY (symptom_key) REFERENCES public.symptoms(key);

ALTER TABLE public.symptom_questions
  DROP CONSTRAINT IF EXISTS symptom_questions_symptom_key_fkey,
  ADD CONSTRAINT symptom_questions_symptom_key_fkey FOREIGN KEY (symptom_key) REFERENCES public.symptom_mappings(symptom_key);

ALTER TABLE public.symptom_question_options
  DROP CONSTRAINT IF EXISTS symptom_question_options_question_id_fkey,
  ADD CONSTRAINT symptom_question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.symptom_questions(id) ON DELETE CASCADE;

ALTER TABLE public.symptom_education
  DROP CONSTRAINT IF EXISTS symptom_education_symptom_key_fkey,
  ADD CONSTRAINT symptom_education_symptom_key_fkey FOREIGN KEY (symptom_key) REFERENCES public.symptoms(key);

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_customer_id_fkey,
  ADD CONSTRAINT jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_accepted_mechanic_id_fkey,
  ADD CONSTRAINT jobs_accepted_mechanic_id_fkey FOREIGN KEY (accepted_mechanic_id) REFERENCES auth.users(id);

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_vehicle_id_fkey,
  ADD CONSTRAINT jobs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);

ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_job_id_fkey,
  ADD CONSTRAINT quote_requests_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_mechanic_id_fkey,
  ADD CONSTRAINT quote_requests_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES auth.users(id);

ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_customer_id_fkey,
  ADD CONSTRAINT quote_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id);

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_job_id_fkey,
  ADD CONSTRAINT quotes_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_mechanic_id_fkey,
  ADD CONSTRAINT quotes_mechanic_id_fkey FOREIGN KEY (mechanic_id) REFERENCES auth.users(id);

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_job_id_fkey,
  ADD CONSTRAINT messages_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
  ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id);

-- 5) COMMENTS
COMMENT ON TABLE public.profiles IS 'User profiles for both customers and mechanics';
COMMENT ON TABLE public.mechanic_profiles IS 'Extended profile data for mechanics only';
COMMENT ON TABLE public.vehicles IS 'Customer vehicles';
COMMENT ON TABLE public.jobs IS 'Service requests from customers';
COMMENT ON TABLE public.quote_requests IS 'Quote requests from mechanics for jobs';
COMMENT ON TABLE public.quotes IS 'Quotes from mechanics (legacy table, use quote_requests)';
COMMENT ON TABLE public.messages IS 'Messages between customers and mechanics';
COMMENT ON TABLE public.symptoms IS 'Master list of vehicle symptoms';
COMMENT ON TABLE public.symptom_mappings IS 'Symptom metadata and categorization';
COMMENT ON TABLE public.symptom_questions IS 'Follow-up questions for symptoms';
COMMENT ON TABLE public.symptom_refinements IS 'Rules to refine symptom categorization based on answers';
COMMENT ON TABLE public.education_cards IS 'Educational content cards for symptoms';
