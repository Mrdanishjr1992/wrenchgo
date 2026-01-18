-- =====================================================
-- PHASE 2: Probation Tier + Restrictions + Strike System
-- =====================================================
-- Implements:
-- A) Mechanic Tier system (probation/standard/trusted)
-- B) Platform policy config table
-- C) Quote submission enforcement RPC
-- D) Leads visibility enforcement
-- E) Strike system with auto-pause/remove
-- F) Acceptance/decline logging
-- =====================================================

BEGIN;

-- =====================================================
-- A) MECHANIC TIER COLUMNS
-- =====================================================

-- Add tier and related columns to mechanic_profiles
ALTER TABLE public.mechanic_profiles
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'probation',
  ADD COLUMN IF NOT EXISTS probation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS probation_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_quote_cents_override integer,
  ADD COLUMN IF NOT EXISTS blocked_symptom_keys text[],
  ADD COLUMN IF NOT EXISTS max_lead_radius_miles_override numeric;

-- Add tier constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mechanic_profiles_tier_check'
  ) THEN
    ALTER TABLE public.mechanic_profiles
      ADD CONSTRAINT mechanic_profiles_tier_check
      CHECK (tier IN ('probation', 'standard', 'trusted'));
  END IF;
END $$;

-- Index for tier queries
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_tier ON public.mechanic_profiles(tier);

-- =====================================================
-- B) PLATFORM POLICY CONFIG
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mechanic_policy_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  effective_from timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.mechanic_policy_config IS 'Platform-wide mechanic policy configuration';

-- Insert default policy values
INSERT INTO public.mechanic_policy_config (key, value, description) VALUES
  ('probation.max_quote_cents', '25000', 'Maximum quote amount in cents for probation mechanics'),
  ('probation.blocked_symptom_keys', '["engine_internal", "transmission_rebuild", "electrical_complex"]', 'Symptom keys blocked for probation mechanics'),
  ('probation.max_radius_miles', '15', 'Maximum lead radius in miles for probation mechanics'),
  ('strikes.auto_pause_threshold', '2', 'Number of strikes before auto-pause'),
  ('strikes.auto_remove_threshold', '3', 'Number of strikes before auto-remove')
ON CONFLICT (key) DO NOTHING;

-- Helper function to get effective mechanic policy
CREATE OR REPLACE FUNCTION public.get_effective_mechanic_policy(p_hub_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy jsonb := '{}'::jsonb;
  v_hub_settings jsonb;
  v_row record;
BEGIN
  -- Start with platform-wide defaults
  FOR v_row IN SELECT key, value FROM public.mechanic_policy_config
  LOOP
    v_policy := jsonb_set(v_policy, ARRAY[v_row.key], v_row.value);
  END LOOP;

  -- Override with hub-specific settings if provided
  IF p_hub_id IS NOT NULL THEN
    SELECT settings INTO v_hub_settings
    FROM public.service_hubs
    WHERE id = p_hub_id;

    IF v_hub_settings IS NOT NULL AND v_hub_settings ? 'mechanic_policy' THEN
      v_policy := v_policy || (v_hub_settings->'mechanic_policy');
    END IF;
  END IF;

  RETURN v_policy;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_mechanic_policy(uuid) TO authenticated;

-- =====================================================
-- C) MECHANIC STRIKES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mechanic_strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  reason text NOT NULL,
  notes text,
  severity integer NOT NULL DEFAULT 1,
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add reason constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mechanic_strikes_reason_check'
  ) THEN
    ALTER TABLE public.mechanic_strikes
      ADD CONSTRAINT mechanic_strikes_reason_check
      CHECK (reason IN (
        'poor_quality_work',
        'no_show',
        'customer_complaint',
        'policy_violation',
        'unprofessional_conduct',
        'safety_concern',
        'fraud_suspected',
        'other'
      ));
  END IF;
END $$;

COMMENT ON TABLE public.mechanic_strikes IS 'Strike records for mechanics with auto-enforcement';

CREATE INDEX IF NOT EXISTS idx_mechanic_strikes_mechanic_id ON public.mechanic_strikes(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_strikes_created_at ON public.mechanic_strikes(created_at DESC);

-- =====================================================
-- D) LEAD DECISIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  decision text NOT NULL,
  decline_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT lead_decisions_decision_check CHECK (decision IN ('viewed', 'quoted', 'declined'))
);

COMMENT ON TABLE public.lead_decisions IS 'Tracks mechanic decisions on leads for acceptance rate metrics';

CREATE INDEX IF NOT EXISTS idx_lead_decisions_mechanic_id ON public.lead_decisions(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_lead_decisions_job_id ON public.lead_decisions(job_id);
CREATE INDEX IF NOT EXISTS idx_lead_decisions_created_at ON public.lead_decisions(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_decisions_mechanic_job_decision 
  ON public.lead_decisions(mechanic_id, job_id, decision);

-- =====================================================
-- E) STRIKE AUTO-ENFORCEMENT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.enforce_strike_thresholds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_strike_count integer;
  v_policy jsonb;
  v_pause_threshold integer;
  v_remove_threshold integer;
  v_current_status text;
BEGIN
  -- Get policy
  v_policy := get_effective_mechanic_policy(NULL);
  v_pause_threshold := COALESCE((v_policy->>'strikes.auto_pause_threshold')::integer, 2);
  v_remove_threshold := COALESCE((v_policy->>'strikes.auto_remove_threshold')::integer, 3);

  -- Count active strikes (not expired)
  SELECT COUNT(*) INTO v_strike_count
  FROM public.mechanic_strikes
  WHERE mechanic_id = NEW.mechanic_id
    AND (expires_at IS NULL OR expires_at > now());

  -- Get current status
  SELECT verification_status INTO v_current_status
  FROM public.mechanic_profiles
  WHERE id = NEW.mechanic_id;

  -- Skip if already removed
  IF v_current_status = 'removed' THEN
    RETURN NEW;
  END IF;

  -- Apply thresholds
  IF v_strike_count >= v_remove_threshold THEN
    UPDATE public.mechanic_profiles
    SET verification_status = 'removed',
        verification_reason = 'Auto-removed: ' || v_strike_count || ' strikes (threshold: ' || v_remove_threshold || ')',
        verification_updated_at = now()
    WHERE id = NEW.mechanic_id;
  ELSIF v_strike_count >= v_pause_threshold AND v_current_status != 'paused' THEN
    UPDATE public.mechanic_profiles
    SET verification_status = 'paused',
        verification_reason = 'Auto-paused: ' || v_strike_count || ' strikes (threshold: ' || v_pause_threshold || ')',
        verification_updated_at = now()
    WHERE id = NEW.mechanic_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_strike_thresholds ON public.mechanic_strikes;
CREATE TRIGGER trg_enforce_strike_thresholds
  AFTER INSERT ON public.mechanic_strikes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_strike_thresholds();

-- =====================================================
-- F) TIER INITIALIZATION TRIGGER
-- =====================================================
-- Sets probation_started_at when mechanic first becomes active

CREATE OR REPLACE FUNCTION public.handle_mechanic_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when transitioning TO active status
  IF NEW.verification_status = 'active' AND 
     (OLD.verification_status IS NULL OR OLD.verification_status != 'active') THEN
    
    -- If never been active before (probation_started_at is null), initialize probation
    IF NEW.probation_started_at IS NULL THEN
      NEW.tier := 'probation';
      NEW.probation_started_at := now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_mechanic_activation ON public.mechanic_profiles;
CREATE TRIGGER trg_handle_mechanic_activation
  BEFORE UPDATE ON public.mechanic_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_mechanic_activation();

-- =====================================================
-- G) QUOTE SUBMISSION RPC (with enforcement)
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_quote_for_job(
  p_job_id uuid,
  p_price_cents integer,
  p_notes text DEFAULT NULL,
  p_estimated_hours numeric DEFAULT NULL,
  p_use_quote_requests boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_id uuid := auth.uid();
  v_mechanic record;
  v_job record;
  v_policy jsonb;
  v_max_quote_cents integer;
  v_blocked_keys text[];
  v_existing_quote_id uuid;
  v_new_quote_id uuid;
  v_distance_miles numeric;
BEGIN
  -- 1) Validate mechanic exists and is active
  SELECT mp.*, p.role
  INTO v_mechanic
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON p.id = mp.id
  WHERE mp.id = v_mechanic_id;

  IF v_mechanic IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mechanic profile not found');
  END IF;

  IF v_mechanic.role != 'mechanic' THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a mechanic');
  END IF;

  IF v_mechanic.verification_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mechanic is not verified/active. Status: ' || COALESCE(v_mechanic.verification_status, 'unknown'));
  END IF;

  -- 2) Fetch job details
  SELECT j.*, p.id as customer_profile_id
  INTO v_job
  FROM public.jobs j
  JOIN public.profiles p ON p.id = j.customer_id
  WHERE j.id = p_job_id;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  IF v_job.status NOT IN ('searching', 'quoted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job is not accepting quotes. Status: ' || v_job.status);
  END IF;

  -- 3) Check for existing quote
  SELECT id INTO v_existing_quote_id
  FROM public.quotes
  WHERE job_id = p_job_id AND mechanic_id = v_mechanic_id;

  IF v_existing_quote_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already quoted on this job', 'quote_id', v_existing_quote_id);
  END IF;

  -- 4) Get effective policy
  v_policy := get_effective_mechanic_policy(v_job.hub_id);

  -- 5) Probation enforcement
  IF v_mechanic.tier = 'probation' THEN
    -- Max quote check
    v_max_quote_cents := COALESCE(
      v_mechanic.max_quote_cents_override,
      (v_policy->>'probation.max_quote_cents')::integer,
      25000
    );

    IF p_price_cents > v_max_quote_cents THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Probation limit: Maximum quote is $' || (v_max_quote_cents / 100.0)::text,
        'max_quote_cents', v_max_quote_cents
      );
    END IF;

    -- Blocked symptom keys check
    v_blocked_keys := COALESCE(
      v_mechanic.blocked_symptom_keys,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_policy->'probation.blocked_symptom_keys', '[]'::jsonb)))
    );

    IF v_job.symptom_key IS NOT NULL AND v_job.symptom_key = ANY(v_blocked_keys) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Probation limit: This job category is restricted for probation mechanics',
        'blocked_symptom', v_job.symptom_key
      );
    END IF;
  END IF;

  -- 6) Insert quote
  IF p_use_quote_requests THEN
    INSERT INTO public.quote_requests (
      job_id,
      mechanic_id,
      customer_id,
      price_cents,
      notes,
      status
    ) VALUES (
      p_job_id,
      v_mechanic_id,
      v_job.customer_id,
      p_price_cents,
      p_notes,
      'pending'
    )
    RETURNING id INTO v_new_quote_id;
  ELSE
    INSERT INTO public.quotes (
      job_id,
      mechanic_id,
      price_cents,
      estimated_hours,
      notes,
      status
    ) VALUES (
      p_job_id,
      v_mechanic_id,
      p_price_cents,
      p_estimated_hours,
      p_notes,
      'pending'
    )
    RETURNING id INTO v_new_quote_id;
  END IF;

  -- 7) Log decision
  INSERT INTO public.lead_decisions (mechanic_id, job_id, decision)
  VALUES (v_mechanic_id, p_job_id, 'quoted')
  ON CONFLICT (mechanic_id, job_id, decision) DO NOTHING;

  -- 8) Update job status to quoted if first quote
  UPDATE public.jobs
  SET status = 'quoted', updated_at = now()
  WHERE id = p_job_id AND status = 'searching';

  RETURN jsonb_build_object(
    'success', true,
    'quote_id', v_new_quote_id,
    'message', 'Quote submitted successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_quote_for_job(uuid, integer, text, numeric, boolean) TO authenticated;

-- =====================================================
-- H) DECLINE LEAD RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.decline_lead(
  p_job_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_id uuid := auth.uid();
BEGIN
  -- Validate mechanic
  IF NOT EXISTS (
    SELECT 1 FROM public.mechanic_profiles WHERE id = v_mechanic_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mechanic profile not found');
  END IF;

  -- Validate job exists
  IF NOT EXISTS (
    SELECT 1 FROM public.jobs WHERE id = p_job_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Log decision
  INSERT INTO public.lead_decisions (mechanic_id, job_id, decision, decline_reason)
  VALUES (v_mechanic_id, p_job_id, 'declined', p_reason)
  ON CONFLICT (mechanic_id, job_id, decision) DO UPDATE
    SET decline_reason = EXCLUDED.decline_reason;

  RETURN jsonb_build_object('success', true, 'message', 'Lead declined');
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_lead(uuid, text) TO authenticated;

-- =====================================================
-- I) LOG LEAD VIEW RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_lead_view(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_id uuid := auth.uid();
BEGIN
  INSERT INTO public.lead_decisions (mechanic_id, job_id, decision)
  VALUES (v_mechanic_id, p_job_id, 'viewed')
  ON CONFLICT (mechanic_id, job_id, decision) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_lead_view(uuid) TO authenticated;

-- =====================================================
-- J) ADMIN STRIKE RPCs
-- =====================================================

-- Add strike
CREATE OR REPLACE FUNCTION public.admin_add_mechanic_strike(
  p_mechanic_id uuid,
  p_reason text,
  p_notes text DEFAULT NULL,
  p_job_id uuid DEFAULT NULL,
  p_severity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_strike_id uuid;
  v_strike_count integer;
BEGIN
  -- Verify admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Verify mechanic exists
  IF NOT EXISTS (
    SELECT 1 FROM public.mechanic_profiles WHERE id = p_mechanic_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mechanic not found');
  END IF;

  -- Insert strike
  INSERT INTO public.mechanic_strikes (mechanic_id, job_id, reason, notes, severity, created_by)
  VALUES (p_mechanic_id, p_job_id, p_reason, p_notes, p_severity, v_admin_id)
  RETURNING id INTO v_strike_id;

  -- Get updated count
  SELECT COUNT(*) INTO v_strike_count
  FROM public.mechanic_strikes
  WHERE mechanic_id = p_mechanic_id
    AND (expires_at IS NULL OR expires_at > now());

  RETURN jsonb_build_object(
    'success', true,
    'strike_id', v_strike_id,
    'total_strikes', v_strike_count,
    'message', 'Strike added successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_mechanic_strike(uuid, text, text, uuid, integer) TO authenticated;

-- List strikes
CREATE OR REPLACE FUNCTION public.admin_list_mechanic_strikes(p_mechanic_id uuid)
RETURNS TABLE (
  id uuid,
  mechanic_id uuid,
  job_id uuid,
  reason text,
  notes text,
  severity integer,
  expires_at timestamptz,
  created_by uuid,
  created_by_name text,
  created_at timestamptz,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    ms.id,
    ms.mechanic_id,
    ms.job_id,
    ms.reason,
    ms.notes,
    ms.severity,
    ms.expires_at,
    ms.created_by,
    p.full_name as created_by_name,
    ms.created_at,
    (ms.expires_at IS NULL OR ms.expires_at > now()) as is_active
  FROM public.mechanic_strikes ms
  LEFT JOIN public.profiles p ON p.id = ms.created_by
  WHERE ms.mechanic_id = p_mechanic_id
  ORDER BY ms.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_mechanic_strikes(uuid) TO authenticated;

-- Remove strike (super admin only)
CREATE OR REPLACE FUNCTION public.admin_remove_strike(p_strike_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Super admin access required');
  END IF;

  DELETE FROM public.mechanic_strikes WHERE id = p_strike_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Strike not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Strike removed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_remove_strike(uuid) TO authenticated;

-- =====================================================
-- K) ADMIN SET MECHANIC TIER RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_set_mechanic_tier(
  p_mechanic_id uuid,
  p_tier text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_tier text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_tier NOT IN ('probation', 'standard', 'trusted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier. Must be: probation, standard, trusted');
  END IF;

  SELECT tier INTO v_old_tier
  FROM public.mechanic_profiles
  WHERE id = p_mechanic_id;

  IF v_old_tier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mechanic not found');
  END IF;

  UPDATE public.mechanic_profiles
  SET 
    tier = p_tier,
    probation_completed_at = CASE 
      WHEN v_old_tier = 'probation' AND p_tier IN ('standard', 'trusted') 
      THEN now() 
      ELSE probation_completed_at 
    END,
    verification_reason = COALESCE(p_reason, verification_reason),
    updated_at = now()
  WHERE id = p_mechanic_id;

  RETURN jsonb_build_object(
    'success', true,
    'old_tier', v_old_tier,
    'new_tier', p_tier,
    'message', 'Tier updated from ' || v_old_tier || ' to ' || p_tier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_mechanic_tier(uuid, text, text) TO authenticated;

-- =====================================================
-- L) ADMIN SET MECHANIC OVERRIDES RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_set_mechanic_overrides(
  p_mechanic_id uuid,
  p_max_quote_cents_override integer DEFAULT NULL,
  p_blocked_symptom_keys text[] DEFAULT NULL,
  p_max_lead_radius_miles_override numeric DEFAULT NULL,
  p_clear_overrides boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mechanic_profiles WHERE id = p_mechanic_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mechanic not found');
  END IF;

  IF p_clear_overrides THEN
    UPDATE public.mechanic_profiles
    SET 
      max_quote_cents_override = NULL,
      blocked_symptom_keys = NULL,
      max_lead_radius_miles_override = NULL,
      updated_at = now()
    WHERE id = p_mechanic_id;
  ELSE
    UPDATE public.mechanic_profiles
    SET 
      max_quote_cents_override = COALESCE(p_max_quote_cents_override, max_quote_cents_override),
      blocked_symptom_keys = COALESCE(p_blocked_symptom_keys, blocked_symptom_keys),
      max_lead_radius_miles_override = COALESCE(p_max_lead_radius_miles_override, max_lead_radius_miles_override),
      updated_at = now()
    WHERE id = p_mechanic_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Overrides updated');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_mechanic_overrides(uuid, integer, text[], numeric, boolean) TO authenticated;

-- =====================================================
-- M) UPDATE get_mechanic_leads TO ENFORCE PROBATION
-- =====================================================

DROP FUNCTION IF EXISTS public.get_mechanic_leads(uuid, text, double precision, double precision, double precision, integer, integer, text);

CREATE OR REPLACE FUNCTION public.get_mechanic_leads(
  p_mechanic_id uuid,
  p_filter text,
  p_mechanic_lat double precision,
  p_mechanic_lng double precision,
  p_radius_miles double precision,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_sort_by text DEFAULT 'newest'
)
RETURNS TABLE (
  job_id uuid,
  title text,
  description text,
  status text,
  preferred_time text,
  vehicle_year int,
  vehicle_make text,
  vehicle_model text,
  vehicle_vin text,
  location_lat double precision,
  location_lng double precision,
  location_address text,
  customer_id uuid,
  customer_name text,
  customer_avatar text,
  created_at timestamptz,
  distance_miles numeric,
  quote_count bigint,
  has_quoted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic record;
  v_policy jsonb;
  v_effective_radius double precision;
  v_blocked_keys text[];
BEGIN
  -- Get mechanic details
  SELECT mp.*, p.role
  INTO v_mechanic
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON p.id = mp.id
  WHERE mp.id = p_mechanic_id;
  
  -- Verify active status
  IF v_mechanic IS NULL OR v_mechanic.verification_status IS NULL OR v_mechanic.verification_status != 'active' THEN
    RETURN;
  END IF;

  -- Get policy
  v_policy := get_effective_mechanic_policy(NULL);

  -- Calculate effective radius for probation
  v_effective_radius := p_radius_miles;
  IF v_mechanic.tier = 'probation' THEN
    v_effective_radius := LEAST(
      p_radius_miles,
      COALESCE(
        v_mechanic.max_lead_radius_miles_override,
        (v_policy->>'probation.max_radius_miles')::numeric,
        15
      )
    );
  END IF;

  -- Get blocked symptom keys for probation
  v_blocked_keys := CASE 
    WHEN v_mechanic.tier = 'probation' THEN
      COALESCE(
        v_mechanic.blocked_symptom_keys,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_policy->'probation.blocked_symptom_keys', '[]'::jsonb)))
      )
    ELSE
      ARRAY[]::text[]
  END;

  RETURN QUERY
  SELECT
    j.id as job_id,
    j.title,
    j.description,
    j.status::text,
    j.preferred_time,
    v.year as vehicle_year,
    v.make as vehicle_make,
    v.model as vehicle_model,
    v.vin as vehicle_vin,
    j.location_lat,
    j.location_lng,
    j.location_address,
    j.customer_id,
    p.full_name as customer_name,
    p.avatar_url as customer_avatar,
    j.created_at,
    CASE 
      WHEN p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL 
           AND j.location_lat IS NOT NULL AND j.location_lng IS NOT NULL
      THEN ROUND((
        3959 * acos(
          cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
          sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
        )
      )::numeric, 1)
      ELSE NULL
    END as distance_miles,
    (SELECT COUNT(*) FROM public.quotes q WHERE q.job_id = j.id) as quote_count,
    EXISTS(SELECT 1 FROM public.quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id) as has_quoted
  FROM public.jobs j
  JOIN public.profiles p ON p.id = j.customer_id
  LEFT JOIN public.vehicles ve ON ve.id = j.vehicle_id
  WHERE j.status = 'searching'::job_status
    -- Filter out blocked symptom keys for probation mechanics
    AND (array_length(v_blocked_keys, 1) IS NULL OR j.symptom_key IS NULL OR NOT (j.symptom_key = ANY(v_blocked_keys)))
    -- Standard filters
    AND (p_filter = 'all' OR p_filter IS NULL OR
         (p_filter = 'nearby' AND p_mechanic_lat IS NOT NULL) OR
         (p_filter = 'quoted' AND EXISTS(SELECT 1 FROM public.quotes q WHERE q.job_id = j.id AND q.mechanic_id = p_mechanic_id)))
    -- Radius filter (using effective radius for probation)
    AND (v_effective_radius IS NULL OR p_mechanic_lat IS NULL OR p_mechanic_lng IS NULL OR
         j.location_lat IS NULL OR j.location_lng IS NULL OR
         (3959 * acos(
           cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
           cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
           sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
         )) <= v_effective_radius)
  ORDER BY
    CASE WHEN p_sort_by = 'newest' THEN j.created_at END DESC,
    CASE WHEN p_sort_by = 'closest' AND p_mechanic_lat IS NOT NULL THEN
      3959 * acos(
        cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
        cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
        sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
      )
    END ASC NULLS LAST,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_leads(uuid, text, double precision, double precision, double precision, integer, integer, text) TO authenticated;

-- =====================================================
-- N) EXTENDED VERIFICATION STATUS RPC
-- =====================================================

DROP FUNCTION IF EXISTS public.get_mechanic_verification_status(uuid);

CREATE OR REPLACE FUNCTION public.get_mechanic_verification_status(p_mechanic_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_docs_uploaded int;
  v_docs_approved int;
  v_vetting_count int;
  v_docs_complete boolean;
  v_policy jsonb;
  v_strike_count int;
BEGIN
  -- Get policy
  v_policy := get_effective_mechanic_policy(NULL);

  -- Get strike count
  SELECT COUNT(*) INTO v_strike_count
  FROM public.mechanic_strikes
  WHERE mechanic_id = p_mechanic_id
    AND (expires_at IS NULL OR expires_at > now());

  SELECT 
    jsonb_build_object(
      'status', mp.verification_status,
      'reason', mp.verification_reason,
      'is_active', (mp.verification_status = 'active'),
      'can_view_leads', (mp.verification_status = 'active'),
      'can_submit_quotes', (mp.verification_status = 'active'),
      'tier', mp.tier,
      'probation_started_at', mp.probation_started_at,
      'probation_completed_at', mp.probation_completed_at,
      'strike_count', v_strike_count,
      'max_quote_cents', CASE 
        WHEN mp.tier = 'probation' THEN COALESCE(
          mp.max_quote_cents_override,
          (v_policy->>'probation.max_quote_cents')::integer,
          25000
        )
        ELSE NULL
      END,
      'max_radius_miles', CASE 
        WHEN mp.tier = 'probation' THEN COALESCE(
          mp.max_lead_radius_miles_override,
          (v_policy->>'probation.max_radius_miles')::numeric,
          15
        )
        ELSE NULL
      END,
      'blocked_symptom_keys', CASE 
        WHEN mp.tier = 'probation' THEN COALESCE(
          to_jsonb(mp.blocked_symptom_keys),
          v_policy->'probation.blocked_symptom_keys'
        )
        ELSE NULL
      END,
      'documents_uploaded', (
        SELECT COUNT(DISTINCT doc_type) FROM public.mechanic_verification_documents 
        WHERE mechanic_id = p_mechanic_id
      ),
      'documents_approved', (
        SELECT COUNT(DISTINCT doc_type) FROM public.mechanic_verification_documents 
        WHERE mechanic_id = p_mechanic_id AND status = 'approved'
      ),
      'documents_required', 4,
      'vetting_responses', (
        SELECT COUNT(*) FROM public.mechanic_vetting_responses 
        WHERE mechanic_id = p_mechanic_id
      ),
      'vetting_required', 5,
      'vetting_review_status', COALESCE(
        (SELECT status FROM public.mechanic_vetting_reviews WHERE mechanic_id = p_mechanic_id),
        'pending'
      )
    )
  INTO v_result
  FROM public.mechanic_profiles mp
  WHERE mp.id = p_mechanic_id;

  RETURN COALESCE(v_result, jsonb_build_object(
    'status', 'pending_verification',
    'is_active', false,
    'can_view_leads', false,
    'can_submit_quotes', false,
    'tier', 'probation',
    'strike_count', 0
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_verification_status(uuid) TO authenticated;

-- =====================================================
-- O) RLS POLICIES
-- =====================================================

-- mechanic_policy_config: read-only for authenticated, write for admins
ALTER TABLE public.mechanic_policy_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read policy config" ON public.mechanic_policy_config;
CREATE POLICY "Anyone can read policy config" ON public.mechanic_policy_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage policy config" ON public.mechanic_policy_config;
CREATE POLICY "Admins can manage policy config" ON public.mechanic_policy_config
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- mechanic_strikes: mechanics read own, admins full access
ALTER TABLE public.mechanic_strikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mechanics can view own strikes" ON public.mechanic_strikes;
CREATE POLICY "Mechanics can view own strikes" ON public.mechanic_strikes
  FOR SELECT TO authenticated USING (mechanic_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert strikes" ON public.mechanic_strikes;
CREATE POLICY "Admins can insert strikes" ON public.mechanic_strikes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Super admins can delete strikes" ON public.mechanic_strikes;
CREATE POLICY "Super admins can delete strikes" ON public.mechanic_strikes
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- lead_decisions: mechanics manage own
ALTER TABLE public.lead_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mechanics can manage own lead decisions" ON public.lead_decisions;
CREATE POLICY "Mechanics can manage own lead decisions" ON public.lead_decisions
  FOR ALL TO authenticated 
  USING (mechanic_id = auth.uid() OR public.is_admin())
  WITH CHECK (mechanic_id = auth.uid());

-- =====================================================
-- P) BACKFILL EXISTING MECHANICS
-- =====================================================
-- Set existing active mechanics to 'standard' tier (not probation)
-- since they were active before the probation system

UPDATE public.mechanic_profiles
SET 
  tier = 'standard',
  probation_started_at = created_at,
  probation_completed_at = created_at
WHERE verification_status = 'active'
  AND tier = 'probation'
  AND probation_started_at IS NULL;

-- For pending_verification mechanics, keep them on probation (will start when activated)

-- =====================================================
-- Q) UPDATE submit_quote_with_payment_check WITH PROBATION ENFORCEMENT
-- =====================================================

CREATE OR REPLACE FUNCTION public.submit_quote_with_payment_check(
  p_job_id uuid,
  p_price_cents int,
  p_estimated_hours numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_id uuid;
  v_mechanic record;
  v_job record;
  v_has_payout boolean;
  v_quote_id uuid;
  v_policy jsonb;
  v_max_quote_cents integer;
  v_blocked_keys text[];
BEGIN
  v_mechanic_id := auth.uid();

  IF v_mechanic_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHENTICATED');
  END IF;

  -- Get mechanic details including tier
  SELECT mp.*, p.role
  INTO v_mechanic
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON p.id = mp.id
  WHERE mp.id = v_mechanic_id;

  IF v_mechanic IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'MECHANIC_NOT_FOUND', 'message', 'Mechanic profile not found');
  END IF;

  -- Check verification status
  IF v_mechanic.verification_status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_VERIFIED',
      'message', 'Your account must be verified to submit quotes. Status: ' || COALESCE(v_mechanic.verification_status, 'unknown')
    );
  END IF;

  -- Check if mechanic has payout setup
  SELECT EXISTS (
    SELECT 1 FROM mechanic_stripe_accounts
    WHERE mechanic_id = v_mechanic_id AND stripe_account_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM mechanic_profiles
    WHERE id = v_mechanic_id AND stripe_account_id IS NOT NULL
  ) INTO v_has_payout;

  IF NOT v_has_payout THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PAYOUT_NOT_SETUP',
      'message', 'Please set up your payout account before submitting quotes'
    );
  END IF;

  -- Get job details
  SELECT j.*
  INTO v_job
  FROM public.jobs j
  WHERE j.id = p_job_id;

  IF v_job IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'JOB_NOT_FOUND', 'message', 'Job not found');
  END IF;

  -- Probation enforcement
  IF v_mechanic.tier = 'probation' THEN
    v_policy := get_effective_mechanic_policy(v_job.hub_id);

    -- Max quote check
    v_max_quote_cents := COALESCE(
      v_mechanic.max_quote_cents_override,
      (v_policy->>'probation.max_quote_cents')::integer,
      25000
    );

    IF p_price_cents > v_max_quote_cents THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'PROBATION_QUOTE_LIMIT',
        'message', 'Probation limit: Maximum quote is $' || (v_max_quote_cents / 100.0)::text,
        'max_quote_cents', v_max_quote_cents
      );
    END IF;

    -- Blocked symptom keys check
    v_blocked_keys := COALESCE(
      v_mechanic.blocked_symptom_keys,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_policy->'probation.blocked_symptom_keys', '[]'::jsonb)))
    );

    IF v_job.symptom_key IS NOT NULL AND v_job.symptom_key = ANY(v_blocked_keys) THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'PROBATION_CATEGORY_BLOCKED',
        'message', 'Probation limit: This job category is restricted',
        'blocked_symptom', v_job.symptom_key
      );
    END IF;
  END IF;

  -- Insert/update quote
  INSERT INTO quotes (job_id, mechanic_id, price_cents, estimated_hours, notes, status)
  VALUES (p_job_id, v_mechanic_id, p_price_cents, p_estimated_hours, p_notes, 'pending')
  ON CONFLICT (job_id, mechanic_id) DO UPDATE SET
    price_cents = EXCLUDED.price_cents,
    estimated_hours = EXCLUDED.estimated_hours,
    notes = EXCLUDED.notes,
    status = 'pending',
    updated_at = now()
  RETURNING id INTO v_quote_id;

  -- Log decision
  INSERT INTO public.lead_decisions (mechanic_id, job_id, decision)
  VALUES (v_mechanic_id, p_job_id, 'quoted')
  ON CONFLICT (mechanic_id, job_id, decision) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'quote_id', v_quote_id);
END;
$$;

COMMIT;
