-- Migration: 20260202000002_admin_hub_update_permission.sql
-- Description: Grant UPDATE permission on service_hubs for admin users
-- Dependencies: 0081_service_hubs.sql

-- Grant UPDATE permission to authenticated users (RLS will restrict to admins)
GRANT UPDATE ON public.service_hubs TO authenticated;

-- Enable RLS if not already enabled
ALTER TABLE public.service_hubs ENABLE ROW LEVEL SECURITY;

-- Create policy for admin updates (uses existing is_admin(uuid) function)
DROP POLICY IF EXISTS "Admins can update service_hubs" ON public.service_hubs;
CREATE POLICY "Admins can update service_hubs"
  ON public.service_hubs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));