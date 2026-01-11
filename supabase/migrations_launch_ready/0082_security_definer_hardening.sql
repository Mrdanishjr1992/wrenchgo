-- =====================================================
-- MIGRATION 0082: SECURITY DEFINER FUNCTION HARDENING
-- =====================================================
-- Purpose: Fix SECURITY DEFINER functions missing search_path
-- This prevents search_path injection attacks
-- =====================================================

BEGIN;

-- =====================================================
-- FIX: sync_payout_method_status
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_payout_method_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.onboarding_complete = true AND NEW.payouts_enabled = true AND NEW.deleted_at IS NULL THEN
      UPDATE public.profiles
      SET payout_method_status = 'active'
      WHERE id = NEW.mechanic_id;
    ELSIF NEW.onboarding_complete = true AND NEW.payouts_enabled = false THEN
      UPDATE public.profiles
      SET payout_method_status = 'pending'
      WHERE id = NEW.mechanic_id;
    ELSIF NEW.deleted_at IS NOT NULL THEN
      UPDATE public.profiles
      SET payout_method_status = 'none'
      WHERE id = NEW.mechanic_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET payout_method_status = 'none'
    WHERE id = OLD.mechanic_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- =====================================================
-- FIX: update_support_requests_updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_support_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- FIX: get_user_support_requests
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_support_requests(
  p_user_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  category text,
  message text,
  job_id uuid,
  screenshot_url text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id,
    sr.category,
    sr.message,
    sr.job_id,
    sr.screenshot_url,
    sr.status,
    sr.created_at
  FROM public.support_requests sr
  WHERE sr.user_id = COALESCE(p_user_id, auth.uid())
  ORDER BY sr.created_at DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- FIX: update_rating_prompt_timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_rating_prompt_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- FIX: on_job_completed_rating_prompt
-- =====================================================
CREATE OR REPLACE FUNCTION public.on_job_completed_rating_prompt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.user_rating_prompt_state (user_id, first_job_completed_at)
    VALUES (NEW.customer_id, now())
    ON CONFLICT (user_id) DO UPDATE
    SET first_job_completed_at = COALESCE(user_rating_prompt_state.first_job_completed_at, now()),
        updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- FIX: sync_job_location_geo (if PostGIS is available)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.sync_job_location_geo()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, extensions
      AS $inner$
      BEGIN
        IF NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL THEN
          NEW.location_geo := ST_SetSRID(ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326)::geography;
        ELSE
          NEW.location_geo := NULL;
        END IF;
        RETURN NEW;
      END;
      $inner$;
    $func$;
  END IF;
END;
$$;

COMMIT;
