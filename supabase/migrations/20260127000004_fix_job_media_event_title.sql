-- Drop all overloaded versions of create_job_media_record
DROP FUNCTION IF EXISTS public.create_job_media_record(uuid, text, text, text, int, uuid, text, timestamptz);
DROP FUNCTION IF EXISTS public.create_job_media_record(uuid, text, text, text, bigint, uuid, text, timestamptz);

-- Recreate with bigint for file size
CREATE OR REPLACE FUNCTION public.create_job_media_record(
  p_job_id uuid,
  p_media_category text,
  p_path text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_contract_id uuid DEFAULT NULL,
  p_caption text DEFAULT NULL,
  p_taken_at timestamptz DEFAULT now()
)
RETURNS public.job_media
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_role public.user_role;
  v_result public.job_media;
  v_title text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

  -- Check authorization
  IF v_user_role = 'admin' THEN
    NULL;
  ELSIF v_user_role = 'customer' THEN
    IF NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = p_job_id AND customer_id = v_user_id) THEN
      RAISE EXCEPTION 'Not authorized to upload to this job';
    END IF;
  ELSIF v_user_role = 'mechanic' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.job_contracts 
      WHERE job_id = p_job_id AND mechanic_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Not authorized to upload to this job';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

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

  v_title := CASE p_media_category
    WHEN 'customer_initial' THEN 'Customer uploaded initial photo'
    WHEN 'mechanic_before' THEN 'Mechanic uploaded before photo'
    WHEN 'mechanic_after' THEN 'Mechanic uploaded after photo'
    WHEN 'mechanic_diagnostic' THEN 'Mechanic uploaded diagnostic photo'
    WHEN 'customer_evidence' THEN 'Customer uploaded evidence'
    WHEN 'mechanic_evidence' THEN 'Mechanic uploaded evidence'
    ELSE 'Photo uploaded'
  END;

  INSERT INTO public.job_events (
    job_id,
    contract_id,
    event_type,
    actor_id,
    actor_role,
    title,
    metadata
  ) VALUES (
    p_job_id,
    p_contract_id,
    'media_uploaded',
    v_user_id,
    v_user_role,
    v_title,
    jsonb_build_object(
      'media_id', v_result.id,
      'category', p_media_category,
      'role', v_user_role::text
    )
  );

  RETURN v_result;
END;
$$;
