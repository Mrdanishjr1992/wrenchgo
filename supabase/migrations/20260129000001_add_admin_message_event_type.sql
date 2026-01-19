-- =====================================================
-- Add admin_message_sent to job_event_type enum
-- =====================================================

-- Add the new enum value if it doesn't exist
DO $$
BEGIN
  -- Check if the enum type exists and add the value
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_event_type') THEN
    BEGIN
      ALTER TYPE public.job_event_type ADD VALUE IF NOT EXISTS 'admin_message_sent';
    EXCEPTION WHEN duplicate_object THEN
      -- Value already exists, ignore
      NULL;
    END;
  END IF;
END $$;

-- Update admin_send_message to handle all possible exceptions for job_events insert
CREATE OR REPLACE FUNCTION public.admin_send_message(
  p_recipient_id uuid,
  p_body text,
  p_related_job_id uuid DEFAULT NULL,
  p_support_request_id uuid DEFAULT NULL,
  p_dispute_id uuid DEFAULT NULL,
  p_attachment_url text DEFAULT NULL,
  p_attachment_type text DEFAULT NULL
)
RETURNS public.admin_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_new_message public.admin_messages;
  v_recipient_exists boolean;
  v_job_participant boolean := true;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check admin permission
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  
  -- Validate recipient exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_recipient_id)
  INTO v_recipient_exists;
  
  IF NOT v_recipient_exists THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;
  
  -- Validate body length
  IF p_body IS NULL OR char_length(trim(p_body)) < 1 THEN
    RAISE EXCEPTION 'Message body is required';
  END IF;
  
  IF char_length(p_body) > 4000 THEN
    RAISE EXCEPTION 'Message body exceeds 4000 characters';
  END IF;
  
  -- Validate attachment_type if provided
  IF p_attachment_type IS NOT NULL AND p_attachment_type NOT IN ('image', 'file') THEN
    RAISE EXCEPTION 'Invalid attachment type';
  END IF;

  -- If job is linked, check if recipient is part of job (log warning but allow)
  IF p_related_job_id IS NOT NULL THEN
    BEGIN
      SELECT EXISTS(
        SELECT 1 FROM public.jobs j
        LEFT JOIN public.job_contracts c ON c.job_id = j.id
        WHERE j.id = p_related_job_id
          AND (j.customer_id = p_recipient_id OR c.mechanic_id = p_recipient_id)
      ) INTO v_job_participant;
    EXCEPTION WHEN undefined_table THEN
      v_job_participant := true;
    END;
  END IF;
  
  -- Insert the message
  INSERT INTO public.admin_messages (
    sender_admin_id,
    recipient_id,
    body,
    related_job_id,
    related_support_request_id,
    related_dispute_id,
    attachment_url,
    attachment_type
  ) VALUES (
    v_admin_id,
    p_recipient_id,
    trim(p_body),
    p_related_job_id,
    p_support_request_id,
    p_dispute_id,
    p_attachment_url,
    p_attachment_type
  )
  RETURNING * INTO v_new_message;
  
  -- Write audit log (gracefully handle if table doesn't exist or has different schema)
  BEGIN
    INSERT INTO public.message_audit_logs (
      message_id,
      action,
      actor_id,
      metadata
    ) VALUES (
      v_new_message.id,
      'ADMIN_SEND_MESSAGE',
      v_admin_id,
      jsonb_build_object(
        'recipient_id', p_recipient_id,
        'related_job_id', p_related_job_id,
        'related_support_request_id', p_support_request_id,
        'related_dispute_id', p_dispute_id,
        'job_participant', v_job_participant
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Audit table doesn't exist or has different schema, skip logging
    NULL;
  END;
  
  -- If job linked, write job_event (skip if enum value doesn't exist)
  IF p_related_job_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.job_events (
        job_id,
        event_type,
        actor_id,
        actor_role,
        visible_to_customer,
        visible_to_mechanic,
        metadata
      ) VALUES (
        p_related_job_id,
        'admin_message_sent',
        v_admin_id,
        'admin',
        true,
        true,
        jsonb_build_object(
          'admin_message_id', v_new_message.id,
          'recipient_id', p_recipient_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- job_events table doesn't exist or enum value not available, skip
      NULL;
    END;
  END IF;
  
  RETURN v_new_message;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_message TO authenticated;