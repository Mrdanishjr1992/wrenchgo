-- Migration: List support threads (conversations) instead of individual messages
-- This groups messages by thread_id and returns one row per conversation

-- Create RPC to list support threads for the current user
CREATE OR REPLACE FUNCTION public.list_my_support_threads(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  thread_id uuid,
  subject text,
  last_message_body text,
  last_message_at timestamptz,
  last_message_sender_type text,
  unread_count bigint,
  total_messages bigint,
  related_job_id uuid,
  related_job_title text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH thread_stats AS (
    SELECT
      am.thread_id,
      COUNT(*) AS total_messages,
      COUNT(*) FILTER (WHERE am.read_at IS NULL AND am.sender_type = 'admin') AS unread_count,
      MAX(am.created_at) AS last_message_at,
      MIN(am.created_at) AS first_message_at
    FROM admin_messages am
    WHERE am.recipient_id = auth.uid()
      AND am.thread_id IS NOT NULL
    GROUP BY am.thread_id
  ),
  latest_messages AS (
    SELECT DISTINCT ON (am.thread_id)
      am.thread_id,
      am.body AS last_message_body,
      am.sender_type AS last_message_sender_type,
      am.related_job_id,
      am.created_at
    FROM admin_messages am
    WHERE am.recipient_id = auth.uid()
      AND am.thread_id IS NOT NULL
    ORDER BY am.thread_id, am.created_at DESC
  )
  SELECT
    ts.thread_id,
    COALESCE(j.title, 'Support Conversation')::text AS subject,
    lm.last_message_body,
    ts.last_message_at,
    lm.last_message_sender_type,
    ts.unread_count,
    ts.total_messages,
    lm.related_job_id,
    j.title AS related_job_title,
    ts.first_message_at AS created_at
  FROM thread_stats ts
  JOIN latest_messages lm ON lm.thread_id = ts.thread_id
  LEFT JOIN jobs j ON j.id = lm.related_job_id
  ORDER BY ts.last_message_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.list_my_support_threads(integer, integer) TO authenticated;

-- Create RPC to get unread thread count (number of threads with unread messages)
CREATE OR REPLACE FUNCTION public.get_unread_support_thread_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(DISTINCT thread_id) INTO v_count
  FROM admin_messages
  WHERE recipient_id = auth.uid()
    AND thread_id IS NOT NULL
    AND read_at IS NULL
    AND sender_type = 'admin';
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_unread_support_thread_count() TO authenticated;

-- Create RPC to mark all messages in a thread as read
CREATE OR REPLACE FUNCTION public.mark_support_thread_read(
  p_thread_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_messages
  SET read_at = NOW()
  WHERE thread_id = p_thread_id
    AND recipient_id = auth.uid()
    AND read_at IS NULL
    AND sender_type = 'admin';
  
  RETURN TRUE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.mark_support_thread_read(uuid) TO authenticated;