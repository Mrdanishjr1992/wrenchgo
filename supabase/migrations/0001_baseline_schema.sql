-- =====================================================
-- MIGRATION 0001: BASELINE SCHEMA
-- =====================================================
-- Purpose: Extensions, enums, and ALL tables
-- Run: First migration - no dependencies
-- =====================================================

BEGIN;

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA extensions;

-- =====================================================
-- ENUMS
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('customer', 'mechanic');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.theme_mode AS ENUM ('light', 'dark', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM (
    'draft',
    'searching',
    'quoted',
    'accepted',
    'scheduled',
    'in_progress',
    'work_in_progress',
    'completed',
    'cancelled',
    'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.quote_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'expired',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'refunded',
    'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TABLE: profiles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  display_name text,
  phone text,
  avatar_url text,
  role public.user_role,
  theme_preference public.theme_mode DEFAULT 'system',
  city text,
  state text,
  home_lat double precision,
  home_lng double precision,
  push_token text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.profiles IS 'User profiles for both customers and mechanics';

-- =====================================================
-- TABLE: vehicles
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
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT vehicles_year_check CHECK (year IS NULL OR (year >= 1900 AND year <= 2100))
);

COMMENT ON TABLE public.vehicles IS 'Customer vehicles';

-- =====================================================
-- TABLE: jobs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  accepted_mechanic_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status public.job_status DEFAULT 'draft' NOT NULL,
  symptom_key text,
  symptom_id text,
  location_lat double precision,
  location_lng double precision,
  location_address text,
  preferred_time text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  canceled_at timestamptz,
  canceled_by uuid REFERENCES public.profiles(id),
  final_price_cents int,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT jobs_positive_price CHECK (final_price_cents IS NULL OR final_price_cents >= 0)
);

COMMENT ON TABLE public.jobs IS 'Service jobs/requests from customers';

-- =====================================================
-- TABLE: quote_requests
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.quote_status DEFAULT 'pending' NOT NULL,
  price_cents int,
  message text,
  notes text,
  expires_at timestamptz,
  responded_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  canceled_at timestamptz,
  canceled_by uuid REFERENCES public.profiles(id),
  cancel_reason text,
  cancel_note text,
  cancellation_fee_cents int,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT quote_requests_positive_price CHECK (price_cents IS NULL OR price_cents >= 0)
);

COMMENT ON TABLE public.quote_requests IS 'Quotes from mechanics for jobs';

-- =====================================================
-- TABLE: quotes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  price_cents int,
  estimated_hours numeric,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'withdrawn')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(job_id, mechanic_id)
);

COMMENT ON TABLE public.quotes IS 'Mechanic quotes for jobs';

-- =====================================================
-- TABLE: reviews
-- =====================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_role public.user_role,
  overall_rating int NOT NULL,
  performance_rating int,
  timing_rating int,
  cost_rating int,
  comment text,
  is_hidden boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT reviews_overall_rating_range CHECK (overall_rating >= 1 AND overall_rating <= 5),
  CONSTRAINT reviews_performance_rating_range CHECK (performance_rating IS NULL OR (performance_rating >= 1 AND performance_rating <= 5)),
  CONSTRAINT reviews_timing_rating_range CHECK (timing_rating IS NULL OR (timing_rating >= 1 AND timing_rating <= 5)),
  CONSTRAINT reviews_cost_rating_range CHECK (cost_rating IS NULL OR (cost_rating >= 1 AND cost_rating <= 5)),
  UNIQUE(job_id, reviewer_id)
);

COMMENT ON TABLE public.reviews IS 'Reviews between users after job completion';

-- =====================================================
-- TABLE: mechanic_profiles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio text,
  years_experience int,
  hourly_rate_cents int,
  service_radius_km double precision DEFAULT 50,
  mobile_service boolean DEFAULT true,
  is_available boolean DEFAULT true,
  rating_avg numeric(3,2) DEFAULT 0.00,
  rating_count int DEFAULT 0,
  jobs_completed int DEFAULT 0,
  stripe_account_id text,
  stripe_onboarding_complete boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT mechanic_profiles_positive_rate CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents >= 0),
  CONSTRAINT mechanic_profiles_valid_rating CHECK (rating_avg >= 0 AND rating_avg <= 5)
);

COMMENT ON TABLE public.mechanic_profiles IS 'Extended profile for mechanics';

-- =====================================================
-- LOOKUP TABLE: skills
-- =====================================================
CREATE TABLE IF NOT EXISTS public.skills (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.skills IS 'Master lookup table for mechanic skills';

-- =====================================================
-- LOOKUP TABLE: tools
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tools (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.tools IS 'Master lookup table for mechanic tools';

-- =====================================================
-- LOOKUP TABLE: safety_measures
-- =====================================================
CREATE TABLE IF NOT EXISTS public.safety_measures (
  key text PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.safety_measures IS 'Master lookup table for safety measures';

-- =====================================================
-- TABLE: mechanic_skills (junction)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_key text NOT NULL REFERENCES public.skills(key) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(mechanic_id, skill_key)
);

COMMENT ON TABLE public.mechanic_skills IS 'Skills a mechanic has';

-- =====================================================
-- TABLE: mechanic_tools (junction)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tool_key text NOT NULL REFERENCES public.tools(key) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(mechanic_id, tool_key)
);

COMMENT ON TABLE public.mechanic_tools IS 'Tools a mechanic has';

-- =====================================================
-- TABLE: mechanic_safety (junction)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_safety (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  safety_key text NOT NULL REFERENCES public.safety_measures(key) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(mechanic_id, safety_key)
);

COMMENT ON TABLE public.mechanic_safety IS 'Safety measures a mechanic follows';

-- =====================================================
-- TABLE: symptoms
-- =====================================================
CREATE TABLE IF NOT EXISTS public.symptoms (
  key text PRIMARY KEY,
  label text NOT NULL,
  icon text,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.symptoms IS 'Master list of vehicle symptoms';

-- =====================================================
-- TABLE: symptom_mappings
-- =====================================================
CREATE TABLE IF NOT EXISTS public.symptom_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key text UNIQUE NOT NULL REFERENCES public.symptoms(key) ON DELETE CASCADE,
  symptom_label text NOT NULL,
  category text NOT NULL,
  risk_level text NOT NULL,
  quote_strategy text,
  customer_explainer text,
  mechanic_notes text,
  required_skill_keys text[] DEFAULT '{}',
  suggested_tool_keys text[] DEFAULT '{}',
  required_safety_keys text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.symptom_mappings IS 'Detailed symptom information for jobs';

-- =====================================================
-- TABLE: education_cards
-- =====================================================
CREATE TABLE IF NOT EXISTS public.education_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key text NOT NULL REFERENCES public.symptoms(key) ON DELETE CASCADE,
  card_key text NOT NULL,
  title text NOT NULL,
  summary text,
  why_it_happens text,
  what_we_check text,
  is_it_safe text,
  prep_before_visit text,
  quote_expectation text,
  red_flags text,
  order_index int DEFAULT 1,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(symptom_key, card_key)
);

COMMENT ON TABLE public.education_cards IS 'Education cards for symptoms';

-- =====================================================
-- TABLE: symptom_education
-- =====================================================
CREATE TABLE IF NOT EXISTS public.symptom_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key text UNIQUE NOT NULL REFERENCES public.symptoms(key) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  is_it_safe text,
  what_we_check text,
  how_quotes_work text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.symptom_education IS 'Education guides for symptoms';

-- =====================================================
-- TABLE: symptom_questions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.symptom_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key text NOT NULL REFERENCES public.symptoms(key) ON DELETE CASCADE,
  question_key text NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL,
  options jsonb,
  affects_safety boolean DEFAULT false,
  affects_quote boolean DEFAULT false,
  display_order int DEFAULT 1,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(symptom_key, question_key)
);

COMMENT ON TABLE public.symptom_questions IS 'Diagnostic questions for symptoms';

-- =====================================================
-- TABLE: messages
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.messages IS 'Messages between users for a job';

-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text,
  entity_type text,
  entity_id uuid,
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false NOT NULL,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.notifications IS 'User notifications';

-- =====================================================
-- TABLE: media_assets
-- =====================================================
CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE,
  bucket text DEFAULT 'media',
  path text,
  public_url text,
  content_type text,
  size_bytes bigint,
  duration_seconds double precision,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.media_assets IS 'Media files (images, videos) for jobs and app content';

-- =====================================================
-- TABLE: mechanic_stripe_accounts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_stripe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_account_id text UNIQUE NOT NULL,
  onboarding_complete boolean DEFAULT false,
  charges_enabled boolean DEFAULT false,
  payouts_enabled boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.mechanic_stripe_accounts IS 'Stripe Connect accounts for mechanics';

-- =====================================================
-- TABLE: customer_payment_methods
-- =====================================================
CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_payment_method_id text UNIQUE NOT NULL,
  is_default boolean DEFAULT false,
  card_brand text,
  card_last4 text,
  card_exp_month int,
  card_exp_year int,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.customer_payment_methods IS 'Saved payment methods for customers';

-- =====================================================
-- TABLE: payments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_intent_id text UNIQUE,
  amount_cents int NOT NULL,
  platform_fee_cents int DEFAULT 0,
  status public.payment_status DEFAULT 'pending' NOT NULL,
  paid_at timestamptz,
  refunded_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT payments_positive_amount CHECK (amount_cents > 0)
);

COMMENT ON TABLE public.payments IS 'Payment records for jobs';

-- =====================================================
-- TABLE: badges
-- =====================================================
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  badge_type text DEFAULT 'achievement',
  criteria_json jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.badges IS 'Master lookup table for badges';

-- =====================================================
-- TABLE: user_badges
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  source text,
  awarded_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(user_id, badge_id)
);

COMMENT ON TABLE public.user_badges IS 'Badges awarded to users';

COMMIT;
