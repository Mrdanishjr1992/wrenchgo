-- Migration: Create symptom_questions table
-- Description: Creates the symptom_questions table for storing dynamic questions per symptom

CREATE TABLE IF NOT EXISTS public.symptom_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key TEXT NOT NULL REFERENCES public.symptom_mappings(symptom_key) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'single-choice', 'multi-choice', 'text', 'yes-no'
  options JSONB, -- Array of options for choice questions
  affects_safety BOOLEAN DEFAULT false,
  affects_quote BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symptom_key, question_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_symptom_questions_symptom_key ON public.symptom_questions(symptom_key);
CREATE INDEX IF NOT EXISTS idx_symptom_questions_affects_safety ON public.symptom_questions(affects_safety);
CREATE INDEX IF NOT EXISTS idx_symptom_questions_affects_quote ON public.symptom_questions(affects_quote);

-- Enable RLS
ALTER TABLE public.symptom_questions ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to symptom_questions"
  ON public.symptom_questions
  FOR SELECT
  TO public
  USING (true);

-- Add comment
COMMENT ON TABLE public.symptom_questions IS 'Stores dynamic questions for each symptom in the job flow';
