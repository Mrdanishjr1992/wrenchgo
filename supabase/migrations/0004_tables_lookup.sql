-- ===================================================================
-- 0004_tables_lookup.sql (FIXED – DROP-IN)
-- ===================================================================

SET search_path = public, extensions;

-- =====================================================
-- SKILLS
-- =====================================================
CREATE TABLE IF NOT EXISTS skills (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- TOOLS
-- =====================================================
CREATE TABLE IF NOT EXISTS tools (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- SAFETY MEASURES
-- =====================================================
CREATE TABLE IF NOT EXISTS safety_measures (
  key text PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- SYMPTOMS
-- =====================================================
CREATE TABLE IF NOT EXISTS symptoms (
  key text PRIMARY KEY,
  label text NOT NULL,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- SYMPTOM → METADATA
-- =====================================================
-- =====================================================
-- SYMPTOM → METADATA
-- =====================================================
CREATE TABLE IF NOT EXISTS symptom_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key text NOT NULL REFERENCES symptoms(key) ON DELETE CASCADE,
  category text NOT NULL,
  risk_level text NOT NULL,
  quote_strategy text,
  customer_explainer text,
  mechanic_notes text,
  required_skill_keys text[] NOT NULL DEFAULT '{}',
  required_tool_keys text[] NOT NULL DEFAULT '{}',
  required_safety_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symptom_key)
);



-- =====================================================
-- EDUCATION CARDS
-- =====================================================
CREATE TABLE IF NOT EXISTS education_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key text NOT NULL REFERENCES symptoms(key) ON DELETE CASCADE,
  card_key text NOT NULL,
  title text NOT NULL,
  summary text,
  why_it_happens text,
  what_we_check text,
  is_it_safe text,
  prep_before_visit text,
  red_flags text,
  order_index int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symptom_key, card_key)
);

-- =====================================================
-- SYMPTOM QUESTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS symptom_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key text NOT NULL REFERENCES symptoms(key) ON DELETE CASCADE,
  question_key text NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL,
  options jsonb,
  affects_safety boolean NOT NULL DEFAULT false,
  affects_quote boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symptom_key, question_key)
);

-- =====================================================
-- ZIP CODES (PostGIS-safe)
-- =====================================================
CREATE TABLE IF NOT EXISTS zip_codes (
  zip varchar(10) PRIMARY KEY,
  lat decimal(9,6) NOT NULL,
  lng decimal(9,6) NOT NULL,
  city varchar(100),
  state varchar(2),
  location extensions.geography(Point, 4326)
    GENERATED ALWAYS AS (
      extensions.ST_SetSRID(
        extensions.ST_MakePoint(
          lng::double precision,
          lat::double precision
        ),
        4326
      )::extensions.geography
    ) STORED
);

-- =====================================================
-- SERVICE HUBS (PostGIS-safe)
-- =====================================================
CREATE TABLE IF NOT EXISTS service_hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  zip varchar(10) NOT NULL REFERENCES zip_codes(zip),
  lat decimal(9,6) NOT NULL,
  lng decimal(9,6) NOT NULL,
  max_radius_miles int NOT NULL DEFAULT 100,
  active_radius_miles int NOT NULL DEFAULT 25,
  invite_only boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  launch_date date,
  location extensions.geography(Point, 4326)
    GENERATED ALWAYS AS (
      extensions.ST_SetSRID(
        extensions.ST_MakePoint(
          lng::double precision,
          lat::double precision
        ),
        4326
      )::extensions.geography
    ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===================================================================
-- DROP-IN FIX: service_hubs.auto_expand_enabled
-- Safe to run multiple times
-- ===================================================================

SET search_path TO public, extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'service_hubs'
  ) THEN

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'service_hubs'
        AND column_name = 'auto_expand_enabled'
    ) THEN
      ALTER TABLE public.service_hubs
      ADD COLUMN auto_expand_enabled boolean NOT NULL DEFAULT false;
    END IF;

  END IF;
END $$;

-- =====================================================
-- WAITLIST
-- =====================================================
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  phone text,
  user_type text NOT NULL CHECK (user_type IN ('customer', 'mechanic')),
  zip varchar(10) NOT NULL REFERENCES zip_codes(zip),
  lat decimal(9,6),
  lng decimal(9,6),
  nearest_hub_id uuid REFERENCES service_hubs(id),
  distance_miles numeric(6,1),
  ring int,
  invited_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, zip)
);
-- ===================================================================
-- DROP-IN FIX: 0004_tables_lookup.sql (BADGES – ENUM-FREE, RESET-SAFE)
-- ===================================================================
SET search_path = public;

-- =====================================================
-- BADGES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'special'
    CHECK (category IN ('milestone','quality','reliability','skill','special')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- USER BADGES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, badge_id)
);

-- =====================================================
-- BADGE HISTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS public.badge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('awarded','revoked')),
  created_at timestamptz NOT NULL DEFAULT now()
);
