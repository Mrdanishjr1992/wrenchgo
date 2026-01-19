-- =====================================================
-- Support Thread Replies
-- Allow users to reply to admin messages (two-way support chat)
-- =====================================================

-- 1. Add sender_type column to distinguish admin vs user messages
ALTER TABLE public.admin_messages 
ADD COLUMN IF NOT EXISTS sender_type text NOT NULL DEFAULT 'admin' 
CHECK (sender_type IN ('admin', 'user'));

-- 2. Add thread_id to group related messages
ALTER TABLE public.admin_messages 
ADD COLUMN IF NOT EXISTS thread_id uuid;

-- 3. Create index for thread queries
CREATE INDEX IF NOT EXISTS idx_admin_messages_thread 
  ON public.admin_messages(thread_id, created_at ASC) 
  WHERE thread_id IS NOT NULL;

-- 4. Update RLS to allow users to insert their own replies
DROP POLICY IF EXISTS admin_messages_user_reply ON public.admin_messages;
CREATE POLICY admin_messages_user_reply ON public.admin_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'user' 
    AND sender_admin_id = auth.uid()
    AND recipient_id = auth.uid()
  );

-- 5. RPC: User sends reply to support thread
CREATE OR REPLACE FUNCTION public.user_reply_to_support(
  p_body text,
  p_thread_id uuid DEFAULT NULL,
  p_related_job_id uuid DEFAULT NULL,
  p_related_support_request_id uuid DEFAULT NULL,
  p_attachment_url text DEFAULT NULL,
  p_attachment_type text DEFAULT NULL
)
RETURNS public.admin_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_new_message public.admin_messages;
  v_thread_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate body
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
  
  -- Determine thread_id
  IF p_thread_id IS NOT NULL THEN
    -- Verify user owns this thread
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_messages 
      WHERE (thread_id = p_thread_id OR id = p_thread_id)
        AND recipient_id = v_user_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Thread not found or access denied';
    END IF;
    v_thread_id := p_thread_id;
  ELSE
    -- Create new thread (use the message id as thread_id)
    v_thread_id := gen_random_uuid();
  END IF;
  
  -- Insert the user reply
  INSERT INTO public.admin_messages (
    sender_admin_id,
    recipient_id,
    body,
    sender_type,
    thread_id,
    related_job_id,
    related_support_request_id,
    attachment_url,
    attachment_type,
    read_at
  ) VALUES (
    v_user_id,
    v_user_id,
    trim(p_body),
    'user',
    v_thread_id,
    p_related_job_id,
    p_related_support_request_id,
    p_attachment_url,
    p_attachment_type,
    now()
  )
  RETURNING * INTO v_new_message;
  
  RETURN v_new_message;
END;
$$;

-- 6. RPC: Get support thread messages
CREATE OR REPLACE FUNCTION public.get_support_thread(
  p_thread_id uuid,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  sender_name text,
  sender_type text,
  body text,
  related_job_id uuid,
  related_job_title text,
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
    am.sender_admin_id as sender_id,
    CASE 
      WHEN am.sender_type = 'admin' THEN COALESCE(p.full_name, 'Support Team')
      ELSE 'You'
    END as sender_name,
    am.sender_type,
    am.body,
    am.related_job_id,
    j.title as related_job_title,
    am.attachment_url,
    am.attachment_type,
    am.read_at,
    am.created_at
  FROM public.admin_messages am
  LEFT JOIN public.profiles p ON p.id = am.sender_admin_id AND am.sender_type = 'admin'
  LEFT JOIN public.jobs j ON j.id = am.related_job_id
  WHERE (am.thread_id = p_thread_id OR am.id = p_thread_id)
    AND am.recipient_id = auth.uid()
    AND am.deleted_at IS NULL
  ORDER BY am.created_at ASC
  LIMIT p_limit;
END;
$$;

-- 7. RPC: Get or create user's support thread
CREATE OR REPLACE FUNCTION public.get_or_create_support_thread()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_thread_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Find existing thread (most recent)
  SELECT COALESCE(thread_id, id) INTO v_thread_id
  FROM public.admin_messages
  WHERE recipient_id = v_user_id
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no thread exists, create a placeholder
  IF v_thread_id IS NULL THEN
    v_thread_id := gen_random_uuid();
  END IF;
  
  RETURN v_thread_id;
END;
$$;

-- 8. Update list_my_admin_messages to include thread_id
DROP FUNCTION IF EXISTS public.list_my_admin_messages(int, int);
CREATE OR REPLACE FUNCTION public.list_my_admin_messages(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  sender_admin_id uuid,
  sender_name text,
  sender_type text,
  body text,
  related_job_id uuid,
  related_job_title text,
  related_support_request_id uuid,
  related_dispute_id uuid,
  attachment_url text,
  attachment_type text,
  read_at timestamptz,
  created_at timestamptz,
  thread_id uuid
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
    CASE 
      WHEN am.sender_type = 'admin' THEN COALESCE(p.full_name, 'Support Team')
      ELSE 'You'
    END as sender_name,
    am.sender_type,
    am.body,
    am.related_job_id,
    j.title as related_job_title,
    am.related_support_request_id,
    am.related_dispute_id,
    am.attachment_url,
    am.attachment_type,
    am.read_at,
    am.created_at,
    COALESCE(am.thread_id, am.id) as thread_id
  FROM public.admin_messages am
  LEFT JOIN public.profiles p ON p.id = am.sender_admin_id AND am.sender_type = 'admin'
  LEFT JOIN public.jobs j ON j.id = am.related_job_id
  WHERE am.recipient_id = auth.uid()
    AND am.deleted_at IS NULL
  ORDER BY am.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 9. Grant permissions
GRANT EXECUTE ON FUNCTION public.user_reply_to_support TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_support_thread TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_support_thread TO authenticated;
