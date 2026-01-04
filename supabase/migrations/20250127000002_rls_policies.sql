-- =====================================================
-- RLS POLICIES: Row Level Security
-- =====================================================
-- Purpose: Enable RLS and create all access policies
-- Safe for: supabase db reset

-- 1) ENABLE RLS ON ALL TABLES

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_refinements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_measures ENABLE ROW LEVEL SECURITY;

-- 2) PROFILES POLICIES

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS "Users can view public profile cards" ON public.profiles;
CREATE POLICY "Users can view public profile cards"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL AND role IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own role if null" ON public.profiles;
CREATE POLICY "Users can update their own role if null"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid() AND role IS NULL)
  WITH CHECK (auth_id = auth.uid());

COMMENT ON POLICY "Users can update their own role if null" ON public.profiles IS
  'Allows users to set their role during onboarding via set_user_role() RPC. Role can only be set once.';

-- 3) MECHANIC_PROFILES POLICIES

DROP POLICY IF EXISTS "Mechanics can view their own mechanic profile" ON public.mechanic_profiles;
CREATE POLICY "Mechanics can view their own mechanic profile"
  ON public.mechanic_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can update their own mechanic profile" ON public.mechanic_profiles;
CREATE POLICY "Mechanics can update their own mechanic profile"
  ON public.mechanic_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Anyone can view available mechanics" ON public.mechanic_profiles;
CREATE POLICY "Anyone can view available mechanics"
  ON public.mechanic_profiles FOR SELECT
  TO authenticated
  USING (is_available = true);

-- 4) VEHICLES POLICIES

DROP POLICY IF EXISTS "Customers can view their own vehicles" ON public.vehicles;
CREATE POLICY "Customers can view their own vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert their own vehicles" ON public.vehicles;
CREATE POLICY "Customers can insert their own vehicles"
  ON public.vehicles FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update their own vehicles" ON public.vehicles;
CREATE POLICY "Customers can update their own vehicles"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can delete their own vehicles" ON public.vehicles;
CREATE POLICY "Customers can delete their own vehicles"
  ON public.vehicles FOR DELETE
  TO authenticated
  USING (customer_id = auth.uid());

-- 5) JOBS POLICIES

DROP POLICY IF EXISTS "Customers can view their own jobs" ON public.jobs;
CREATE POLICY "Customers can view their own jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can view jobs they're assigned to" ON public.jobs;
CREATE POLICY "Mechanics can view jobs they're assigned to"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (accepted_mechanic_id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can view searching jobs" ON public.jobs;
CREATE POLICY "Mechanics can view searching jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (status = 'searching');

DROP POLICY IF EXISTS "Customers can insert their own jobs" ON public.jobs;
CREATE POLICY "Customers can insert their own jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update their own jobs" ON public.jobs;
CREATE POLICY "Customers can update their own jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can update jobs they're assigned to" ON public.jobs;
CREATE POLICY "Mechanics can update jobs they're assigned to"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (accepted_mechanic_id = auth.uid())
  WITH CHECK (accepted_mechanic_id = auth.uid());

-- 6) QUOTE_REQUESTS POLICIES

DROP POLICY IF EXISTS "Customers can view quotes for their jobs" ON public.quote_requests;
CREATE POLICY "Customers can view quotes for their jobs"
  ON public.quote_requests FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can view their own quotes" ON public.quote_requests;
CREATE POLICY "Mechanics can view their own quotes"
  ON public.quote_requests FOR SELECT
  TO authenticated
  USING (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can insert quotes" ON public.quote_requests;
CREATE POLICY "Mechanics can insert quotes"
  ON public.quote_requests FOR INSERT
  TO authenticated
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can update their own quotes" ON public.quote_requests;
CREATE POLICY "Mechanics can update their own quotes"
  ON public.quote_requests FOR UPDATE
  TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update quotes for their jobs" ON public.quote_requests;
CREATE POLICY "Customers can update quotes for their jobs"
  ON public.quote_requests FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- 7) QUOTES POLICIES (legacy table)

DROP POLICY IF EXISTS "Customers can view quotes for their jobs" ON public.quotes;
CREATE POLICY "Customers can view quotes for their jobs"
  ON public.quotes FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Mechanics can view their own quotes" ON public.quotes;
CREATE POLICY "Mechanics can view their own quotes"
  ON public.quotes FOR SELECT
  TO authenticated
  USING (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can insert quotes" ON public.quotes;
CREATE POLICY "Mechanics can insert quotes"
  ON public.quotes FOR INSERT
  TO authenticated
  WITH CHECK (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "Mechanics can update their own quotes" ON public.quotes;
CREATE POLICY "Mechanics can update their own quotes"
  ON public.quotes FOR UPDATE
  TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

-- 8) MESSAGES POLICIES
-- hard clean all message policies that might exist (by known names)
DROP POLICY IF EXISTS "Users can view messages for their jobs" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages for their jobs" ON public.messages;

-- 8) MESSAGES POLICIES (FIXED: no recipient_id column)

-- Remove any legacy/broken policies
DROP POLICY IF EXISTS "Users can view messages they sent" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages sent to them" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages for jobs they're involved in" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

-- SELECT: allow users to read messages for jobs they participate in (customer or accepted mechanic)
CREATE POLICY "Users can view messages for their jobs"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = messages.job_id
        AND (
          j.customer_id = auth.uid()
          OR j.accepted_mechanic_id = auth.uid()
        )
    )
  );

-- INSERT: allow users to send messages only within jobs they participate in
CREATE POLICY "Users can insert messages for their jobs"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = messages.job_id
        AND (
          j.customer_id = auth.uid()
          OR j.accepted_mechanic_id = auth.uid()
        )
    )
  );

-- UPDATE: allow users to update ONLY their own messages (and only if not soft-deleted)
CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND deleted_at IS NULL
  );

-- NOTE: No DELETE policy on purpose (soft-delete only).
-- With RLS enabled and no DELETE policy, hard deletes will be denied.


-- 9) LOOKUP TABLES POLICIES (public read)

DROP POLICY IF EXISTS "Anyone can view symptoms" ON public.symptoms;
CREATE POLICY "Anyone can view symptoms"
  ON public.symptoms FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view symptom_mappings" ON public.symptom_mappings;
CREATE POLICY "Anyone can view symptom_mappings"
  ON public.symptom_mappings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view symptom_questions" ON public.symptom_questions;
CREATE POLICY "Anyone can view symptom_questions"
  ON public.symptom_questions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view symptom_question_options" ON public.symptom_question_options;
CREATE POLICY "Anyone can view symptom_question_options"
  ON public.symptom_question_options FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view symptom_refinements" ON public.symptom_refinements;
CREATE POLICY "Anyone can view symptom_refinements"
  ON public.symptom_refinements FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can view symptom_education" ON public.symptom_education;
CREATE POLICY "Anyone can view symptom_education"
  ON public.symptom_education FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view education_cards" ON public.education_cards;
CREATE POLICY "Anyone can view education_cards"
  ON public.education_cards FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view skills" ON public.skills;
CREATE POLICY "Anyone can view skills"
  ON public.skills FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view tools" ON public.tools;
CREATE POLICY "Anyone can view tools"
  ON public.tools FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view safety_measures" ON public.safety_measures;
CREATE POLICY "Anyone can view safety_measures"
  ON public.safety_measures FOR SELECT
  TO authenticated
  USING (true);
