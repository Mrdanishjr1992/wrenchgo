-- =====================================================
-- MIGRATION 0007: CLEANUP AND VALIDATION
-- =====================================================
-- Purpose: Final cleanup, validation, and storage setup
-- Depends on: All previous migrations
-- =====================================================

BEGIN;

-- =====================================================
-- GRANT EXECUTE ON FUNCTIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_role(public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mechanic_leads(uuid, text, numeric, numeric, numeric, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mechanic_profile_full(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_theme_preference(public.theme_mode) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_stripe_connect_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_stripe_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stripe_account_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_intent(uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_stripe_account_status(text, boolean, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_payment_status(text, public.payment_status, timestamptz) TO service_role;

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_requests;

-- =====================================================
-- VALIDATION QUERIES (will fail if schema is wrong)
-- =====================================================
DO $$
DECLARE
  v_count int;
BEGIN
  -- Verify all tables exist
  SELECT COUNT(*) INTO v_count FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name IN (
    'profiles', 'vehicles', 'jobs', 'quote_requests', 'reviews',
    'mechanic_profiles', 'skills', 'tools', 'safety_measures',
    'mechanic_skills', 'mechanic_tools', 'mechanic_safety',
    'symptoms', 'symptom_mappings', 'education_cards', 'symptom_education', 'symptom_questions',
    'messages', 'notifications', 'media_assets',
    'mechanic_stripe_accounts', 'customer_payment_methods', 'payments'
  );
  
  IF v_count < 22 THEN
    RAISE EXCEPTION 'Schema validation failed: Expected 22 tables, found %', v_count;
  END IF;
  
  -- Verify all enums exist
  SELECT COUNT(*) INTO v_count FROM pg_type 
  WHERE typname IN ('user_role', 'theme_mode', 'job_status', 'quote_status', 'payment_status');
  
  IF v_count < 5 THEN
    RAISE EXCEPTION 'Schema validation failed: Expected 5 enums, found %', v_count;
  END IF;
  
  -- Verify critical columns exist
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' 
  AND column_name IN ('id', 'email', 'role', 'theme_preference', 'city', 'state');
  
  IF v_count < 6 THEN
    RAISE EXCEPTION 'Schema validation failed: profiles table missing columns';
  END IF;
  
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'jobs' 
  AND column_name IN ('id', 'customer_id', 'status', 'preferred_time', 'location_lat', 'location_lng');
  
  IF v_count < 6 THEN
    RAISE EXCEPTION 'Schema validation failed: jobs table missing columns';
  END IF;
  
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'notifications' 
  AND column_name IN ('id', 'user_id', 'type', 'entity_type', 'entity_id', 'is_read');
  
  IF v_count < 6 THEN
    RAISE EXCEPTION 'Schema validation failed: notifications table missing columns';
  END IF;
  
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'media_assets' 
  AND column_name IN ('id', 'key', 'public_url', 'bucket', 'path');
  
  IF v_count < 5 THEN
    RAISE EXCEPTION 'Schema validation failed: media_assets table missing columns';
  END IF;
  
  RAISE NOTICE 'Schema validation passed: All tables, enums, and columns verified';
END $$;

-- =====================================================
-- NOTIFY POSTGREST TO REFRESH SCHEMA CACHE
-- =====================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
