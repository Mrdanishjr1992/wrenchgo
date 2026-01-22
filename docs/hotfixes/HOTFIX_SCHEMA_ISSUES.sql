-- =====================================================
-- HOTFIX: Fix schema issues found in app testing
-- =====================================================
-- Issues fixed:
-- 1. job_status enum missing 'work_in_progress'
-- 2. notifications.is_read column missing
-- 3. profiles.state column missing
-- =====================================================

-- 1. Add 'work_in_progress' to job_status enum
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'work_in_progress';

-- 2. Add is_read column to notifications
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false NOT NULL;

-- Update index for is_read
DROP INDEX IF EXISTS idx_notifications_unread;
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
ON public.notifications(user_id, is_read) 
WHERE deleted_at IS NULL AND is_read = false;

-- 3. Add state column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state text;

-- Verify fixes
SELECT 'job_status enum values:' as check, string_agg(enumlabel, ', ') as values
FROM pg_enum 
WHERE enumtypid = 'public.job_status'::regtype;

SELECT 'notifications columns:' as check, string_agg(column_name, ', ') as columns
FROM information_schema.columns 
WHERE table_name = 'notifications' AND table_schema = 'public';

SELECT 'profiles columns:' as check, string_agg(column_name, ', ') as columns
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public';
