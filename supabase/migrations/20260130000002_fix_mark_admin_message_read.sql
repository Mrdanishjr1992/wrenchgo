-- Fix mark_admin_message_read RPC: v_updated should be integer, not boolean
-- Error: "operator does not exist: boolean > integer" (code 42883)

CREATE OR REPLACE FUNCTION public.mark_admin_message_read(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count int;
BEGIN
  UPDATE public.admin_messages
  SET read_at = now()
  WHERE id = p_message_id
    AND recipient_id = auth.uid()
    AND read_at IS NULL
    AND deleted_at IS NULL;
  
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;
