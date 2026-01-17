-- =====================================================
-- MIGRATION: MECHANIC VERIFICATION SELFIE PATCH (Phase 1.1)
-- =====================================================
-- Adds 'selfie_with_id' to mechanic_verification_documents doc_type
-- Updates completeness logic to require 4 documents
-- =====================================================

BEGIN;

-- =====================================================
-- A) UPDATE doc_type CHECK CONSTRAINT
-- =====================================================
-- Drop existing constraint and recreate with selfie_with_id
ALTER TABLE public.mechanic_verification_documents
  DROP CONSTRAINT IF EXISTS mechanic_verification_documents_doc_type_check;

ALTER TABLE public.mechanic_verification_documents
  ADD CONSTRAINT mechanic_verification_documents_doc_type_check
  CHECK (doc_type IN ('id_front', 'id_back', 'insurance', 'selfie_with_id'));

-- =====================================================
-- B) UPDATE admin_get_pending_verifications to show docs completeness
-- =====================================================
-- Must drop first because return type is changing
DROP FUNCTION IF EXISTS public.admin_get_pending_verifications(text);

CREATE OR REPLACE FUNCTION public.admin_get_pending_verifications(
  p_status_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  verification_status text,
  docs_count bigint,
  docs_complete boolean,
  vetting_count bigint,
  created_at timestamptz
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
    p.id,
    p.full_name,
    p.email,
    p.avatar_url,
    mp.verification_status,
    COUNT(DISTINCT d.id) as docs_count,
    -- docs_complete: true if all 4 required doc types exist
    (
      EXISTS(SELECT 1 FROM public.mechanic_verification_documents WHERE mechanic_id = p.id AND doc_type = 'id_front')
      AND EXISTS(SELECT 1 FROM public.mechanic_verification_documents WHERE mechanic_id = p.id AND doc_type = 'id_back')
      AND EXISTS(SELECT 1 FROM public.mechanic_verification_documents WHERE mechanic_id = p.id AND doc_type = 'insurance')
      AND EXISTS(SELECT 1 FROM public.mechanic_verification_documents WHERE mechanic_id = p.id AND doc_type = 'selfie_with_id')
    ) as docs_complete,
    COUNT(DISTINCT vr.id) as vetting_count,
    p.created_at
  FROM public.profiles p
  JOIN public.mechanic_profiles mp ON mp.id = p.id
  LEFT JOIN public.mechanic_verification_documents d ON d.mechanic_id = p.id
  LEFT JOIN public.mechanic_vetting_responses vr ON vr.mechanic_id = p.id
  WHERE p.role = 'mechanic'
    AND (p_status_filter IS NULL OR mp.verification_status = p_status_filter)
  GROUP BY p.id, p.full_name, p.email, p.avatar_url, mp.verification_status, p.created_at
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_pending_verifications(text) TO authenticated;

-- =====================================================
-- C) UPDATE get_mechanic_verification_status to return docs_complete
-- =====================================================
-- Drop first to avoid parameter default issues
DROP FUNCTION IF EXISTS public.get_mechanic_verification_status(uuid);

CREATE FUNCTION public.get_mechanic_verification_status(p_mechanic_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'status', mp.verification_status,
    'reason', mp.verification_reason,
    'updated_at', mp.verification_updated_at,
    'is_active', (mp.verification_status = 'active'),
    'documents_uploaded', COALESCE(docs.total, 0),
    'documents_approved', COALESCE(docs.approved, 0),
    'documents_required', 4,
    'docs_complete', (
      EXISTS(SELECT 1 FROM public.mechanic_verification_documents WHERE mechanic_id = p_mechanic_id AND doc_type = 'id_front')
      AND EXISTS(SELECT 1 FROM public.mechanic_verification_documents WHERE mechanic_id = p_mechanic_id AND doc_type = 'id_back')
      AND EXISTS(SELECT 1 FROM public.mechanic_verification_documents WHERE mechanic_id = p_mechanic_id AND doc_type = 'insurance')
      AND EXISTS(SELECT 1 FROM public.mechanic_verification_documents WHERE mechanic_id = p_mechanic_id AND doc_type = 'selfie_with_id')
    ),
    'vetting_responses', COALESCE(vetting.cnt, 0),
    'vetting_required', 5,
    'vetting_review_status', COALESCE(vr.status, 'pending')
  ) INTO v_result
  FROM public.mechanic_profiles mp
  LEFT JOIN (
    SELECT mechanic_id, COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'approved') as approved
    FROM public.mechanic_verification_documents
    WHERE mechanic_id = p_mechanic_id
    GROUP BY mechanic_id
  ) docs ON docs.mechanic_id = mp.id
  LEFT JOIN (
    SELECT mechanic_id, COUNT(*) as cnt
    FROM public.mechanic_vetting_responses
    WHERE mechanic_id = p_mechanic_id
    GROUP BY mechanic_id
  ) vetting ON vetting.mechanic_id = mp.id
  LEFT JOIN public.mechanic_vetting_reviews vr ON vr.mechanic_id = mp.id
  WHERE mp.id = p_mechanic_id;

  RETURN COALESCE(v_result, json_build_object(
    'status', 'pending_verification',
    'is_active', false,
    'documents_uploaded', 0,
    'documents_approved', 0,
    'documents_required', 4,
    'docs_complete', false,
    'vetting_responses', 0,
    'vetting_required', 5,
    'vetting_review_status', 'pending'
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mechanic_verification_status(uuid) TO authenticated;

COMMIT;
