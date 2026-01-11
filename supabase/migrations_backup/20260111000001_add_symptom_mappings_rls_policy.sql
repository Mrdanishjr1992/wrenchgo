-- ============================================================================
-- Migration: 20260111000001_add_symptom_mappings_rls_policy.sql
-- ============================================================================
-- Purpose: Add missing RLS policies for symptom_mappings and symptom_questions tables
-- Issue: These tables have RLS enabled but no SELECT policy for authenticated users
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "symptom_mappings_select_all" ON public.symptom_mappings;
CREATE POLICY "symptom_mappings_select_all" ON public.symptom_mappings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "symptom_questions_select_all" ON public.symptom_questions;
CREATE POLICY "symptom_questions_select_all" ON public.symptom_questions
  FOR SELECT TO authenticated USING (true);

COMMIT;