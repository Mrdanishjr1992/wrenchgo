-- =====================================================
-- INDEXES & PERFORMANCE
-- =====================================================
-- Purpose: All indexes for query performance
-- Safe for: supabase db reset

-- 1) PROFILES INDEXES
-- NOTE: profiles.email does NOT exist (email lives in auth.users)
CREATE INDEX IF NOT EXISTS profiles_auth_id_idx ON public.profiles(auth_id);
DROP INDEX IF EXISTS public.profiles_email_idx;

CREATE INDEX IF NOT EXISTS idx_profiles_id_status ON public.profiles(id_status);
CREATE INDEX IF NOT EXISTS idx_profiles_id_verified_at ON public.profiles(id_verified_at);
CREATE INDEX IF NOT EXISTS idx_profiles_public_card ON public.profiles(id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role) WHERE deleted_at IS NULL;

-- 2) MECHANIC_PROFILES INDEXES
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_is_available ON public.mechanic_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_is_verified ON public.mechanic_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_location ON public.mechanic_profiles(base_location_lat, base_location_lng);

-- 3) VEHICLES INDEXES
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON public.vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_created ON public.vehicles(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_id_customer_id ON public.vehicles(id, customer_id);

-- 4) JOBS INDEXES
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON public.jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_accepted_mechanic_id ON public.jobs(accepted_mechanic_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_canceled_at ON public.jobs(canceled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_vehicle_id ON public.jobs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_status_created ON public.jobs(customer_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON public.jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_accepted_mechanic_created ON public.jobs(accepted_mechanic_id, created_at);

-- 5) QUOTE_REQUESTS INDEXES
CREATE INDEX IF NOT EXISTS idx_quote_requests_job_id ON public.quote_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_mechanic_id ON public.quote_requests(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer_id ON public.quote_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON public.quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_accepted_at ON public.quote_requests(accepted_at);
CREATE INDEX IF NOT EXISTS idx_quote_requests_canceled_at ON public.quote_requests(canceled_at);
CREATE INDEX IF NOT EXISTS idx_quote_requests_job_status ON public.quote_requests(job_id, status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status_created ON public.quote_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_quote_requests_customer_created ON public.quote_requests(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quote_requests_mechanic_created ON public.quote_requests(mechanic_id, created_at);

-- 6) QUOTES INDEXES (legacy)
CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON public.quotes(job_id);
CREATE INDEX IF NOT EXISTS idx_quotes_mechanic_id ON public.quotes(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);

-- 7) MESSAGES INDEXES
-- NOTE: messages.recipient_id does NOT exist (recipient is derived from job participants)
CREATE INDEX IF NOT EXISTS idx_messages_job_id ON public.messages(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
DROP INDEX IF EXISTS public.idx_messages_recipient_unread;

-- Helpful for unread counts (per job): read_at is used for "unread"
CREATE INDEX IF NOT EXISTS idx_messages_job_unread ON public.messages(job_id) WHERE read_at IS NULL AND deleted_at IS NULL;


-- 8) SYMPTOM TABLES INDEXES

CREATE INDEX IF NOT EXISTS idx_symptom_mappings_category ON public.symptom_mappings(category);
CREATE INDEX IF NOT EXISTS idx_symptom_mappings_risk_level ON public.symptom_mappings(risk_level);

-- removed: idx_symptom_mappings_id (no id column)
DROP INDEX IF EXISTS public.idx_symptom_mappings_id;


-- 9) UNIQUE CONSTRAINTS (additional to PKs)

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_id_unique ON public.profiles(auth_id);

CREATE UNIQUE INDEX IF NOT EXISTS symptom_mappings_symptom_key_unique ON public.symptom_mappings(symptom_key);
-- removed: symptom_mappings_id_unique (no id column)
DROP INDEX IF EXISTS public.symptom_mappings_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS symptoms_key_unique ON public.symptoms(key);
CREATE UNIQUE INDEX IF NOT EXISTS symptom_questions_unique_key ON public.symptom_questions(symptom_key, question_key);
CREATE UNIQUE INDEX IF NOT EXISTS education_cards_symptom_card_unique ON public.education_cards(symptom_key, card_key);

