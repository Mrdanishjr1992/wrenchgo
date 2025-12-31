-- Migration: Create symptom_mappings table
-- Description: Creates the symptom_mappings table for storing vehicle symptom data

CREATE TABLE IF NOT EXISTS public.symptom_mappings (
  symptom_key TEXT PRIMARY KEY,
  symptom_label TEXT NOT NULL,
  category TEXT NOT NULL,
  required_skill_keys TEXT[] DEFAULT '{}',
  suggested_tool_keys TEXT[] DEFAULT '{}',
  required_safety_keys TEXT[] DEFAULT '{}',
  quote_strategy TEXT DEFAULT 'diagnosis-first',
  risk_level TEXT DEFAULT 'low',
  customer_explainer TEXT,
  mechanic_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_symptom_mappings_category ON public.symptom_mappings(category);

-- Create index on risk_level for faster filtering
CREATE INDEX IF NOT EXISTS idx_symptom_mappings_risk_level ON public.symptom_mappings(risk_level);

-- Enable RLS
ALTER TABLE public.symptom_mappings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to symptom mappings
CREATE POLICY "Allow public read access to symptom_mappings"
  ON public.symptom_mappings
  FOR SELECT
  TO public
  USING (true);

-- Add comment
COMMENT ON TABLE public.symptom_mappings IS 'Stores vehicle symptom data with categories, risk levels, and job flow metadata';
