-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================
-- Purpose: RPC functions, triggers, and business logic
-- Safe for: supabase db reset

-- 1) UPDATED_AT TRIGGER FUNCTION

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2) HANDLE_NEW_USER TRIGGER FUNCTION (FIXED - NO DEFAULT ROLE)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn text;
BEGIN
  fn := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.profiles (id, auth_id, full_name, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.id, fn, NEW.email, NULL, NOW(), NOW())
  ON CONFLICT (auth_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3) SET_USER_ROLE RPC FUNCTION (FROM ROLE FIX)

CREATE OR REPLACE FUNCTION public.set_user_role(new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
  current_role text;
BEGIN
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF new_role NOT IN ('customer', 'mechanic') THEN
    RAISE EXCEPTION 'Invalid role: must be customer or mechanic';
  END IF;

  SELECT role INTO current_role
  FROM public.profiles
  WHERE auth_id = user_id;

  IF current_role IS NOT NULL THEN
    RAISE EXCEPTION 'Role already set. Cannot change role after initial selection.';
  END IF;

  UPDATE public.profiles
  SET 
    role = new_role,
    updated_at = NOW()
  WHERE auth_id = user_id;

  IF new_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (user_id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.set_user_role(text) IS 
  'Sets the user role during onboarding. Can only be called once per user. Role must be customer or mechanic.';

GRANT EXECUTE ON FUNCTION public.set_user_role(text) TO authenticated;

-- 4) GET_PUBLIC_PROFILE_CARD RPC FUNCTION

CREATE OR REPLACE FUNCTION public.get_public_profile_card(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'role', p.role,
    'is_verified', COALESCE(mp.is_verified, false),
    'average_rating', COALESCE(mp.average_rating, 0),
    'jobs_completed', COALESCE(mp.jobs_completed, 0)
  )
  INTO result
  FROM public.profiles p
  LEFT JOIN public.mechanic_profiles mp ON mp.id = p.auth_id
  WHERE p.auth_id = user_id
    AND p.deleted_at IS NULL;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_card(uuid) TO authenticated;

-- 5) CANCEL_QUOTE_BY_CUSTOMER RPC FUNCTION

CREATE OR REPLACE FUNCTION public.cancel_quote_by_customer(
  p_quote_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_quote_customer_id uuid;
BEGIN
  v_customer_id := auth.uid();

  SELECT customer_id INTO v_quote_customer_id
  FROM public.quote_requests
  WHERE id = p_quote_id;

  IF v_quote_customer_id IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_quote_customer_id != v_customer_id THEN
    RAISE EXCEPTION 'Not authorized to cancel this quote';
  END IF;

  UPDATE public.quote_requests
  SET
    status = 'cancelled',
    canceled_at = NOW(),
    canceled_by = 'customer',
    cancel_reason = p_reason,
    cancel_note = p_note,
    updated_at = NOW()
  WHERE id = p_quote_id;

  RETURN jsonb_build_object('success', true, 'quote_id', p_quote_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_quote_by_customer(uuid, text, text) TO authenticated;

-- 6) BLOCK_DELETED_PROFILE_ACCESS TRIGGER FUNCTION

CREATE OR REPLACE FUNCTION public.block_deleted_profile_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid()
      AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Account has been deleted';
  END IF;
  RETURN NEW;
END;
$$;

-- 7) CHECK_USER_NOT_DELETED TRIGGER FUNCTION

CREATE OR REPLACE FUNCTION public.check_user_not_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid()
      AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot perform this action: account has been deleted';
  END IF;
  RETURN NEW;
END;
$$;

-- 8) ATTACH TRIGGERS TO TABLES

-- Updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON public.vehicles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.quotes;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_symptom_mappings_updated_at ON public.symptom_mappings;
CREATE TRIGGER trg_symptom_mappings_updated_at
  BEFORE UPDATE ON public.symptom_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_symptom_questions_updated_at ON public.symptom_questions;
CREATE TRIGGER trg_symptom_questions_updated_at
  BEFORE UPDATE ON public.symptom_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_symptom_refinements_updated_at ON public.symptom_refinements;
CREATE TRIGGER trg_symptom_refinements_updated_at
  BEFORE UPDATE ON public.symptom_refinements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Auth trigger (on auth.users table)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
