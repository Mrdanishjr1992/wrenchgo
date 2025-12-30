-- Quick Migration: Add soft delete columns to profiles table
-- Run this first before using the delete account feature

-- Add soft delete columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_reason TEXT,
ADD COLUMN IF NOT EXISTS deletion_requested_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS can_reapply BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reapplication_notes TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_active ON profiles(deleted_at, can_reapply) WHERE deleted_at IS NOT NULL;

-- Update RLS policies to exclude soft-deleted profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id AND deleted_at IS NULL);

-- Add soft delete columns to related tables (if they exist)
DO $$ 
BEGIN
  -- Jobs table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jobs') THEN
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
    CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at) WHERE deleted_at IS NULL;
  END IF;

  -- Notifications table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
    CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON notifications(deleted_at) WHERE deleted_at IS NULL;
  END IF;

  -- Messages table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
    CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at) WHERE deleted_at IS NULL;
  END IF;

  -- Payments table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
    CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON payments(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;
