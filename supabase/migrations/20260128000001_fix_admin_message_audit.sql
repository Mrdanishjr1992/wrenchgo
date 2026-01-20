-- =====================================================
-- Fix admin_send_message to handle message_audit_logs constraints
-- =====================================================

-- Create table with all needed columns if it doesn't exist
CREATE TABLE IF NOT EXISTS public.message_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  conversation_id uuid,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_content text,
  displayed_content text,
  patterns_detected text[],
  risk_score numeric(5,2),
  action_taken text,
  action text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  job_stage text,
  sender_account_age_days int,
  sender_completed_jobs int,
  sender_previous_violations int,
  flagged_for_review boolean DEFAULT false,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_decision text,
  review_notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_audit_sender ON public.message_audit_logs(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_audit_conversation ON public.message_audit_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_audit_flagged ON public.message_audit_logs(flagged_for_review) WHERE flagged_for_review = true;
CREATE INDEX IF NOT EXISTS idx_message_audit_job ON public.message_audit_logs(job_id) WHERE job_id IS NOT NULL;

-- Make conversation_id nullable (it's not needed for admin messages)
ALTER TABLE public.message_audit_logs ALTER COLUMN conversation_id DROP NOT NULL;

-- Make sender_id nullable (admin messages use actor_id instead)
ALTER TABLE public.message_audit_logs ALTER COLUMN sender_id DROP NOT NULL;

-- Make recipient_id nullable
ALTER TABLE public.message_audit_logs ALTER COLUMN recipient_id DROP NOT NULL;

-- Make original_content nullable (admin audit uses metadata instead)
ALTER TABLE public.message_audit_logs ALTER COLUMN original_content DROP NOT NULL;

-- Make action_taken nullable (admin audit uses action instead)
ALTER TABLE public.message_audit_logs ALTER COLUMN action_taken DROP NOT NULL;

-- Add optional columns for admin messages if they don't exist
ALTER TABLE public.message_audit_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.message_audit_logs ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.message_audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Create index on actor_id AFTER the column is added
CREATE INDEX IF NOT EXISTS idx_message_audit_actor ON public.message_audit_logs(actor_id) WHERE actor_id IS NOT NULL;

-- Update admin_send_message to gracefully handle missing audit table
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
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    -- Audit table doesn't exist or has different schema, skip logging
    NULL;
  END;
  
  -- If job linked, write job_event
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
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      -- job_events table doesn't exist, skip
      NULL;
    END;
  END IF;
  
  RETURN v_new_message;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_message TO authenticated;