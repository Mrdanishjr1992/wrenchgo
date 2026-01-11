-- =====================================================
-- MIGRATION 0010: Notify user function
-- =====================================================
-- Purpose: SECURITY DEFINER function to send notifications to any user
-- Depends on: 0002_rls_policies.sql
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text DEFAULT 'general',
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    entity_type,
    entity_id,
    is_read,
    created_at
  ) VALUES (
    p_user_id,
    p_title,
    p_body,
    p_type,
    p_entity_type,
    p_entity_id,
    false,
    now()
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_user TO authenticated;

COMMIT;