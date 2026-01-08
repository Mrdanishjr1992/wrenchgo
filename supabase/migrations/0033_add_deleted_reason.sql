-- Add columns required for account deletion
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_reason text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_requested_by uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_reapply boolean DEFAULT true;
