-- =====================================================
-- REMOVE ID VERIFICATION COMPLETELY
-- =====================================================
-- Purpose: Remove all ID verification fields to prevent schema conflicts
-- This supersedes 20250205000001_simplify_id_verification.sql
-- =====================================================

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS id_verified CASCADE,
  DROP COLUMN IF EXISTS id_verified_at CASCADE;

DROP INDEX IF EXISTS idx_profiles_id_verified;
