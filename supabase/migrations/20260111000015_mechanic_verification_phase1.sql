-- =====================================================
-- MIGRATION: MECHANIC VERIFICATION PHASE 1
-- =====================================================
-- Purpose: Admin system, mechanic verification status, document uploads, vetting questionnaire
-- Enforces server-side gating for leads/quotes
-- =====================================================

BEGIN;

-- =====================================================
-- A) ADMIN USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  is_super boolean DEFAULT false NOT NULL
);

COMMENT ON TABLE public.admin_users IS 'Users with admin access to the platform';

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- A.1) is_admin helper function (SECURITY DEFINER)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = uid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = uid AND is_super = true
  );
END;
$$;

-- Admin RLS: admins can view, only super admins or service_role can modify
CREATE POLICY "admin_users_select_admin" ON public.admin_users
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_users_insert_super" ON public.admin_users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "admin_users_delete_super" ON public.admin_users
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Service role can manage all
CREATE POLICY "admin_users_service_role" ON public.admin_users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;

-- =====================================================
-- B) VERIFICATION STATUS ON MECHANIC_PROFILES
-- =====================================================
ALTER TABLE public.mechanic_profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending_verification',
  ADD COLUMN IF NOT EXISTS verification_updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS verification_reason text;

-- Add check constraint for verification status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mechanic_profiles_verification_status_check'
  ) THEN
    ALTER TABLE public.mechanic_profiles
      ADD CONSTRAINT mechanic_profiles_verification_status_check
      CHECK (verification_status IN ('pending_verification', 'active', 'paused', 'removed'));
  END IF;
END $$;

-- Index for filtering by verification status
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_verification_status
  ON public.mechanic_profiles(verification_status);

-- =====================================================
-- C) MECHANIC VERIFICATION DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  bucket text DEFAULT 'mechanic-verification' NOT NULL,
  path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  uploaded_at timestamptz DEFAULT now() NOT NULL,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  review_notes text,
  
  CONSTRAINT mechanic_verification_documents_doc_type_check
    CHECK (doc_type IN ('id_front', 'id_back', 'insurance')),
  CONSTRAINT mechanic_verification_documents_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  UNIQUE(mechanic_id, doc_type)
);

COMMENT ON TABLE public.mechanic_verification_documents IS 'Documents uploaded by mechanics for verification';

ALTER TABLE public.mechanic_verification_documents ENABLE ROW LEVEL SECURITY;

-- Mechanics can insert/select their own docs
CREATE POLICY "verification_docs_select_own" ON public.mechanic_verification_documents
  FOR SELECT TO authenticated
  USING (mechanic_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "verification_docs_insert_own" ON public.mechanic_verification_documents
  FOR INSERT TO authenticated
  WITH CHECK (mechanic_id = auth.uid());

-- Only admins can update (for review)
CREATE POLICY "verification_docs_update_admin" ON public.mechanic_verification_documents
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Service role full access
CREATE POLICY "verification_docs_service_role" ON public.mechanic_verification_documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.mechanic_verification_documents TO authenticated;
GRANT UPDATE (status, reviewed_at, reviewed_by, review_notes) ON public.mechanic_verification_documents TO authenticated;
GRANT ALL ON public.mechanic_verification_documents TO service_role;

-- =====================================================
-- D) MECHANIC VETTING RESPONSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_vetting_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prompt_key text NOT NULL,
  prompt_text text NOT NULL,
  response_text text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(mechanic_id, prompt_key)
);

COMMENT ON TABLE public.mechanic_vetting_responses IS 'Mechanic responses to vetting questionnaire';

ALTER TABLE public.mechanic_vetting_responses ENABLE ROW LEVEL SECURITY;

-- Mechanics can insert/update/select their own responses
CREATE POLICY "vetting_responses_select_own" ON public.mechanic_vetting_responses
  FOR SELECT TO authenticated
  USING (mechanic_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "vetting_responses_insert_own" ON public.mechanic_vetting_responses
  FOR INSERT TO authenticated
  WITH CHECK (mechanic_id = auth.uid());

CREATE POLICY "vetting_responses_update_own" ON public.mechanic_vetting_responses
  FOR UPDATE TO authenticated
  USING (mechanic_id = auth.uid())
  WITH CHECK (mechanic_id = auth.uid());

-- Service role full access
CREATE POLICY "vetting_responses_service_role" ON public.mechanic_vetting_responses
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.mechanic_vetting_responses TO authenticated;
GRANT ALL ON public.mechanic_vetting_responses TO service_role;

-- =====================================================
-- D.2) MECHANIC VETTING REVIEWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mechanic_vetting_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT mechanic_vetting_reviews_status_check
    CHECK (status IN ('pending', 'pass', 'fail', 'needs_more_info'))
);

COMMENT ON TABLE public.mechanic_vetting_reviews IS 'Admin review of mechanic vetting questionnaire';

ALTER TABLE public.mechanic_vetting_reviews ENABLE ROW LEVEL SECURITY;

-- Mechanics can view their own review status
CREATE POLICY "vetting_reviews_select_own" ON public.mechanic_vetting_reviews
  FOR SELECT TO authenticated
  USING (mechanic_id = auth.uid() OR public.is_admin(auth.uid()));

-- Only admins can insert/update
CREATE POLICY "vetting_reviews_insert_admin" ON public.mechanic_vetting_reviews
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "vetting_reviews_update_admin" ON public.mechanic_vetting_reviews
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Service role full access
CREATE POLICY "vetting_reviews_service_role" ON public.mechanic_vetting_reviews
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.mechanic_vetting_reviews TO authenticated;
GRANT INSERT, UPDATE ON public.mechanic_vetting_reviews TO authenticated;
GRANT ALL ON public.mechanic_vetting_reviews TO service_role;

-- =====================================================
-- E) SERVER-SIDE GATING: get_mechanic_verification_status RPC
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_mechanic_verification_status(p_mechanic_id uuid DEFAULT auth.uid())
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_reason text;
  v_docs_count int;
  v_docs_approved int;
  v_vetting_count int;
  v_vetting_review_status text;
BEGIN
  -- Get verification status
  SELECT verification_status, verification_reason
  INTO v_status, v_reason
  FROM public.mechanic_profiles
  WHERE id = p_mechanic_id;
  
  IF v_status IS NULL THEN
    RETURN json_build_object(
      'status', 'not_found',
      'is_active', false,
      'can_view_leads', false,
      'can_submit_quotes', false
    );
  END IF;
  
  -- Count documents
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'approved')
  INTO v_docs_count, v_docs_approved
  FROM public.mechanic_verification_documents
  WHERE mechanic_id = p_mechanic_id;
  
  -- Count vetting responses
  SELECT COUNT(*)
  INTO v_vetting_count
  FROM public.mechanic_vetting_responses
  WHERE mechanic_id = p_mechanic_id;
  
  -- Get vetting review status
  SELECT status INTO v_vetting_review_status
  FROM public.mechanic_vetting_reviews
  WHERE mechanic_id = p_mechanic_id;
  
  RETURN json_build_object(
    'status', v_status,
    'reason', v_reason,
    'is_active', v_status = 'active',
    'can_view_leads', v_status = 'active',
    'can_submit_quotes', v_status = 'active',
    'documents_uploaded', v_docs_count,
    'documents_approved', v_docs_approved,
    'documents_required', 3,
    'vetting_responses', v_vetting_count,
    'vetting_required', 5,
    'vetting_review_status', COALESCE(v_vetting_review_status, 'pending')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_verification_status(uuid) TO authenticated;

-- =====================================================
-- E.2) UPDATE get_mechanic_leads to enforce verification
-- =====================================================
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
  urgency text,
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
  v_verification_status text;
BEGIN
  -- VERIFICATION GATE: Check mechanic is active
  SELECT mp.verification_status INTO v_verification_status
  FROM public.mechanic_profiles mp
  WHERE mp.id = p_mechanic_id;
  
  IF v_verification_status IS NULL OR v_verification_status != 'active' THEN
    -- Return empty result set for non-active mechanics
    RETURN;
  END IF;

  RETURN QUERY
  WITH mechanic_quotes AS (
    SELECT DISTINCT q.job_id as qjob_id
    FROM public.quotes q
    WHERE q.mechanic_id = p_mechanic_id
      AND q.status NOT IN ('cancelled', 'expired')
  ),
  quote_counts AS (
    SELECT q.job_id as cjob_id, COUNT(*) as cnt
    FROM public.quotes q
    WHERE q.status NOT IN ('cancelled', 'expired')
    GROUP BY q.job_id
  )
  SELECT
    j.id as job_id,
    j.title,
    j.description,
    j.status::text,
    j.urgency::text,
    j.preferred_time,
    j.vehicle_year,
    j.vehicle_make,
    j.vehicle_model,
    j.vehicle_vin,
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
      THEN (
        3959 * acos(
          cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
          sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
        )
      )::numeric
      ELSE NULL
    END as distance_miles,
    COALESCE(qc.cnt, 0) as quote_count,
    mq.qjob_id IS NOT NULL as has_quoted
  FROM public.jobs j
  JOIN public.profiles p ON p.id = j.customer_id
  LEFT JOIN mechanic_quotes mq ON mq.qjob_id = j.id
  LEFT JOIN quote_counts qc ON qc.cjob_id = j.id
  WHERE j.status = 'searching'
    AND j.deleted_at IS NULL
    AND (
      p_filter = 'all'
      OR (p_filter = 'nearby' AND p_mechanic_lat IS NOT NULL AND p_mechanic_lng IS NOT NULL AND (
        3959 * acos(
          cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
          cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
          sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
        )
      ) <= p_radius_miles)
      OR (p_filter = 'quoted' AND mq.qjob_id IS NOT NULL)
      OR (p_filter = 'not_quoted' AND mq.qjob_id IS NULL)
    )
  ORDER BY
    CASE WHEN p_sort_by = 'newest' THEN j.created_at END DESC,
    CASE WHEN p_sort_by = 'oldest' THEN j.created_at END ASC,
    CASE WHEN p_sort_by = 'distance' AND p_mechanic_lat IS NOT NULL THEN
      3959 * acos(
        cos(radians(p_mechanic_lat)) * cos(radians(j.location_lat)) *
        cos(radians(j.location_lng) - radians(p_mechanic_lng)) +
        sin(radians(p_mechanic_lat)) * sin(radians(j.location_lat))
      )
    END ASC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_leads(uuid, text, double precision, double precision, double precision, integer, integer, text) TO authenticated;

-- =====================================================
-- E.3) RLS POLICY: quotes INSERT requires active verification
-- =====================================================
-- First, check if existing insert policy exists and drop it
DROP POLICY IF EXISTS "quotes_mechanic_insert" ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert_own" ON public.quotes;

-- Create new insert policy with verification check
CREATE POLICY "quotes_insert_verified_mechanic" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    mechanic_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.mechanic_profiles mp
      WHERE mp.id = auth.uid()
      AND mp.verification_status = 'active'
    )
  );

-- =====================================================
-- E.4) RLS POLICY: quote_requests INSERT requires active verification
-- =====================================================
DROP POLICY IF EXISTS "quote_requests_mechanic_insert" ON public.quote_requests;
DROP POLICY IF EXISTS "quote_requests_insert_own" ON public.quote_requests;

CREATE POLICY "quote_requests_insert_verified_mechanic" ON public.quote_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    mechanic_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.mechanic_profiles mp
      WHERE mp.id = auth.uid()
      AND mp.verification_status = 'active'
    )
  );

-- =====================================================
-- F) ADMIN RPCs
-- =====================================================

-- Get pending verifications for admin
CREATE OR REPLACE FUNCTION public.admin_get_pending_verifications()
RETURNS TABLE (
  mechanic_id uuid,
  full_name text,
  email text,
  avatar_url text,
  verification_status text,
  verification_reason text,
  created_at timestamptz,
  docs_pending int,
  docs_approved int,
  docs_rejected int,
  vetting_responses int,
  vetting_review_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  
  RETURN QUERY
  SELECT
    p.id as mechanic_id,
    p.full_name,
    p.email,
    p.avatar_url,
    mp.verification_status,
    mp.verification_reason,
    p.created_at,
    COUNT(d.id) FILTER (WHERE d.status = 'pending')::int as docs_pending,
    COUNT(d.id) FILTER (WHERE d.status = 'approved')::int as docs_approved,
    COUNT(d.id) FILTER (WHERE d.status = 'rejected')::int as docs_rejected,
    COUNT(vr.id)::int as vetting_responses,
    COALESCE(vrv.status, 'pending') as vetting_review_status
  FROM public.profiles p
  JOIN public.mechanic_profiles mp ON mp.id = p.id
  LEFT JOIN public.mechanic_verification_documents d ON d.mechanic_id = p.id
  LEFT JOIN public.mechanic_vetting_responses vr ON vr.mechanic_id = p.id
  LEFT JOIN public.mechanic_vetting_reviews vrv ON vrv.mechanic_id = p.id
  WHERE p.role = 'mechanic'
    AND (
      mp.verification_status = 'pending_verification'
      OR EXISTS (SELECT 1 FROM public.mechanic_verification_documents WHERE mechanic_id = p.id AND status = 'pending')
      OR (vrv.status IS NULL OR vrv.status = 'pending')
    )
  GROUP BY p.id, p.full_name, p.email, p.avatar_url, mp.verification_status, mp.verification_reason, p.created_at, vrv.status
  ORDER BY p.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_pending_verifications() TO authenticated;

-- Admin: Get mechanic verification details
CREATE OR REPLACE FUNCTION public.admin_get_mechanic_verification_details(p_mechanic_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  
  SELECT json_build_object(
    'profile', (
      SELECT json_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'phone', p.phone,
        'avatar_url', p.avatar_url,
        'created_at', p.created_at
      )
      FROM public.profiles p WHERE p.id = p_mechanic_id
    ),
    'mechanic_profile', (
      SELECT json_build_object(
        'verification_status', mp.verification_status,
        'verification_reason', mp.verification_reason,
        'verification_updated_at', mp.verification_updated_at,
        'bio', mp.bio,
        'years_experience', mp.years_experience
      )
      FROM public.mechanic_profiles mp WHERE mp.id = p_mechanic_id
    ),
    'documents', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', d.id,
        'doc_type', d.doc_type,
        'path', d.path,
        'bucket', d.bucket,
        'status', d.status,
        'uploaded_at', d.uploaded_at,
        'reviewed_at', d.reviewed_at,
        'review_notes', d.review_notes
      )), '[]'::json)
      FROM public.mechanic_verification_documents d WHERE d.mechanic_id = p_mechanic_id
    ),
    'vetting_responses', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', vr.id,
        'prompt_key', vr.prompt_key,
        'prompt_text', vr.prompt_text,
        'response_text', vr.response_text,
        'created_at', vr.created_at
      )), '[]'::json)
      FROM public.mechanic_vetting_responses vr WHERE vr.mechanic_id = p_mechanic_id
    ),
    'vetting_review', (
      SELECT json_build_object(
        'id', vrv.id,
        'status', vrv.status,
        'notes', vrv.notes,
        'reviewed_at', vrv.reviewed_at
      )
      FROM public.mechanic_vetting_reviews vrv WHERE vrv.mechanic_id = p_mechanic_id
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_mechanic_verification_details(uuid) TO authenticated;

-- Admin: Update document status
CREATE OR REPLACE FUNCTION public.admin_review_document(
  p_doc_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: must be approved or rejected';
  END IF;
  
  UPDATE public.mechanic_verification_documents
  SET 
    status = p_status,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = p_notes
  WHERE id = p_doc_id;
  
  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_document(uuid, text, text) TO authenticated;

-- Admin: Update vetting review
CREATE OR REPLACE FUNCTION public.admin_review_vetting(
  p_mechanic_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  
  IF p_status NOT IN ('pass', 'fail', 'needs_more_info') THEN
    RAISE EXCEPTION 'Invalid status: must be pass, fail, or needs_more_info';
  END IF;
  
  INSERT INTO public.mechanic_vetting_reviews (mechanic_id, status, notes, reviewed_by, reviewed_at)
  VALUES (p_mechanic_id, p_status, p_notes, auth.uid(), now())
  ON CONFLICT (mechanic_id) DO UPDATE SET
    status = p_status,
    notes = p_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now();
  
  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_vetting(uuid, text, text) TO authenticated;

-- Admin: Set mechanic verification status
CREATE OR REPLACE FUNCTION public.admin_set_verification_status(
  p_mechanic_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  
  IF p_status NOT IN ('pending_verification', 'active', 'paused', 'removed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  
  UPDATE public.mechanic_profiles
  SET 
    verification_status = p_status,
    verification_reason = p_reason,
    verification_updated_at = now()
  WHERE id = p_mechanic_id;
  
  RETURN json_build_object('success', true, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_verification_status(uuid, text, text) TO authenticated;

COMMIT;
