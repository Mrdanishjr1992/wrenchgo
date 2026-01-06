-- =====================================================
-- ENSURE PG_NET EXTENSION EXISTS
-- =====================================================
-- Purpose: Fix "schema net does not exist" error
-- The pg_net extension provides the net schema for HTTP requests
-- =====================================================

-- Enable pg_net extension if not already enabled
-- This is typically pre-installed on Supabase but may need explicit enabling
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on net schema to authenticated users
GRANT USAGE ON SCHEMA net TO authenticated, service_role;
