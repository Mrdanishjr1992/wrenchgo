-- Migration: 20260203000004_service_hubs_insert_policy.sql
-- Description: Add INSERT policy for service_hubs (admin only) and SELECT policy for all authenticated users
-- Dependencies: 20260202000002_admin_hub_update_permission.sql

-- Grant INSERT permission to authenticated users (RLS will restrict to admins)
GRANT INSERT ON public.service_hubs TO authenticated;

-- Create SELECT policy for all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view service_hubs" ON public.service_hubs;
CREATE POLICY "Authenticated users can view service_hubs"
  ON public.service_hubs
  FOR SELECT
  TO authenticated
  USING (true);

-- Create INSERT policy for admin users only
DROP POLICY IF EXISTS "Admins can insert service_hubs" ON public.service_hubs;
CREATE POLICY "Admins can insert service_hubs"
  ON public.service_hubs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Create DELETE policy for admin users only
DROP POLICY IF EXISTS "Admins can delete service_hubs" ON public.service_hubs;
CREATE POLICY "Admins can delete service_hubs"
  ON public.service_hubs
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
