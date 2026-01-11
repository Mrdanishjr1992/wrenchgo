-- ============================================================================
-- Migration: 20250213000002_fix_rating_prompt_state.sql
-- ============================================================================
-- Purpose: Add missing columns to user_rating_prompt_state table
-- Dependencies: 20250111000001 (user_rating_prompt_state, jobs tables)
-- Risk Level: Low (additive columns only)
-- Rollback: ALTER TABLE DROP COLUMN last_completed_job_id, prompt_eligible;
-- ============================================================================

-- Fix user_rating_prompt_state table - add missing columns

-- Add last_completed_job_id column if it doesn't exist
ALTER TABLE public.user_rating_prompt_state 
ADD COLUMN IF NOT EXISTS last_completed_job_id uuid REFERENCES public.jobs(id);

-- Add prompt_eligible column if it doesn't exist
ALTER TABLE public.user_rating_prompt_state 
ADD COLUMN IF NOT EXISTS prompt_eligible boolean DEFAULT false;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_rating_prompt_job 
ON public.user_rating_prompt_state(last_completed_job_id);
