-- =====================================================
-- HOTFIX: Fix symptom_mappings and symptom_questions RLS policies
-- =====================================================
-- Run this in Supabase SQL Editor to fix empty symptom data
-- =====================================================

-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('symptom_mappings', 'symptom_questions', 'symptoms');

-- Drop any existing policies
DROP POLICY IF EXISTS "symptom_mappings_select_all" ON public.symptom_mappings;
DROP POLICY IF EXISTS "symptom_questions_select_all" ON public.symptom_questions;
DROP POLICY IF EXISTS "symptoms_select_all" ON public.symptoms;
DROP POLICY IF EXISTS "Anyone can view symptom_mappings" ON public.symptom_mappings;
DROP POLICY IF EXISTS "Anyone can view symptom_questions" ON public.symptom_questions;
DROP POLICY IF EXISTS "Anyone can view symptoms" ON public.symptoms;

-- Create new policies for authenticated users
CREATE POLICY "symptom_mappings_select_all" ON public.symptom_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "symptom_questions_select_all" ON public.symptom_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "symptoms_select_all" ON public.symptoms
  FOR SELECT TO authenticated USING (true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('symptom_mappings', 'symptom_questions', 'symptoms');

-- Test query (should return data now)
SELECT COUNT(*) as symptom_questions_count FROM symptom_questions;
SELECT COUNT(*) as symptom_mappings_count FROM symptom_mappings;
SELECT COUNT(*) as symptoms_count FROM symptoms;
