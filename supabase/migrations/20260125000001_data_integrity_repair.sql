-- =====================================================
-- MIGRATION: Data Integrity Repair & Guardrails
-- =====================================================
-- Purpose: Diagnose, repair, and prevent data integrity issues
--          caused by manual profile inserts
-- 
-- Run order: After all previous migrations
-- 
-- IMPORTANT: Run diagnostic queries FIRST to assess scope,
--            then apply repairs in a transaction.
-- =====================================================

-- =====================================================
-- SECTION 0: QUARANTINE TABLE
-- =====================================================
-- Create a table to hold orphaned/problematic profile snapshots
-- for manual review before deletion

CREATE TABLE IF NOT EXISTS public.orphan_profiles_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  detected_at timestamptz DEFAULT now() NOT NULL,
  reason text NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_action text,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_orphan_quarantine_profile ON public.orphan_profiles_quarantine(profile_id);
CREATE INDEX IF NOT EXISTS idx_orphan_quarantine_detected ON public.orphan_profiles_quarantine(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_orphan_quarantine_unresolved ON public.orphan_profiles_quarantine(resolved_at) WHERE resolved_at IS NULL;

COMMENT ON TABLE public.orphan_profiles_quarantine IS 'Quarantined profiles with data integrity issues for manual review';

-- RLS: Admin only
ALTER TABLE public.orphan_profiles_quarantine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orphan_quarantine_admin_all ON public.orphan_profiles_quarantine;
CREATE POLICY orphan_quarantine_admin_all ON public.orphan_profiles_quarantine
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =====================================================
-- SECTION 1: DIAGNOSTIC QUERIES
-- =====================================================
-- These are SELECT-only queries to assess the scope of issues.
-- Run these BEFORE applying repairs to understand impact.

-- NOTE: Execute these diagnostics manually or via admin dashboard.
-- They are wrapped in a DO block for documentation but won't affect data.

/*
================================================================================
DIAGNOSTIC 1: Profiles missing auth.users (orphan profiles)
================================================================================
*/
-- SELECT 
--   p.id,
--   p.email,
--   p.full_name,
--   p.role,
--   p.created_at,
--   p.deleted_at,
--   'orphan_no_auth_user' AS issue_type
-- FROM public.profiles p
-- LEFT JOIN auth.users u ON p.id = u.id
-- WHERE u.id IS NULL;

/*
================================================================================
DIAGNOSTIC 2: Mechanics with payout_method_status='active' but no stripe account
================================================================================
*/
-- SELECT 
--   p.id,
--   p.email,
--   p.full_name,
--   p.payout_method_status,
--   msa.stripe_account_id,
--   msa.onboarding_complete,
--   msa.payouts_enabled,
--   'payout_status_mismatch' AS issue_type
-- FROM public.profiles p
-- LEFT JOIN public.mechanic_stripe_accounts msa ON p.id = msa.mechanic_id
-- WHERE p.role = 'mechanic'
--   AND p.payout_method_status = 'active'
--   AND (
--     msa.id IS NULL 
--     OR msa.onboarding_complete = false 
--     OR msa.payouts_enabled = false
--   );

/*
================================================================================
DIAGNOSTIC 3: Mechanics with role='mechanic' but missing location (home_lat/home_lng)
================================================================================
*/
-- SELECT 
--   p.id,
--   p.email,
--   p.full_name,
--   p.home_lat,
--   p.home_lng,
--   mp.tier,
--   mp.is_available,
--   'mechanic_missing_location' AS issue_type
-- FROM public.profiles p
-- LEFT JOIN public.mechanic_profiles mp ON p.id = mp.id
-- WHERE p.role = 'mechanic'
--   AND p.deleted_at IS NULL
--   AND (p.home_lat IS NULL OR p.home_lng IS NULL);

/*
================================================================================
DIAGNOSTIC 4: Mechanics with mechanic_profile but missing core setup
================================================================================
*/
-- SELECT 
--   p.id,
--   p.email,
--   p.role,
--   mp.tier,
--   mp.stripe_onboarding_complete,
--   p.payout_method_status,
--   CASE 
--     WHEN p.role != 'mechanic' THEN 'profile_mechanic_mismatch'
--     WHEN mp.id IS NULL THEN 'mechanic_profile_missing'
--     ELSE 'unknown'
--   END AS issue_type
-- FROM public.mechanic_profiles mp
-- LEFT JOIN public.profiles p ON mp.id = p.id
-- WHERE p.role != 'mechanic' OR p.id IS NULL;

/*
================================================================================
DIAGNOSTIC 5: Invalid lat/lng values (out of range or stored incorrectly)
================================================================================
*/
-- SELECT 
--   id,
--   email,
--   home_lat,
--   home_lng,
--   'invalid_coordinates' AS issue_type
-- FROM public.profiles
-- WHERE (home_lat IS NOT NULL AND (home_lat < -90 OR home_lat > 90))
--    OR (home_lng IS NOT NULL AND (home_lng < -180 OR home_lng > 180));

/*
================================================================================
DIAGNOSTIC 6: Profiles with deleted_at but still appearing in active queries
================================================================================
*/
-- SELECT 
--   p.id,
--   p.email,
--   p.deleted_at,
--   p.deleted_reason,
--   p.can_reapply,
--   'deleted_but_not_quarantined' AS issue_type
-- FROM public.profiles p
-- WHERE p.deleted_at IS NOT NULL
--   AND p.deleted_reason IS NULL;

/*
================================================================================
DIAGNOSTIC 7: Count summary of all issues
================================================================================
*/
-- SELECT 
--   'orphan_profiles' AS issue_type,
--   COUNT(*) AS count
-- FROM public.profiles p
-- LEFT JOIN auth.users u ON p.id = u.id
-- WHERE u.id IS NULL
-- UNION ALL
-- SELECT 
--   'payout_status_mismatch',
--   COUNT(*)
-- FROM public.profiles p
-- LEFT JOIN public.mechanic_stripe_accounts msa ON p.id = msa.mechanic_id
-- WHERE p.role = 'mechanic'
--   AND p.payout_method_status = 'active'
--   AND (msa.id IS NULL OR msa.onboarding_complete = false OR msa.payouts_enabled = false)
-- UNION ALL
-- SELECT 
--   'mechanic_missing_location',
--   COUNT(*)
-- FROM public.profiles p
-- WHERE p.role = 'mechanic'
--   AND p.deleted_at IS NULL
--   AND (p.home_lat IS NULL OR p.home_lng IS NULL)
-- UNION ALL
-- SELECT 
--   'invalid_coordinates',
--   COUNT(*)
-- FROM public.profiles
-- WHERE (home_lat IS NOT NULL AND (home_lat < -90 OR home_lat > 90))
--    OR (home_lng IS NOT NULL AND (home_lng < -180 OR home_lng > 180));


-- =====================================================
-- SECTION 2: REPAIR SQL (TRANSACTIONAL)
-- =====================================================

BEGIN;

-- =====================================================
-- REPAIR 2A: Quarantine orphan profiles (no auth.users)
-- =====================================================
-- Move orphan profiles to quarantine and soft-delete them

-- First, snapshot and quarantine
INSERT INTO public.orphan_profiles_quarantine (profile_id, snapshot, reason)
SELECT 
  p.id,
  to_jsonb(p),
  'orphan_profile_no_auth_user'
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.orphan_profiles_quarantine q 
    WHERE q.profile_id = p.id AND q.reason = 'orphan_profile_no_auth_user'
  );

-- Then soft-delete them
UPDATE public.profiles p
SET 
  deleted_at = COALESCE(p.deleted_at, now()),
  deleted_reason = COALESCE(p.deleted_reason, 'orphan_profile_no_auth_user'),
  can_reapply = false,
  updated_at = now()
FROM (
  SELECT p2.id
  FROM public.profiles p2
  LEFT JOIN auth.users u ON p2.id = u.id
  WHERE u.id IS NULL
) orphans
WHERE p.id = orphans.id;

-- Log the repair action
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.orphan_profiles_quarantine
  WHERE reason = 'orphan_profile_no_auth_user'
    AND detected_at > now() - interval '1 minute';
    
  IF v_count > 0 THEN
    PERFORM public.system_audit_log(
      'DATA_REPAIR',
      'profiles',
      NULL,
      jsonb_build_object(
        'repair_type', 'orphan_profiles_quarantined',
        'count', v_count,
        'action', 'soft_delete_and_quarantine'
      )
    );
  END IF;
END $$;

-- =====================================================
-- REPAIR 2B: Fix payout_method_status inconsistencies
-- =====================================================
-- Set payout_method_status to 'none' for mechanics without proper stripe setup

UPDATE public.profiles p
SET 
  payout_method_status = 'none',
  updated_at = now()
FROM (
  SELECT p2.id
  FROM public.profiles p2
  LEFT JOIN public.mechanic_stripe_accounts msa ON p2.id = msa.mechanic_id
  WHERE p2.role = 'mechanic'
    AND p2.payout_method_status = 'active'
    AND (
      msa.id IS NULL 
      OR msa.onboarding_complete = false 
      OR msa.payouts_enabled = false
    )
) invalid_payout
WHERE p.id = invalid_payout.id
RETURNING p.id, p.email, 'payout_status_reset' AS repair_type;

-- Log the repair
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.profiles p
  LEFT JOIN public.mechanic_stripe_accounts msa ON p.id = msa.mechanic_id
  WHERE p.role = 'mechanic'
    AND p.payout_method_status = 'none'
    AND p.updated_at > now() - interval '1 minute';
    
  IF v_count > 0 THEN
    PERFORM public.system_audit_log(
      'DATA_REPAIR',
      'profiles',
      NULL,
      jsonb_build_object(
        'repair_type', 'payout_status_reset_to_none',
        'count', v_count,
        'reason', 'no_valid_stripe_account'
      )
    );
  END IF;
END $$;

-- =====================================================
-- REPAIR 2C: Set payout_method_status to 'pending' for incomplete onboarding
-- =====================================================

UPDATE public.profiles p
SET 
  payout_method_status = 'pending',
  updated_at = now()
FROM public.mechanic_stripe_accounts msa
WHERE p.id = msa.mechanic_id
  AND p.role = 'mechanic'
  AND p.payout_method_status = 'none'
  AND msa.stripe_account_id IS NOT NULL
  AND msa.onboarding_complete = false;

-- =====================================================
-- REPAIR 2D: Ensure mechanics without location are flagged
-- =====================================================
-- Mark mechanic_profiles as unavailable if no location set

UPDATE public.mechanic_profiles mp
SET 
  is_available = false,
  updated_at = now()
FROM public.profiles p
WHERE mp.id = p.id
  AND p.role = 'mechanic'
  AND p.deleted_at IS NULL
  AND (p.home_lat IS NULL OR p.home_lng IS NULL)
  AND mp.is_available = true;

-- Log the repair
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.mechanic_profiles mp
  JOIN public.profiles p ON mp.id = p.id
  WHERE p.role = 'mechanic'
    AND (p.home_lat IS NULL OR p.home_lng IS NULL)
    AND mp.is_available = false
    AND mp.updated_at > now() - interval '1 minute';
    
  IF v_count > 0 THEN
    PERFORM public.system_audit_log(
      'DATA_REPAIR',
      'mechanic_profiles',
      NULL,
      jsonb_build_object(
        'repair_type', 'mechanic_marked_unavailable',
        'count', v_count,
        'reason', 'missing_location_coordinates'
      )
    );
  END IF;
END $$;

-- =====================================================
-- REPAIR 2E: Normalize can_reapply for deleted profiles
-- =====================================================
-- Ensure deleted profiles have can_reapply set appropriately

UPDATE public.profiles
SET 
  can_reapply = false,
  updated_at = now()
WHERE deleted_at IS NOT NULL
  AND deleted_reason IN ('fraud', 'abuse', 'permanent_ban', 'orphan_profile_no_auth_user')
  AND (can_reapply IS NULL OR can_reapply = true);

UPDATE public.profiles
SET 
  can_reapply = true,
  updated_at = now()
WHERE deleted_at IS NOT NULL
  AND deleted_reason NOT IN ('fraud', 'abuse', 'permanent_ban', 'orphan_profile_no_auth_user')
  AND can_reapply IS NULL;

-- =====================================================
-- REPAIR 2F: Clear invalid coordinates
-- =====================================================

UPDATE public.profiles
SET 
  home_lat = NULL,
  home_lng = NULL,
  updated_at = now()
WHERE (home_lat IS NOT NULL AND (home_lat < -90 OR home_lat > 90))
   OR (home_lng IS NOT NULL AND (home_lng < -180 OR home_lng > 180));

COMMIT;


-- =====================================================
-- SECTION 3: GUARDRAILS (Constraints & Triggers)
-- =====================================================

-- =====================================================
-- GUARDRAIL 3A: Trigger to validate payout_method_status
-- =====================================================
-- Prevents setting payout_method_status='active' without valid stripe account

CREATE OR REPLACE FUNCTION public.check_payout_status_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stripe_valid boolean := false;
BEGIN
  -- Only check for mechanics
  IF NEW.role != 'mechanic' THEN
    RETURN NEW;
  END IF;
  
  -- If setting payout_method_status to 'active', verify stripe account
  IF NEW.payout_method_status = 'active' THEN
    SELECT EXISTS (
      SELECT 1 
      FROM public.mechanic_stripe_accounts msa
      WHERE msa.mechanic_id = NEW.id
        AND msa.onboarding_complete = true
        AND msa.payouts_enabled = true
        AND msa.deleted_at IS NULL
    ) INTO v_stripe_valid;
    
    IF NOT v_stripe_valid THEN
      -- Auto-correct instead of failing
      NEW.payout_method_status := 'none';
      
      -- Log the auto-correction
      INSERT INTO public.audit_log (actor_id, actor_type, action, entity_type, entity_id, metadata)
      VALUES (
        NEW.id, 
        'system', 
        'AUTO_CORRECT_PAYOUT_STATUS',
        'profiles',
        NEW.id,
        jsonb_build_object(
          'attempted_status', 'active',
          'corrected_to', 'none',
          'reason', 'no_valid_stripe_account'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_payout_status ON public.profiles;
CREATE TRIGGER trg_check_payout_status
  BEFORE INSERT OR UPDATE OF payout_method_status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_payout_status_consistency();

-- =====================================================
-- GUARDRAIL 3B: Trigger to validate mechanic availability
-- =====================================================
-- Auto-corrects is_available if mechanic has no location

CREATE OR REPLACE FUNCTION public.check_mechanic_availability_requirements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_location boolean := false;
  v_profile record;
BEGIN
  -- Only check when setting is_available to true
  IF NEW.is_available = true AND (OLD IS NULL OR OLD.is_available = false) THEN
    SELECT home_lat, home_lng, role, deleted_at
    INTO v_profile
    FROM public.profiles
    WHERE id = NEW.id;
    
    -- Check if mechanic has required location
    v_has_location := (
      v_profile.role = 'mechanic' AND
      v_profile.home_lat IS NOT NULL AND 
      v_profile.home_lng IS NOT NULL AND
      v_profile.deleted_at IS NULL
    );
    
    IF NOT v_has_location THEN
      -- Auto-correct
      NEW.is_available := false;
      
      -- Log the auto-correction
      INSERT INTO public.audit_log (actor_id, actor_type, action, entity_type, entity_id, metadata)
      VALUES (
        NEW.id, 
        'system', 
        'AUTO_CORRECT_AVAILABILITY',
        'mechanic_profiles',
        NEW.id,
        jsonb_build_object(
          'attempted_available', true,
          'corrected_to', false,
          'reason', 'missing_location_or_deleted'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_mechanic_availability ON public.mechanic_profiles;
CREATE TRIGGER trg_check_mechanic_availability
  BEFORE INSERT OR UPDATE OF is_available ON public.mechanic_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_mechanic_availability_requirements();

-- =====================================================
-- GUARDRAIL 3C: Constraint on coordinates
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_valid_lat'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_valid_lat
      CHECK (home_lat IS NULL OR (home_lat >= -90 AND home_lat <= 90));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_valid_lng'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_valid_lng
      CHECK (home_lng IS NULL OR (home_lng >= -180 AND home_lng <= 180));
  END IF;
END $$;

-- =====================================================
-- GUARDRAIL 3D: Trigger to prevent orphan profile creation
-- =====================================================
-- This runs AFTER insert to verify auth.users exists

CREATE OR REPLACE FUNCTION public.verify_profile_has_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if auth.users record exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
    -- Quarantine immediately
    INSERT INTO public.orphan_profiles_quarantine (profile_id, snapshot, reason)
    VALUES (NEW.id, to_jsonb(NEW), 'orphan_profile_no_auth_user_on_insert');
    
    -- Soft-delete
    UPDATE public.profiles
    SET 
      deleted_at = now(),
      deleted_reason = 'orphan_profile_no_auth_user',
      can_reapply = false
    WHERE id = NEW.id;
    
    -- Log the incident
    INSERT INTO public.audit_log (actor_id, actor_type, action, entity_type, entity_id, metadata)
    VALUES (
      NULL, 
      'system', 
      'ORPHAN_PROFILE_BLOCKED',
      'profiles',
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'reason', 'no_auth_user_record',
        'action_taken', 'quarantined_and_soft_deleted'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_profile_auth ON public.profiles;
CREATE TRIGGER trg_verify_profile_auth
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_profile_has_auth_user();

-- =====================================================
-- GUARDRAIL 3E: Function to sync payout status from stripe
-- =====================================================
-- Call this when stripe webhook updates account status

CREATE OR REPLACE FUNCTION public.sync_payout_status_from_stripe(p_mechanic_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stripe record;
  v_new_status public.payout_method_status;
  v_old_status public.payout_method_status;
BEGIN
  -- Get current profile status
  SELECT payout_method_status INTO v_old_status
  FROM public.profiles
  WHERE id = p_mechanic_id;
  
  -- Get stripe account status
  SELECT * INTO v_stripe
  FROM public.mechanic_stripe_accounts
  WHERE mechanic_id = p_mechanic_id
    AND deleted_at IS NULL;
  
  -- Determine correct status
  IF v_stripe.id IS NULL THEN
    v_new_status := 'none';
  ELSIF v_stripe.onboarding_complete AND v_stripe.payouts_enabled THEN
    v_new_status := 'active';
  ELSIF v_stripe.stripe_account_id IS NOT NULL THEN
    v_new_status := 'pending';
  ELSE
    v_new_status := 'none';
  END IF;
  
  -- Update if changed
  IF v_new_status != v_old_status THEN
    UPDATE public.profiles
    SET 
      payout_method_status = v_new_status,
      updated_at = now()
    WHERE id = p_mechanic_id;
    
    -- Log the change
    PERFORM public.system_audit_log(
      'PAYOUT_STATUS_SYNCED',
      'profiles',
      p_mechanic_id,
      jsonb_build_object(
        'old_status', v_old_status,
        'new_status', v_new_status,
        'stripe_onboarding_complete', v_stripe.onboarding_complete,
        'stripe_payouts_enabled', v_stripe.payouts_enabled
      )
    );
  END IF;
  
  RETURN v_new_status::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_payout_status_from_stripe(uuid) TO service_role;


-- =====================================================
-- SECTION 4: ADMIN DIAGNOSTIC RPC
-- =====================================================
-- Provides a single RPC for admins to run diagnostics

CREATE OR REPLACE FUNCTION public.admin_run_data_integrity_diagnostics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  -- Check admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Count orphan profiles
  SELECT COUNT(*) INTO v_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  WHERE u.id IS NULL AND p.deleted_at IS NULL;
  v_result := v_result || jsonb_build_object('orphan_profiles', v_count);
  
  -- Count payout mismatches
  SELECT COUNT(*) INTO v_count
  FROM public.profiles p
  LEFT JOIN public.mechanic_stripe_accounts msa ON p.id = msa.mechanic_id
  WHERE p.role = 'mechanic'
    AND p.payout_method_status = 'active'
    AND p.deleted_at IS NULL
    AND (msa.id IS NULL OR msa.onboarding_complete = false OR msa.payouts_enabled = false);
  v_result := v_result || jsonb_build_object('payout_status_mismatches', v_count);
  
  -- Count mechanics without location
  SELECT COUNT(*) INTO v_count
  FROM public.profiles p
  JOIN public.mechanic_profiles mp ON p.id = mp.id
  WHERE p.role = 'mechanic'
    AND p.deleted_at IS NULL
    AND mp.is_available = true
    AND (p.home_lat IS NULL OR p.home_lng IS NULL);
  v_result := v_result || jsonb_build_object('mechanics_available_without_location', v_count);
  
  -- Count invalid coordinates
  SELECT COUNT(*) INTO v_count
  FROM public.profiles
  WHERE (home_lat IS NOT NULL AND (home_lat < -90 OR home_lat > 90))
     OR (home_lng IS NOT NULL AND (home_lng < -180 OR home_lng > 180));
  v_result := v_result || jsonb_build_object('invalid_coordinates', v_count);
  
  -- Count quarantined (unresolved)
  SELECT COUNT(*) INTO v_count
  FROM public.orphan_profiles_quarantine
  WHERE resolved_at IS NULL;
  v_result := v_result || jsonb_build_object('quarantined_unresolved', v_count);
  
  -- Log the diagnostic run
  PERFORM public.admin_audit_log(
    'DATA_INTEGRITY_DIAGNOSTIC',
    NULL,
    NULL,
    v_result
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_run_data_integrity_diagnostics() TO authenticated;


-- =====================================================
-- SECTION 5: ADMIN REPAIR RPC
-- =====================================================
-- Provides a single RPC for admins to run repairs

CREATE OR REPLACE FUNCTION public.admin_run_data_integrity_repairs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  -- Check admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Repair orphan profiles
  WITH quarantined AS (
    INSERT INTO public.orphan_profiles_quarantine (profile_id, snapshot, reason)
    SELECT 
      p.id,
      to_jsonb(p),
      'orphan_profile_no_auth_user'
    FROM public.profiles p
    LEFT JOIN auth.users u ON p.id = u.id
    WHERE u.id IS NULL
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.orphan_profiles_quarantine q 
        WHERE q.profile_id = p.id AND q.reason = 'orphan_profile_no_auth_user'
      )
    RETURNING profile_id
  ),
  soft_deleted AS (
    UPDATE public.profiles p
    SET 
      deleted_at = now(),
      deleted_reason = 'orphan_profile_no_auth_user',
      can_reapply = false,
      updated_at = now()
    FROM quarantined q
    WHERE p.id = q.profile_id
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_count FROM soft_deleted;
  v_result := v_result || jsonb_build_object('orphans_quarantined', v_count);
  
  -- Repair payout status
  WITH fixed AS (
    UPDATE public.profiles p
    SET 
      payout_method_status = 'none',
      updated_at = now()
    FROM (
      SELECT p2.id
      FROM public.profiles p2
      LEFT JOIN public.mechanic_stripe_accounts msa ON p2.id = msa.mechanic_id
      WHERE p2.role = 'mechanic'
        AND p2.payout_method_status = 'active'
        AND p2.deleted_at IS NULL
        AND (msa.id IS NULL OR msa.onboarding_complete = false OR msa.payouts_enabled = false)
    ) invalid
    WHERE p.id = invalid.id
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_count FROM fixed;
  v_result := v_result || jsonb_build_object('payout_statuses_fixed', v_count);
  
  -- Fix mechanics without location
  WITH fixed AS (
    UPDATE public.mechanic_profiles mp
    SET 
      is_available = false,
      updated_at = now()
    FROM public.profiles p
    WHERE mp.id = p.id
      AND p.role = 'mechanic'
      AND p.deleted_at IS NULL
      AND (p.home_lat IS NULL OR p.home_lng IS NULL)
      AND mp.is_available = true
    RETURNING mp.id
  )
  SELECT COUNT(*) INTO v_count FROM fixed;
  v_result := v_result || jsonb_build_object('mechanics_marked_unavailable', v_count);
  
  -- Clear invalid coordinates
  WITH fixed AS (
    UPDATE public.profiles
    SET 
      home_lat = NULL,
      home_lng = NULL,
      updated_at = now()
    WHERE (home_lat IS NOT NULL AND (home_lat < -90 OR home_lat > 90))
       OR (home_lng IS NOT NULL AND (home_lng < -180 OR home_lng > 180))
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM fixed;
  v_result := v_result || jsonb_build_object('invalid_coordinates_cleared', v_count);
  
  -- Log the repair run
  PERFORM public.admin_audit_log(
    'DATA_INTEGRITY_REPAIR',
    NULL,
    NULL,
    v_result
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_run_data_integrity_repairs() TO authenticated;
