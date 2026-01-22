-- ===================================================================
-- DROP-IN FIX: 0011_misc_and_comments.sql
-- Purpose: Make realtime publication safe if tables don’t exist yet
-- FULL REPLACE for the REALTIME SUBSCRIPTIONS section
-- ===================================================================

SET search_path TO public, extensions;

-- =====================================================
-- REALTIME SUBSCRIPTIONS (SAFE / GUARDED)
-- =====================================================
DO $$
BEGIN
  -- messages
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  -- notifications
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- jobs
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;

  -- quote_requests
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'quote_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_requests;
  END IF;
END $$;

-- ===================================================================
-- END DROP-IN FIX
-- ===================================================================
