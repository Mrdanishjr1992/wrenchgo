-- Migration: Add RLS Policies to Enforce ID Verification
-- Timestamp: 20240120000002
-- Description: Adds RLS policies to prevent unverified users from creating jobs or accepting quotes

-- Function to check if user is ID verified
CREATE OR REPLACE FUNCTION is_user_id_verified(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND id_status = 'verified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Verified users can create jobs" ON jobs;
DROP POLICY IF EXISTS "Verified mechanics can accept quotes" ON quotes;

-- Policy: Only verified customers can create jobs
CREATE POLICY "Verified users can create jobs"
ON jobs
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid() AND
  is_user_id_verified(auth.uid())
);

-- Policy: Only verified mechanics can accept quotes
CREATE POLICY "Verified mechanics can accept quotes"
ON quotes
FOR UPDATE
TO authenticated
USING (
  mechanic_id = auth.uid() AND
  is_user_id_verified(auth.uid())
)
WITH CHECK (
  mechanic_id = auth.uid() AND
  is_user_id_verified(auth.uid())
);

-- Add comment for documentation
COMMENT ON FUNCTION is_user_id_verified IS 'Checks if a user has verified ID status';
