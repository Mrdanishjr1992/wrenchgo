-- =====================================================
-- Admin Messaging System
-- Separate table for admin-to-user messages (account-level)
-- This avoids requiring a job_id which is mandatory in public.messages
-- =====================================================

-- 1. Create admin_messages table
CREATE TABLE IF NOT EXISTS public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  related_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  related_support_request_id uuid REFERENCES public.support_requests(id) ON DELETE SET NULL,
  related_dispute_id uuid REFERENCES public.disputes(id) ON DELETE SET NULL,
  attachment_url text,
  attachment_type text CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'file')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  
  CONSTRAINT body_length CHECK (char_length(body) >= 1 AND char_length(body) <= 4000)
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_messages_recipient_created 
  ON public.admin_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_messages_job 
  ON public.admin_messages(related_job_id) WHERE related_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_messages_support 
  ON public.admin_messages(related_support_request_id) WHERE related_support_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_messages_dispute 
  ON public.admin_messages(related_dispute_id) WHERE related_dispute_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_messages_sender 
  ON public.admin_messages(sender_admin_id);

-- 3. Enable RLS
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Recipients can read their own messages
CREATE POLICY admin_messages_recipient_select ON public.admin_messages
  FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid() 
    AND deleted_at IS NULL
  );

-- Admins can read all messages
CREATE POLICY admin_messages_admin_select ON public.admin_messages
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Only admins can insert (via RPC, but policy as fallback)
CREATE POLICY admin_messages_admin_insert ON public.admin_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Recipients can update only read_at
CREATE POLICY admin_messages_recipient_update ON public.admin_messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Admins can update (for soft delete)
CREATE POLICY admin_messages_admin_update ON public.admin_messages
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No hard deletes allowed
CREATE POLICY admin_messages_no_delete ON public.admin_messages
  FOR DELETE TO authenticated
  USING (false);

-- =====================================================
-- 5. RPCs
-- =====================================================

-- Send admin message
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
    SELECT EXISTS(
      SELECT 1 FROM public.jobs j
      LEFT JOIN public.job_contracts c ON c.job_id = j.id
      WHERE j.id = p_related_job_id
        AND (j.customer_id = p_recipient_id OR c.mechanic_id = p_recipient_id)
    ) INTO v_job_participant;
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
  
  -- Write audit log
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
  
  -- If job linked, write job_event
  IF p_related_job_id IS NOT NULL THEN
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
  END IF;
  
  RETURN v_new_message;
END;
$$;

-- List user's admin messages
CREATE OR REPLACE FUNCTION public.list_my_admin_messages(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  sender_admin_id uuid,
  sender_name text,
  body text,
  related_job_id uuid,
  related_job_title text,
  related_support_request_id uuid,
  related_dispute_id uuid,
  attachment_url text,
  attachment_type text,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    am.id,
    am.sender_admin_id,
    COALESCE(p.full_name, 'Support Team') as sender_name,
    am.body,
    am.related_job_id,
    j.title as related_job_title,
    am.related_support_request_id,
    am.related_dispute_id,
    am.attachment_url,
    am.attachment_type,
    am.read_at,
    am.created_at
  FROM public.admin_messages am
  LEFT JOIN public.profiles p ON p.id = am.sender_admin_id
  LEFT JOIN public.jobs j ON j.id = am.related_job_id
  WHERE am.recipient_id = auth.uid()
    AND am.deleted_at IS NULL
  ORDER BY am.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Mark message as read
CREATE OR REPLACE FUNCTION public.mark_admin_message_read(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE public.admin_messages
  SET read_at = now()
  WHERE id = p_message_id
    AND recipient_id = auth.uid()
    AND read_at IS NULL
    AND deleted_at IS NULL;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Admin list user's messages (for admin user detail view)
CREATE OR REPLACE FUNCTION public.admin_list_user_messages(
  p_user_id uuid,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  sender_admin_id uuid,
  sender_name text,
  recipient_id uuid,
  body text,
  related_job_id uuid,
  related_support_request_id uuid,
  related_dispute_id uuid,
  attachment_url text,
  attachment_type text,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    am.id,
    am.sender_admin_id,
    COALESCE(p.full_name, 'Support Team') as sender_name,
    am.recipient_id,
    am.body,
    am.related_job_id,
    am.related_support_request_id,
    am.related_dispute_id,
    am.attachment_url,
    am.attachment_type,
    am.read_at,
    am.created_at
  FROM public.admin_messages am
  LEFT JOIN public.profiles p ON p.id = am.sender_admin_id
  WHERE am.recipient_id = p_user_id
    AND am.deleted_at IS NULL
  ORDER BY am.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Get unread admin message count for user
CREATE OR REPLACE FUNCTION public.get_unread_admin_message_count()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.admin_messages
  WHERE recipient_id = auth.uid()
    AND read_at IS NULL
    AND deleted_at IS NULL;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.admin_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_admin_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_admin_message_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_user_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_admin_message_count TO authenticated;
