-- Migration: Job Media Photo Evidence System
-- Enables camera photo attachments for customers and mechanics during job lifecycle
-- Photos can be used as evidence in Support Tickets and Disputes

BEGIN;

-- =====================================================
-- 1. UPDATE job_media RLS POLICIES (drop and recreate for stricter enforcement)
-- =====================================================

DROP POLICY IF EXISTS "Job parties can view media" ON public.job_media;
DROP POLICY IF EXISTS "Participants can upload media" ON public.job_media;
DROP POLICY IF EXISTS "Uploaders can delete own media" ON public.job_media;
DROP POLICY IF EXISTS "job_media_admin_select" ON public.job_media;
DROP POLICY IF EXISTS "job_media_admin_all" ON public.job_media;

-- SELECT: job participants (customer/mechanic) and admins can view
CREATE POLICY "job_media_select_participants" ON public.job_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
      WHERE j.id = job_media.job_id
        AND (
          j.customer_id = auth.uid()
          OR jc.mechanic_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        )
    )
  );

-- INSERT: only job participants can upload with their role
CREATE POLICY "job_media_insert_participants" ON public.job_media
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
      WHERE j.id = job_media.job_id
        AND (
          (j.customer_id = auth.uid() AND job_media.uploaded_by_role = 'customer')
          OR (jc.mechanic_id = auth.uid() AND job_media.uploaded_by_role = 'mechanic')
        )
    )
  );

-- UPDATE: only owner within 10 minutes or admin
CREATE POLICY "job_media_update_owner_or_admin" ON public.job_media
  FOR UPDATE USING (
    (uploaded_by = auth.uid() AND created_at > now() - interval '10 minutes')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- DELETE: only owner within 10 minutes or admin
CREATE POLICY "job_media_delete_owner_or_admin" ON public.job_media
  FOR DELETE USING (
    (uploaded_by = auth.uid() AND created_at > now() - interval '10 minutes')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- =====================================================
-- 2. STORAGE BUCKET FOR JOB MEDIA
-- =====================================================

-- Create storage bucket if not exists (handled by Supabase dashboard or seed)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('job-media', 'job-media', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for job-media bucket
DROP POLICY IF EXISTS "job_media_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "job_media_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "job_media_storage_delete" ON storage.objects;

-- SELECT: job participants and admins can read
CREATE POLICY "job_media_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'job-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.job_media jm
        JOIN public.jobs j ON j.id = jm.job_id
        LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
        WHERE jm.path = storage.objects.name
          AND (
            j.customer_id = auth.uid()
            OR jc.mechanic_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
          )
      )
    )
  );

-- INSERT: job participants can upload to their job path
CREATE POLICY "job_media_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-media'
    AND (
      -- Path format: {job_id}/{role}/{category}/{uuid}.jpg
      -- Verify the job_id in path belongs to the uploader
      EXISTS (
        SELECT 1 FROM public.jobs j
        LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
        WHERE (
          (j.customer_id = auth.uid() AND storage.objects.name LIKE j.id::text || '/customer/%')
          OR (jc.mechanic_id = auth.uid() AND storage.objects.name LIKE j.id::text || '/mechanic/%')
        )
      )
    )
  );

-- DELETE: only admins can delete from storage
CREATE POLICY "job_media_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'job-media'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- =====================================================
-- 3. RPC: create_job_media_record
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_job_media_record(
  p_job_id uuid,
  p_media_category text,
  p_path text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_contract_id uuid DEFAULT NULL,
  p_caption text DEFAULT NULL,
  p_taken_at timestamptz DEFAULT NULL
)
RETURNS public.job_media
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_is_participant boolean := false;
  v_result public.job_media;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user role
  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Validate media category
  IF p_media_category NOT IN ('customer_request', 'mechanic_before', 'mechanic_after', 'dispute_evidence', 'support_evidence', 'parts_receipt', 'other') THEN
    RAISE EXCEPTION 'Invalid media category: %', p_media_category;
  END IF;

  -- Check if user is job participant
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
    WHERE j.id = p_job_id
      AND (
        (j.customer_id = v_user_id AND v_user_role = 'customer')
        OR (jc.mechanic_id = v_user_id AND v_user_role = 'mechanic')
        OR v_user_role = 'admin'
      )
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Not authorized to upload media for this job';
  END IF;

  -- Insert the record
  INSERT INTO public.job_media (
    job_id,
    contract_id,
    uploaded_by,
    uploaded_by_role,
    media_type,
    media_category,
    bucket,
    path,
    caption,
    file_size_bytes,
    mime_type,
    taken_at
  ) VALUES (
    p_job_id,
    p_contract_id,
    v_user_id,
    v_user_role,
    'image',
    p_media_category,
    'job-media',
    p_path,
    p_caption,
    p_file_size_bytes,
    p_mime_type,
    p_taken_at
  )
  RETURNING * INTO v_result;

  -- Log to job_events
  INSERT INTO public.job_events (
    job_id,
    contract_id,
    event_type,
    actor_id,
    metadata
  ) VALUES (
    p_job_id,
    p_contract_id,
    'media_uploaded',
    v_user_id,
    jsonb_build_object(
      'media_id', v_result.id,
      'category', p_media_category,
      'role', v_user_role::text
    )
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- 4. RPC: list_job_media
-- =====================================================

CREATE OR REPLACE FUNCTION public.list_job_media(
  p_job_id uuid,
  p_category text DEFAULT NULL
)
RETURNS SETOF public.job_media
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_is_authorized boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

  -- Check authorization
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
    WHERE j.id = p_job_id
      AND (
        j.customer_id = v_user_id
        OR jc.mechanic_id = v_user_id
        OR v_user_role = 'admin'
      )
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to view media for this job';
  END IF;

  RETURN QUERY
  SELECT * FROM public.job_media jm
  WHERE jm.job_id = p_job_id
    AND (p_category IS NULL OR jm.media_category = p_category)
  ORDER BY jm.created_at DESC;
END;
$$;

-- =====================================================
-- 5. RPC: attach_media_to_support_request
-- =====================================================

CREATE OR REPLACE FUNCTION public.attach_media_to_support_request(
  p_support_request_id uuid,
  p_media_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_sr_user_id uuid;
  v_current_metadata jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  SELECT user_id, metadata INTO v_sr_user_id, v_current_metadata
  FROM public.support_requests WHERE id = p_support_request_id;

  IF v_sr_user_id IS NULL THEN
    RAISE EXCEPTION 'Support request not found';
  END IF;

  -- Only owner or admin can attach media
  IF v_sr_user_id != v_user_id AND v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Not authorized to attach media to this support request';
  END IF;

  -- Update metadata with evidence_media_ids
  UPDATE public.support_requests
  SET metadata = COALESCE(v_current_metadata, '{}'::jsonb) || 
                 jsonb_build_object('evidence_media_ids', to_jsonb(p_media_ids))
  WHERE id = p_support_request_id;

  RETURN true;
END;
$$;

-- =====================================================
-- 6. RPC: attach_media_to_dispute
-- =====================================================

CREATE OR REPLACE FUNCTION public.attach_media_to_dispute(
  p_dispute_id uuid,
  p_media_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_dispute_filed_by uuid;
  v_job_id uuid;
  v_media_paths text[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  SELECT filed_by, job_id INTO v_dispute_filed_by, v_job_id
  FROM public.disputes WHERE id = p_dispute_id;

  IF v_dispute_filed_by IS NULL THEN
    RAISE EXCEPTION 'Dispute not found';
  END IF;

  -- Only filer or admin can attach media
  IF v_dispute_filed_by != v_user_id AND v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Not authorized to attach media to this dispute';
  END IF;

  -- Get paths from job_media for the given IDs
  SELECT array_agg(path) INTO v_media_paths
  FROM public.job_media
  WHERE id = ANY(p_media_ids) AND job_id = v_job_id;

  -- Update dispute evidence_urls
  UPDATE public.disputes
  SET evidence_urls = COALESCE(evidence_urls, ARRAY[]::text[]) || v_media_paths
  WHERE id = p_dispute_id;

  RETURN true;
END;
$$;

-- =====================================================
-- 7. RPC: get_job_evidence_for_admin (for admin screens)
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_job_evidence(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'customer_request', COALESCE((
      SELECT jsonb_agg(row_to_json(m.*))
      FROM public.job_media m WHERE m.job_id = p_job_id AND m.media_category = 'customer_request'
    ), '[]'::jsonb),
    'mechanic_before', COALESCE((
      SELECT jsonb_agg(row_to_json(m.*))
      FROM public.job_media m WHERE m.job_id = p_job_id AND m.media_category = 'mechanic_before'
    ), '[]'::jsonb),
    'mechanic_after', COALESCE((
      SELECT jsonb_agg(row_to_json(m.*))
      FROM public.job_media m WHERE m.job_id = p_job_id AND m.media_category = 'mechanic_after'
    ), '[]'::jsonb),
    'dispute_evidence', COALESCE((
      SELECT jsonb_agg(row_to_json(m.*))
      FROM public.job_media m WHERE m.job_id = p_job_id AND m.media_category = 'dispute_evidence'
    ), '[]'::jsonb),
    'support_evidence', COALESCE((
      SELECT jsonb_agg(row_to_json(m.*))
      FROM public.job_media m WHERE m.job_id = p_job_id AND m.media_category = 'support_evidence'
    ), '[]'::jsonb),
    'parts_receipt', COALESCE((
      SELECT jsonb_agg(row_to_json(m.*))
      FROM public.job_media m WHERE m.job_id = p_job_id AND m.media_category = 'parts_receipt'
    ), '[]'::jsonb),
    'other', COALESCE((
      SELECT jsonb_agg(row_to_json(m.*))
      FROM public.job_media m WHERE m.job_id = p_job_id AND m.media_category = 'other'
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- 8. GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.create_job_media_record(uuid, text, text, text, bigint, uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_job_media(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_media_to_support_request(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_media_to_dispute(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_job_evidence(uuid) TO authenticated;

-- =====================================================
-- 9. INDEX for media_category lookups
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_job_media_category ON public.job_media(media_category);
CREATE INDEX IF NOT EXISTS idx_job_media_uploaded_by ON public.job_media(uploaded_by);

COMMIT;
