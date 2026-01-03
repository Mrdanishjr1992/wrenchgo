-- Migration: Ensure proper RLS policies for auth flows
-- Date: 2025-02-XX
-- Purpose: Fix RLS policies to allow profile creation and reading during auth

-- Drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "Users can update their own role if null" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Allow authenticated users to read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

-- Allow authenticated users to insert their own profile (for fallback creation)
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- Allow authenticated users to update their own profile ONLY if role is NULL
CREATE POLICY "Users can update own profile when role is null"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid() AND role IS NULL)
  WITH CHECK (auth_id = auth.uid());

-- Ensure the set_user_role function has proper permissions
GRANT EXECUTE ON FUNCTION public.set_user_role(text) TO authenticated;

-- Add helpful comment
COMMENT ON POLICY "Users can read own profile" ON public.profiles IS 
  'Allows users to read their own profile during auth flows';

COMMENT ON POLICY "Users can insert own profile" ON public.profiles IS 
  'Allows fallback profile creation if trigger fails';

COMMENT ON POLICY "Users can update own profile when role is null" ON public.profiles IS 
  'Allows profile updates only when role is not yet set';
