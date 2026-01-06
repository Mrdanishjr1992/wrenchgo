-- =====================================================
-- MIGRATION 3: MECHANIC AND SYMPTOM TABLES
-- =====================================================
-- Purpose: mechanic_profiles, skills, tools, safety, symptoms, symptom_mappings
-- =====================================================

BEGIN;

-- =====================================================
-- TABLE: mechanic_profiles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_profiles (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio text,
  years_experience int,
  hourly_rate_cents int,
  service_radius_km double precision DEFAULT 50,
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

CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_available ON public.mechanic_profiles(is_available) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_rating ON public.mechanic_profiles(rating_avg DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.mechanic_profiles IS 'Extended profile for mechanics. id references profiles.id';

-- =====================================================
-- TABLE: mechanic_skills
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(mechanic_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_mechanic_skills_mechanic ON public.mechanic_skills(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_skills_name ON public.mechanic_skills(skill_name);

-- =====================================================
-- TABLE: mechanic_tools
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(mechanic_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_mechanic_tools_mechanic ON public.mechanic_tools(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_tools_name ON public.mechanic_tools(tool_name);

-- =====================================================
-- TABLE: mechanic_safety
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_safety (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  safety_measure text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(mechanic_id, safety_measure)
);

CREATE INDEX IF NOT EXISTS idx_mechanic_safety_mechanic ON public.mechanic_safety(mechanic_id);

-- =====================================================
-- TABLE: symptoms
-- =====================================================
CREATE TABLE IF NOT EXISTS public.symptoms (
  key text PRIMARY KEY,
  label text NOT NULL,
  icon text,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.symptoms IS 'Master list of vehicle symptoms with icons';

-- =====================================================
-- TABLE: symptom_mappings
-- =====================================================
CREATE TABLE IF NOT EXISTS public.symptom_mappings (
  symptom_key text PRIMARY KEY REFERENCES public.symptoms(key) ON DELETE CASCADE,
  symptom_label text NOT NULL,
  category text NOT NULL,
  risk_level text NOT NULL,
  quote_strategy text,
  customer_explainer text,
  required_skill_keys text[] DEFAULT '{}',
  suggested_tool_keys text[] DEFAULT '{}',
  required_safety_keys text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_symptom_mappings_category ON public.symptom_mappings(category);
CREATE INDEX IF NOT EXISTS idx_symptom_mappings_risk ON public.symptom_mappings(risk_level);

COMMENT ON TABLE public.symptom_mappings IS 'Detailed symptom information for job creation and mechanic matching';

COMMIT;
