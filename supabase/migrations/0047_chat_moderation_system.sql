-- =====================================================
-- MIGRATION 0047: CHAT MODERATION & PLATFORM PROTECTION
-- =====================================================
-- Purpose: Implement anti-circumvention controls, chat lifecycle management,
--          and preferred mechanic system to prevent platform bypass
-- =====================================================

BEGIN;

-- =====================================================
-- ENUM TYPES
-- =====================================================

DO $$ BEGIN
  CREATE TYPE public.message_action AS ENUM (
    'allowed',
    'blocked',
    'masked',
    'warned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.violation_tier AS ENUM (
    'education',
    'warning',
    'restriction',
    'review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.chat_restriction_type AS ENUM (
    'none',
    'soft_warning',
    'contact_info_blocked',
    'templated_only',
    'read_only',
    'suspended'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TABLE: message_audit_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.message_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Message content
  original_content text NOT NULL,
  displayed_content text,
  
  -- Detection details
  patterns_detected text[],
  risk_score numeric(5,2),
  action_taken public.message_action NOT NULL,
  
  -- Context
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_stage text,
  sender_account_age_days int,
  sender_completed_jobs int,
  sender_previous_violations int,
  
  -- Review
  flagged_for_review boolean DEFAULT false,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_decision text,
  review_notes text,
  
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_audit_sender ON public.message_audit_logs(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_audit_conversation ON public.message_audit_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_audit_flagged ON public.message_audit_logs(flagged_for_review) WHERE flagged_for_review = true;
CREATE INDEX IF NOT EXISTS idx_message_audit_job ON public.message_audit_logs(job_id) WHERE job_id IS NOT NULL;

COMMENT ON TABLE public.message_audit_logs IS 'Audit trail for message moderation and contact info detection';

-- =====================================================
-- TABLE: user_violations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Violation details
  violation_type text NOT NULL,
  tier public.violation_tier NOT NULL,
  description text,
  
  -- Context
  message_audit_log_id uuid REFERENCES public.message_audit_logs(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  
  -- Resolution
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  expires_at timestamptz,
  
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_violations_user ON public.user_violations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_violations_active ON public.user_violations(user_id, expires_at);

COMMENT ON TABLE public.user_violations IS 'Track user violations for progressive enforcement';

-- =====================================================
-- TABLE: chat_restrictions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chat_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Restriction details
  restriction_type public.chat_restriction_type NOT NULL,
  reason text,
  
  -- Scope
  applies_to_all_chats boolean DEFAULT true,
  specific_conversation_id uuid,
  
  -- Duration
  starts_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  
  -- Review
  requires_human_review boolean DEFAULT false,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_restrictions_user ON public.chat_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_restrictions_active ON public.chat_restrictions(user_id, expires_at);

COMMENT ON TABLE public.chat_restrictions IS 'Active chat restrictions for users';

-- =====================================================
-- TABLE: preferred_mechanics
-- =====================================================
CREATE TABLE IF NOT EXISTS public.preferred_mechanics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Relationship metrics
  jobs_completed int DEFAULT 0 NOT NULL,
  total_spent_cents bigint DEFAULT 0 NOT NULL,
  avg_rating numeric(3,2),
  last_job_at timestamptz,
  
  -- Benefits
  commission_tier int DEFAULT 1 NOT NULL,
  priority_scheduling boolean DEFAULT false,
  
  -- Status
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT preferred_mechanics_unique UNIQUE(customer_id, mechanic_id),
  CONSTRAINT preferred_mechanics_commission_tier_range CHECK (commission_tier >= 1 AND commission_tier <= 5)
);

CREATE INDEX IF NOT EXISTS idx_preferred_mechanics_customer ON public.preferred_mechanics(customer_id, is_active);
CREATE INDEX IF NOT EXISTS idx_preferred_mechanics_mechanic ON public.preferred_mechanics(mechanic_id, is_active);
CREATE INDEX IF NOT EXISTS idx_preferred_mechanics_tier ON public.preferred_mechanics(commission_tier);

COMMENT ON TABLE public.preferred_mechanics IS 'Track preferred mechanic relationships for reduced commissions';

-- =====================================================
-- TABLE: chat_lifecycle_config
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chat_lifecycle_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL UNIQUE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- Lifecycle timestamps
  chat_opened_at timestamptz DEFAULT now() NOT NULL,
  job_completed_at timestamptz,
  chat_readonly_at timestamptz,
  chat_archived_at timestamptz,
  
  -- Configuration
  post_completion_window_hours int DEFAULT 48,
  readonly_period_days int DEFAULT 30,
  
  -- Flags
  has_safety_issue boolean DEFAULT false,
  has_dispute boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_lifecycle_conversation ON public.chat_lifecycle_config(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_lifecycle_job ON public.chat_lifecycle_config(job_id);

COMMENT ON TABLE public.chat_lifecycle_config IS 'Manage chat lifecycle based on job stage';

-- =====================================================
-- FUNCTION: detect_contact_info
-- =====================================================
CREATE OR REPLACE FUNCTION public.detect_contact_info(message_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  patterns_found text[] := '{}';
  risk_score numeric := 0;
BEGIN
  -- Phone number patterns
  IF message_text ~* '(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}' THEN
    patterns_found := array_append(patterns_found, 'phone');
    risk_score := risk_score + 30;
  END IF;
  
  -- Email patterns
  IF message_text ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' THEN
    patterns_found := array_append(patterns_found, 'email');
    risk_score := risk_score + 30;
  END IF;
  
  -- Social media patterns
  IF message_text ~* '(instagram|facebook|whatsapp|telegram|snapchat|twitter|tiktok)[\s:@]?[\w.]+' THEN
    patterns_found := array_append(patterns_found, 'social');
    risk_score := risk_score + 25;
  END IF;
  
  -- URL patterns
  IF message_text ~* '(https?://|www\.)[^\s]+' THEN
    patterns_found := array_append(patterns_found, 'url');
    risk_score := risk_score + 20;
  END IF;
  
  -- Obfuscation patterns - spaced digits
  IF message_text ~* '\d[\s.]{1,3}\d[\s.]{1,3}\d[\s.]{1,3}\d[\s.]{1,3}\d' THEN
    patterns_found := array_append(patterns_found, 'obfuscated_phone');
    risk_score := risk_score + 40;
  END IF;
  
  -- Obfuscation patterns - word numbers
  IF message_text ~* '(zero|one|two|three|four|five|six|seven|eight|nine)[\s-]+(zero|one|two|three|four|five|six|seven|eight|nine)' THEN
    patterns_found := array_append(patterns_found, 'obfuscated_numbers');
    risk_score := risk_score + 35;
  END IF;
  
  -- Obfuscation patterns - at/dot
  IF message_text ~* '(\bat\b|\[at\]|\(at\)).*(\bdot\b|\[dot\]|\(dot\))' THEN
    patterns_found := array_append(patterns_found, 'obfuscated_email');
    risk_score := risk_score + 35;
  END IF;
  
  RETURN jsonb_build_object(
    'patterns_detected', patterns_found,
    'risk_score', LEAST(risk_score, 100),
    'has_contact_info', array_length(patterns_found, 1) > 0
  );
END;
$$;

COMMENT ON FUNCTION public.detect_contact_info IS 'Detect contact information and obfuscation patterns in messages';

-- =====================================================
-- FUNCTION: check_legitimate_patterns
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_legitimate_patterns(message_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Part numbers (often look like phone numbers)
  IF message_text ~* 'part\s*#?\s*\d{3}[-.\s]?\d{3}[-.\s]?\d{4}' THEN
    RETURN true;
  END IF;
  
  -- VIN numbers
  IF message_text ~* '\b[A-HJ-NPR-Z0-9]{17}\b' THEN
    RETURN true;
  END IF;
  
  -- License plates
  IF message_text ~* 'plate\s*#?\s*[A-Z0-9]{2,8}' THEN
    RETURN true;
  END IF;
  
  -- Addresses (legitimate for mobile mechanics)
  IF message_text ~* '\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|circle|blvd|boulevard)' THEN
    RETURN true;
  END IF;
  
  -- Time references
  IF message_text ~* '\d{1,2}:\d{2}\s*(?:am|pm)?' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.check_legitimate_patterns IS 'Check if message contains legitimate patterns that look like contact info';

-- =====================================================
-- FUNCTION: calculate_message_risk
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_message_risk(
  p_message_text text,
  p_sender_id uuid,
  p_job_id uuid,
  p_job_stage text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detection_result jsonb;
  v_is_legitimate boolean;
  v_sender_age_days int;
  v_completed_jobs int;
  v_recent_violations int;
  v_final_risk_score numeric;
  v_action public.message_action;
  v_restriction_level text;
BEGIN
  -- Detect contact info patterns
  v_detection_result := detect_contact_info(p_message_text);
  
  -- Check for legitimate patterns
  v_is_legitimate := check_legitimate_patterns(p_message_text);
  
  -- If legitimate pattern detected, allow with low risk
  IF v_is_legitimate THEN
    RETURN jsonb_build_object(
      'risk_level', 'low',
      'risk_score', 0,
      'action', 'allowed',
      'patterns_detected', '{}',
      'reason', 'legitimate_pattern'
    );
  END IF;
  
  -- If no contact info detected, allow
  IF NOT (v_detection_result->>'has_contact_info')::boolean THEN
    RETURN jsonb_build_object(
      'risk_level', 'low',
      'risk_score', 0,
      'action', 'allowed',
      'patterns_detected', '{}',
      'reason', 'no_contact_info'
    );
  END IF;
  
  -- Get sender context
  SELECT
    EXTRACT(DAY FROM (now() - p.created_at))::int,
    COALESCE(COUNT(DISTINCT j.id), 0)
  INTO v_sender_age_days, v_completed_jobs
  FROM profiles p
  LEFT JOIN jobs j ON (j.customer_id = p.id OR j.accepted_mechanic_id = p.id)
    AND j.status = 'completed'
  WHERE p.id = p_sender_id
  GROUP BY p.created_at;
  
  -- Get recent violations (last 30 days)
  SELECT COUNT(*)::int
  INTO v_recent_violations
  FROM user_violations
  WHERE user_id = p_sender_id
    AND created_at > now() - interval '30 days';
  
  -- Calculate final risk score
  v_final_risk_score := (v_detection_result->>'risk_score')::numeric;
  
  -- Adjust based on user context
  IF v_sender_age_days < 7 THEN
    v_final_risk_score := v_final_risk_score + 15;
  END IF;
  
  IF v_completed_jobs = 0 THEN
    v_final_risk_score := v_final_risk_score + 10;
  ELSIF v_completed_jobs >= 10 THEN
    v_final_risk_score := v_final_risk_score - 15;
  END IF;
  
  IF v_recent_violations > 0 THEN
    v_final_risk_score := v_final_risk_score + (v_recent_violations * 10);
  END IF;
  
  -- Adjust based on job stage
  IF p_job_stage IN ('lead', 'quote_submitted') THEN
    -- Pre-booking: highest risk
    v_final_risk_score := v_final_risk_score + 20;
  ELSIF p_job_stage IN ('booked', 'in_progress') THEN
    -- Active job: lower risk
    v_final_risk_score := v_final_risk_score - 20;
  ELSIF p_job_stage = 'completed' THEN
    -- Post-completion: medium risk
    v_final_risk_score := v_final_risk_score + 10;
  END IF;
  
  -- Cap at 100
  v_final_risk_score := LEAST(v_final_risk_score, 100);
  
  -- Determine action based on risk score and job stage
  IF v_final_risk_score >= 70 THEN
    -- High risk
    IF p_job_stage IN ('lead', 'quote_submitted') THEN
      v_action := 'blocked';
      v_restriction_level := 'high';
    ELSE
      v_action := 'warned';
      v_restriction_level := 'medium';
    END IF;
  ELSIF v_final_risk_score >= 40 THEN
    -- Medium risk
    IF p_job_stage IN ('lead', 'quote_submitted') THEN
      v_action := 'blocked';
      v_restriction_level := 'medium';
    ELSIF p_job_stage = 'completed' THEN
      v_action := 'masked';
      v_restriction_level := 'medium';
    ELSE
      v_action := 'warned';
      v_restriction_level := 'low';
    END IF;
  ELSE
    -- Low risk
    v_action := 'allowed';
    v_restriction_level := 'low';
  END IF;
  
  RETURN jsonb_build_object(
    'risk_level', v_restriction_level,
    'risk_score', v_final_risk_score,
    'action', v_action,
    'patterns_detected', v_detection_result->'patterns_detected',
    'sender_age_days', v_sender_age_days,
    'completed_jobs', v_completed_jobs,
    'recent_violations', v_recent_violations,
    'job_stage', p_job_stage
  );
END;
$$;

COMMENT ON FUNCTION public.calculate_message_risk IS 'Calculate risk score and determine action for message moderation';

-- =====================================================
-- FUNCTION: get_user_violation_count
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_violation_count(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_last_30_days int;
  v_last_7_days int;
  v_current_tier public.violation_tier;
BEGIN
  SELECT 
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::int,
    COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int
  INTO v_total, v_last_30_days, v_last_7_days
  FROM user_violations
  WHERE user_id = p_user_id;
  
  -- Determine current tier based on recent violations
  IF v_last_7_days >= 6 THEN
    v_current_tier := 'review';
  ELSIF v_last_7_days >= 4 THEN
    v_current_tier := 'restriction';
  ELSIF v_last_7_days >= 2 THEN
    v_current_tier := 'warning';
  ELSE
    v_current_tier := 'education';
  END IF;
  
  RETURN jsonb_build_object(
    'total', v_total,
    'last_30_days', v_last_30_days,
    'last_7_days', v_last_7_days,
    'current_tier', v_current_tier
  );
END;
$$;

COMMENT ON FUNCTION public.get_user_violation_count IS 'Get violation counts and current enforcement tier for user';

COMMIT;
