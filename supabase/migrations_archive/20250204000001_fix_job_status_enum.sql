-- =====================================================
-- FIX JOB STATUS ENUM - ADD work_in_progress
-- =====================================================
-- Purpose: Add 'work_in_progress' as an alias or replace 'in_progress' with 'work_in_progress'
-- Issue: Code uses 'work_in_progress' but enum has 'in_progress'
-- =====================================================

-- Add 'work_in_progress' to the job_status enum
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'work_in_progress';

-- Note: Cannot use the new enum value in the same transaction
-- The UPDATE will need to be run separately or in a future migration
-- For now, the app will work with both 'in_progress' and 'work_in_progress'
