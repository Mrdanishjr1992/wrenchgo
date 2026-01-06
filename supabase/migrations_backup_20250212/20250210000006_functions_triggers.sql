-- =====================================================
-- FUNCTIONS AND TRIGGERS (PRODUCTION-READY)
-- =====================================================
-- Purpose: Auto-create profile, updated_at triggers, rating updates
-- =====================================================

BEGIN;

-- =====================================================
-- ENSURE TABLE OWNERSHIP FOR RLS BYPASS
-- =====================================================
-- SECURITY DEFINER functions need to be owned by the same role as the tables
-- they access to properly bypass RLS. Ensure postgres owns critical tables.
ALTER TABLE IF EXISTS public.profiles OWNER TO postgres;
ALTER TABLE IF EXISTS public.mechanic_profiles OWNER TO postgres;

-- =====================================================
-- FUNCTION: handle_new_user
-- Auto-create profile row when auth.users row is created
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS 'Auto-creates profile row on auth.users insert. SECURITY DEFINER bypasses RLS.';

-- =====================================================
-- FUNCTION: set_user_role
-- Allow users to set their role (customer or mechanic) once
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_user_role(new_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_role public.user_role;
  uid uuid;
BEGIN
  uid := auth.uid();

  IF uid IS NULL THEN
    RAISE EXCEPTION 'No auth.uid() in context';
  END IF;

  -- Get current role
  SELECT role INTO current_role
  FROM public.profiles
  WHERE id = uid;

  -- If role is already set, raise error
  IF current_role IS NOT NULL THEN
    RAISE EXCEPTION 'Role already set to %', current_role;
  END IF;

  -- Set the role
  UPDATE public.profiles
  SET role = new_role, updated_at = now()
  WHERE id = uid;

  -- If user chose mechanic, create mechanic_profile
  IF new_role = 'mechanic' THEN
    INSERT INTO public.mechanic_profiles (id, created_at, updated_at)
    VALUES (uid, now(), now())
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.set_user_role IS 'Allows user to set their role once. SECURITY DEFINER bypasses RLS. Auto-creates mechanic_profile if role is mechanic.';

-- Ensure function is owned by postgres (table owner)
ALTER FUNCTION public.set_user_role(public.user_role) OWNER TO postgres;

-- Restrict who can execute this function
REVOKE ALL ON FUNCTION public.set_user_role(public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(public.user_role) TO authenticated;

-- =====================================================
-- FUNCTION: update_updated_at_column
-- Generic trigger function to set updated_at = now()
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to all relevant tables
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.vehicles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.jobs;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.quote_requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.reviews;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.mechanic_profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.mechanic_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.messages;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.notifications;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.media_assets;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.mechanic_stripe_accounts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.mechanic_stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.customer_payment_methods;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.customer_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.payments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNCTION: update_mechanic_rating
-- Recalculate mechanic rating when review is added/updated
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_mechanic_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic_id uuid;
  v_avg numeric;
  v_count int;
BEGIN
  -- Determine mechanic_id from reviewee_id
  IF TG_OP = 'DELETE' THEN
    v_mechanic_id := OLD.reviewee_id;
  ELSE
    v_mechanic_id := NEW.reviewee_id;
  END IF;
  
  -- Calculate new rating
  SELECT 
    COALESCE(AVG(rating), 0)::numeric(3,2),
    COUNT(*)::int
  INTO v_avg, v_count
  FROM public.reviews
  WHERE reviewee_id = v_mechanic_id
    AND deleted_at IS NULL;
  
  -- Update mechanic_profiles
  UPDATE public.mechanic_profiles
  SET 
    rating_avg = v_avg,
    rating_count = v_count,
    updated_at = now()
  WHERE id = v_mechanic_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS update_mechanic_rating_trigger ON public.reviews;
CREATE TRIGGER update_mechanic_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mechanic_rating();

-- =====================================================
-- FUNCTION: increment_mechanic_job_count
-- Increment jobs_completed when job status changes to completed
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_mechanic_job_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only increment if status changed to 'completed' and mechanic is assigned
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed')
     AND NEW.accepted_mechanic_id IS NOT NULL THEN
    
    UPDATE public.mechanic_profiles
    SET 
      jobs_completed = jobs_completed + 1,
      updated_at = now()
    WHERE id = NEW.accepted_mechanic_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS increment_mechanic_job_count_trigger ON public.jobs;
CREATE TRIGGER increment_mechanic_job_count_trigger
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_mechanic_job_count();

COMMIT;
