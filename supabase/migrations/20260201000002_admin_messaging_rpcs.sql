-- Admin Messaging RPCs
-- Allows admins to send messages and view conversation history with users

-- Note: Uses existing is_admin(uuid) function from prior migrations

-- Drop existing functions if they exist (handles signature changes)
DROP FUNCTION IF EXISTS admin_send_message(uuid, text, uuid, uuid, uuid, text, text);
DROP FUNCTION IF EXISTS admin_list_user_messages(uuid, integer);
DROP FUNCTION IF EXISTS admin_list_job_messages(uuid, integer);
DROP FUNCTION IF EXISTS admin_get_user_jobs(uuid, integer);

-- RPC: Admin sends a message to a user
-- Uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION admin_send_message(
  p_recipient_id uuid,
  p_body text,
  p_related_job_id uuid DEFAULT NULL,
  p_support_request_id uuid DEFAULT NULL,
  p_dispute_id uuid DEFAULT NULL,
  p_attachment_url text DEFAULT NULL,
  p_attachment_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_job_id uuid;
  v_message_id uuid;
BEGIN
  -- Verify caller is admin
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  
  -- Determine job_id context
  v_job_id := p_related_job_id;
  
  -- If no job specified, try to find most recent job for this user
  IF v_job_id IS NULL THEN
    SELECT id INTO v_job_id
    FROM jobs
    WHERE (customer_id = p_recipient_id OR accepted_mechanic_id = p_recipient_id)
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  -- If still no job, create a system context job or use a placeholder
  -- For now, job_id can be null for direct admin messages
  
  -- Insert the message
  INSERT INTO messages (
    job_id,
    sender_id,
    recipient_id,
    body
  ) VALUES (
    v_job_id,
    v_admin_id,
    p_recipient_id,
    p_body
  )
  RETURNING id INTO v_message_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message_id', v_message_id,
    'job_id', v_job_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- RPC: Admin lists messages with a specific user
-- Returns conversation history between admin and user
CREATE OR REPLACE FUNCTION admin_list_user_messages(
  p_user_id uuid,
  p_limit integer DEFAULT 100
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
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  -- Verify caller is admin
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  
  RETURN QUERY
  SELECT
    m.id,
    CASE 
      WHEN is_admin(m.sender_id) THEN m.sender_id 
      ELSE NULL::uuid 
    END as sender_admin_id,
    COALESCE(p.full_name, p.email, 'Unknown') as sender_name,
    CASE 
      WHEN is_admin(m.sender_id) THEN 'admin'::text 
      ELSE 'user'::text 
    END as sender_type,
    m.body,
    m.job_id as related_job_id,
    j.title as related_job_title,
    NULL::uuid as related_support_request_id,
    NULL::uuid as related_dispute_id,
    NULL::text as attachment_url,
    NULL::text as attachment_type,
    m.read_at,
    m.created_at,
    NULL::uuid as thread_id
  FROM messages m
  JOIN profiles p ON p.id = m.sender_id
  LEFT JOIN jobs j ON j.id = m.job_id
  WHERE (
    (m.sender_id = p_user_id AND is_admin(m.recipient_id))
    OR
    (m.recipient_id = p_user_id AND is_admin(m.sender_id))
  )
  AND m.deleted_at IS NULL
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$;

-- RPC: Admin lists messages for a specific job
CREATE OR REPLACE FUNCTION admin_list_job_messages(
  p_job_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  sender_name text,
  sender_role text,
  recipient_id uuid,
  recipient_name text,
  body text,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  -- Verify caller is admin
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  
  RETURN QUERY
  SELECT
    m.id,
    m.sender_id,
    COALESCE(ps.full_name, ps.email, 'Unknown') as sender_name,
    ps.role::text as sender_role,
    m.recipient_id,
    COALESCE(pr.full_name, pr.email, 'Unknown') as recipient_name,
    m.body,
    m.read_at,
    m.created_at
  FROM messages m
  JOIN profiles ps ON ps.id = m.sender_id
  JOIN profiles pr ON pr.id = m.recipient_id
  WHERE m.job_id = p_job_id
    AND m.deleted_at IS NULL
  ORDER BY m.created_at ASC
  LIMIT p_limit;
END;
$$;

-- RPC: Get user's jobs for job context selection
CREATE OR REPLACE FUNCTION admin_get_user_jobs(
  p_user_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  
  RETURN QUERY
  SELECT
    j.id,
    j.title,
    j.status::text,
    j.created_at
  FROM jobs j
  WHERE (j.customer_id = p_user_id OR j.accepted_mechanic_id = p_user_id)
    AND j.deleted_at IS NULL
  ORDER BY j.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_send_message(uuid, text, uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_user_messages(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_job_messages(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_user_jobs(uuid, integer) TO authenticated;
