-- =====================================================
-- MIGRATION 0005: INDEXES AND PERFORMANCE
-- =====================================================
-- Purpose: All database indexes for query performance
-- Depends on: 0001_baseline_schema.sql
-- =====================================================

BEGIN;

-- =====================================================
-- PROFILES INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(home_lat, home_lng) WHERE deleted_at IS NULL;

-- =====================================================
-- VEHICLES INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON public.vehicles(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON public.vehicles(vin) WHERE vin IS NOT NULL AND deleted_at IS NULL;

-- =====================================================
-- JOBS INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON public.jobs(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_mechanic ON public.jobs(accepted_mechanic_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_location ON public.jobs(location_lat, location_lng) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_searching ON public.jobs(status, created_at DESC) 
  WHERE status IN ('searching', 'quoted') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_created ON public.jobs(created_at DESC) WHERE deleted_at IS NULL;

-- =====================================================
-- QUOTE_REQUESTS INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_quote_requests_job ON public.quote_requests(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_requests_mechanic ON public.quote_requests(mechanic_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer ON public.quote_requests(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON public.quote_requests(status) WHERE deleted_at IS NULL;

-- =====================================================
-- REVIEWS INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_reviews_job ON public.reviews(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.reviews(reviewer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id) WHERE deleted_at IS NULL;

-- =====================================================
-- MECHANIC_PROFILES INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_available ON public.mechanic_profiles(is_available) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_rating ON public.mechanic_profiles(rating_avg DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_stripe ON public.mechanic_profiles(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- =====================================================
-- MECHANIC SKILLS/TOOLS/SAFETY INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mechanic_skills_mechanic ON public.mechanic_skills(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_skills_key ON public.mechanic_skills(skill_key);
CREATE INDEX IF NOT EXISTS idx_mechanic_tools_mechanic ON public.mechanic_tools(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_tools_key ON public.mechanic_tools(tool_key);
CREATE INDEX IF NOT EXISTS idx_mechanic_safety_mechanic ON public.mechanic_safety(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_safety_key ON public.mechanic_safety(safety_key);

-- =====================================================
-- SYMPTOM TABLES INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_symptom_mappings_category ON public.symptom_mappings(category);
CREATE INDEX IF NOT EXISTS idx_symptom_mappings_risk ON public.symptom_mappings(risk_level);
CREATE INDEX IF NOT EXISTS idx_education_cards_symptom ON public.education_cards(symptom_key);
CREATE INDEX IF NOT EXISTS idx_symptom_questions_symptom ON public.symptom_questions(symptom_key);
CREATE INDEX IF NOT EXISTS idx_symptom_questions_order ON public.symptom_questions(symptom_key, display_order);

-- =====================================================
-- MESSAGES INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_messages_job ON public.messages(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(recipient_id, read_at) 
  WHERE read_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(job_id, created_at DESC) WHERE deleted_at IS NULL;

-- =====================================================
-- NOTIFICATIONS INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) 
  WHERE is_read = false AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON public.notifications(entity_type, entity_id) WHERE deleted_at IS NULL;

-- =====================================================
-- MEDIA_ASSETS INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_media_assets_key ON public.media_assets(key) WHERE key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_job ON public.media_assets(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by ON public.media_assets(uploaded_by) WHERE deleted_at IS NULL;

-- =====================================================
-- PAYMENT INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_mechanic_stripe_accounts_mechanic ON public.mechanic_stripe_accounts(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_stripe_accounts_stripe ON public.mechanic_stripe_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer ON public.customer_payment_methods(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_job ON public.payments(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_mechanic ON public.payments(mechanic_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_stripe ON public.payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

COMMIT;
