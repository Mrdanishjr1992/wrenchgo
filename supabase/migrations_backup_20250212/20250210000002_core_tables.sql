-- =====================================================
-- CORE TABLES (PRODUCTION-READY)
-- =====================================================
-- Purpose: profiles, jobs, vehicles, reviews, quote_requests
-- Identity Model: profiles.id == auth.users.id (Option A)
-- =====================================================

BEGIN;

-- =====================================================
-- TABLE: profiles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  role public.user_role,
  theme_preference public.theme_mode DEFAULT 'system',
  home_lat double precision,
  home_lng double precision,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.profiles IS 'Main user profile table. id maps directly to auth.users.id';
COMMENT ON COLUMN public.profiles.theme_preference IS 'Per-account theme setting (light/dark/system)';

-- =====================================================
-- TABLE: vehicles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year int,
  make text,
  model text,
  vin text,
  license_plate text,
  color text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON public.vehicles(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON public.vehicles(vin) WHERE deleted_at IS NULL AND vin IS NOT NULL;

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
  
  location_lat double precision,
  location_lng double precision,
  location_address text,
  
  scheduled_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  
  final_price_cents int,
  
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT jobs_customer_not_mechanic CHECK (customer_id != accepted_mechanic_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_customer ON public.jobs(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_mechanic ON public.jobs(accepted_mechanic_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_created ON public.jobs(created_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.jobs IS 'Job requests from customers. customer_id and accepted_mechanic_id reference profiles.id';

-- =====================================================
-- TABLE: quote_requests
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  status public.quote_status DEFAULT 'pending' NOT NULL,
  price_cents int NOT NULL,
  message text,
  
  expires_at timestamptz,
  responded_at timestamptz,
  
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT quote_requests_positive_price CHECK (price_cents > 0),
  CONSTRAINT quote_requests_customer_not_mechanic CHECK (customer_id != mechanic_id)
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_job ON public.quote_requests(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_requests_mechanic ON public.quote_requests(mechanic_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer ON public.quote_requests(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON public.quote_requests(status) WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE: reviews
-- =====================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT reviews_reviewer_not_reviewee CHECK (reviewer_id != reviewee_id),
  UNIQUE(job_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_job ON public.reviews(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating) WHERE deleted_at IS NULL;

COMMIT;
