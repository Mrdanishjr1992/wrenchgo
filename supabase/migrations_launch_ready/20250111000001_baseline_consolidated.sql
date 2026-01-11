-- =====================================================
-- CONSOLIDATED BASELINE SCHEMA
-- =====================================================
-- Purpose: Complete schema for fresh database installations
-- Version: Launch-ready (consolidates migrations 0001-0080)
-- 
-- USAGE: Apply this INSTEAD of running all migrations
--        for new environments. For existing environments,
--        continue using incremental migrations.
--
-- WARNING: This file is auto-generated from existing migrations.
--          Do not edit directly - regenerate from source migrations.
-- =====================================================

BEGIN;

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- PostGIS is optional - only create if available
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PostGIS extension not available - spatial features disabled';
END;
$$;

-- =====================================================
-- ENUMS
-- =====================================================
DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('customer', 'mechanic'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.theme_mode AS ENUM ('light', 'dark', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_status AS ENUM ('draft', 'searching', 'quoted', 'accepted', 'scheduled', 'in_progress', 'work_in_progress', 'completed', 'cancelled', 'disputed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quote_status AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'withdrawn'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.badge_category AS ENUM ('milestone', 'quality', 'reliability', 'skill', 'special'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.review_visibility AS ENUM ('hidden', 'visible', 'moderated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.moderation_status AS ENUM ('pending', 'approved', 'rejected', 'flagged'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.report_reason AS ENUM ('fake_review', 'harassment', 'spam', 'inappropriate', 'conflict_of_interest', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.message_action AS ENUM ('allowed', 'blocked', 'masked', 'warned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.violation_tier AS ENUM ('education', 'warning', 'restriction', 'review'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.chat_restriction_type AS ENUM ('none', 'soft_warning', 'contact_info_blocked', 'templated_only', 'read_only', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payout_method_status AS ENUM ('none', 'pending', 'active', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- profiles
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
  payout_method_status public.payout_method_status DEFAULT 'none' NOT NULL,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- vehicles
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

-- jobs
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

-- quote_requests
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

-- quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  price_cents int,
  estimated_hours numeric,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'withdrawn', 'rejected')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(job_id, mechanic_id)
);

-- reviews
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
  professionalism_rating int,
  communication_rating int,
  comment text,
  is_hidden boolean DEFAULT false,
  would_recommend boolean,
  visibility public.review_visibility DEFAULT 'hidden',
  made_visible_at timestamptz,
  visibility_reason text,
  blind_deadline timestamptz,
  moderation_status public.moderation_status DEFAULT 'approved',
  moderated_at timestamptz,
  moderated_by uuid REFERENCES public.profiles(id),
  moderation_note text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT reviews_overall_rating_range CHECK (overall_rating >= 1 AND overall_rating <= 5),
  CONSTRAINT reviews_performance_rating_range CHECK (performance_rating IS NULL OR (performance_rating >= 1 AND performance_rating <= 5)),
  CONSTRAINT reviews_timing_rating_range CHECK (timing_rating IS NULL OR (timing_rating >= 1 AND timing_rating <= 5)),
  CONSTRAINT reviews_cost_rating_range CHECK (cost_rating IS NULL OR (cost_rating >= 1 AND cost_rating <= 5)),
  CONSTRAINT reviews_professionalism_rating_range CHECK (professionalism_rating IS NULL OR (professionalism_rating >= 1 AND professionalism_rating <= 5)),
  CONSTRAINT reviews_communication_rating_range CHECK (communication_rating IS NULL OR (communication_rating >= 1 AND communication_rating <= 5)),
  UNIQUE(job_id, reviewer_id)
);

-- mechanic_profiles
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

-- =====================================================
-- LOOKUP TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.skills (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tools (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.safety_measures (
  key text PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.symptoms (
  key text PRIMARY KEY,
  label text NOT NULL,
  icon text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- JUNCTION TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mechanic_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_key text NOT NULL REFERENCES public.skills(key) ON DELETE CASCADE,
  verified_job_count int DEFAULT 0,
  avg_job_rating numeric(3,2),
  last_verified_at timestamptz,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(mechanic_id, skill_key)
);

CREATE TABLE IF NOT EXISTS public.mechanic_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tool_key text NOT NULL REFERENCES public.tools(key) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(mechanic_id, tool_key)
);

CREATE TABLE IF NOT EXISTS public.mechanic_safety (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  safety_key text NOT NULL REFERENCES public.safety_measures(key) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(mechanic_id, safety_key)
);

-- =====================================================
-- SYMPTOM TABLES
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

-- =====================================================
-- MESSAGING & NOTIFICATIONS
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

-- =====================================================
-- MEDIA & STORAGE
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

-- =====================================================
-- STRIPE / PAYMENTS
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

-- =====================================================
-- BADGES & TRUST
-- =====================================================

CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  badge_type text DEFAULT 'achievement',
  criteria_json jsonb,
  category text,
  tier int DEFAULT 1,
  criteria_type text,
  criteria_threshold numeric,
  criteria_window_days int,
  is_active boolean DEFAULT true,
  display_priority int DEFAULT 100,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  source text,
  awarded_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  awarded_reason text,
  revoked_at timestamptz,
  revoked_reason text,
  job_id uuid REFERENCES public.jobs(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.badge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  action text NOT NULL,
  reason text,
  triggered_by uuid REFERENCES public.profiles(id),
  job_id uuid REFERENCES public.jobs(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall_score int DEFAULT 50 NOT NULL,
  rating_score int DEFAULT 50,
  completion_score int DEFAULT 100,
  tenure_score int DEFAULT 0,
  verification_score int DEFAULT 0,
  last_calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- =====================================================
-- REVIEW MEDIA & REPORTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.review_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  url text NOT NULL,
  thumbnail_url text,
  media_type text DEFAULT 'image',
  caption text,
  sort_order int DEFAULT 0,
  is_before boolean DEFAULT false,
  moderation_status public.moderation_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason public.report_reason NOT NULL,
  details text,
  status public.moderation_status DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  resolution_note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(review_id, reported_by)
);

CREATE TABLE IF NOT EXISTS public.skill_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_key text NOT NULL REFERENCES public.skills(key) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_rating int,
  verification_weight numeric DEFAULT 1,
  verified_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(mechanic_id, skill_key, job_id)
);

-- =====================================================
-- CHAT MODERATION
-- =====================================================

CREATE TABLE IF NOT EXISTS public.message_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_content text NOT NULL,
  displayed_content text,
  patterns_detected text[],
  risk_score numeric(5,2),
  action_taken public.message_action NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_stage text,
  sender_account_age_days int,
  sender_completed_jobs int,
  sender_previous_violations int,
  flagged_for_review boolean DEFAULT false,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_decision text,
  review_notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  violation_type text NOT NULL,
  tier public.violation_tier NOT NULL,
  description text,
  message_audit_log_id uuid REFERENCES public.message_audit_logs(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chat_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restriction_type public.chat_restriction_type NOT NULL,
  reason text,
  applies_to_all_chats boolean DEFAULT true,
  specific_conversation_id uuid,
  starts_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  requires_human_review boolean DEFAULT false,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.preferred_mechanics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jobs_completed int DEFAULT 0 NOT NULL,
  total_spent_cents bigint DEFAULT 0 NOT NULL,
  avg_rating numeric(3,2),
  last_job_at timestamptz,
  commission_tier int DEFAULT 1 NOT NULL,
  priority_scheduling boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT preferred_mechanics_unique UNIQUE(customer_id, mechanic_id),
  CONSTRAINT preferred_mechanics_commission_tier_range CHECK (commission_tier >= 1 AND commission_tier <= 5)
);

CREATE TABLE IF NOT EXISTS public.chat_lifecycle_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL UNIQUE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  chat_opened_at timestamptz DEFAULT now() NOT NULL,
  job_completed_at timestamptz,
  chat_readonly_at timestamptz,
  chat_archived_at timestamptz,
  post_completion_window_hours int DEFAULT 48,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- SUPPORT SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('payments_refunds', 'job_issue', 'account_login', 'bug_app_problem', 'other')),
  message text NOT NULL,
  job_id uuid NULL,
  screenshot_url text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- RATING PROMPT SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_rating_prompt_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  has_rated boolean DEFAULT false NOT NULL,
  first_job_completed_at timestamptz,
  last_prompt_at timestamptz,
  prompt_count integer DEFAULT 0 NOT NULL,
  snooze_until timestamptz,
  last_push_at timestamptz,
  push_count integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- CHAT ATTACHMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.chat_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL,
  public_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMIT;
