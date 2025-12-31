-- Execute this in Supabase SQL Editor
-- Simple symptom setup without foreign key constraints initially

-- Step 1: Create symptom_mappings table (no foreign keys)
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_symptom_mappings_category ON public.symptom_mappings(category);
CREATE INDEX IF NOT EXISTS idx_symptom_mappings_risk_level ON public.symptom_mappings(risk_level);

-- Enable RLS
ALTER TABLE public.symptom_mappings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow public read access to symptom_mappings" ON public.symptom_mappings;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policy
CREATE POLICY "Allow public read access to symptom_mappings"
  ON public.symptom_mappings
  FOR SELECT
  USING (true);

-- Step 2: Insert Engine symptoms (High Priority)
INSERT INTO public.symptom_mappings (
  symptom_key,
  symptom_label,
  category,
  risk_level,
  quote_strategy,
  customer_explainer
) VALUES
  ('engine_misfire', 'Engine Misfiring', 'Engine', 'high', 'diagnosis-first', 'Engine is running rough, shaking, or has a noticeable vibration'),
  ('engine_overheating', 'Engine Overheating', 'Engine', 'high', 'diagnosis-first', 'Temperature gauge is in the red zone or steam coming from hood'),
  ('engine_stalling', 'Engine Stalling', 'Engine', 'high', 'diagnosis-first', 'Engine shuts off unexpectedly while driving or idling'),
  ('loss_of_power', 'Loss of Power / Acceleration', 'Engine Performance', 'high', 'diagnosis-first', 'Vehicle feels sluggish, won''t accelerate, or lacks power going uphill'),
  ('smoke_from_exhaust', 'Smoke from Exhaust', 'Engine', 'high', 'diagnosis-first', 'Visible smoke (white, blue, or black) coming from tailpipe'),
  ('engine_knocking', 'Engine Knocking / Pinging', 'Engine', 'high', 'diagnosis-first', 'Metallic knocking or pinging sound from engine, especially under acceleration')
ON CONFLICT (symptom_key) DO NOTHING;

-- Insert Engine symptoms (Medium Priority)
INSERT INTO public.symptom_mappings (
  symptom_key,
  symptom_label,
  category,
  risk_level,
  quote_strategy,
  customer_explainer
) VALUES
  ('check_engine_light', 'Check Engine Light On', 'Engine', 'medium', 'diagnosis-first', 'Dashboard warning light (engine symbol) is illuminated'),
  ('rough_idle', 'Rough Idle', 'Engine', 'medium', 'diagnosis-first', 'Engine shakes, vibrates, or runs unevenly when stopped'),
  ('hard_to_start', 'Hard to Start / Won''t Start', 'Engine', 'medium', 'diagnosis-first', 'Engine cranks but takes multiple attempts to start, or won''t start at all'),
  ('poor_fuel_economy', 'Poor Fuel Economy', 'Engine Performance', 'medium', 'diagnosis-first', 'Noticeable decrease in miles per gallon'),
  ('engine_hesitation', 'Engine Hesitation / Stumbling', 'Engine Performance', 'medium', 'diagnosis-first', 'Engine hesitates or stumbles when accelerating'),
  ('engine_surging', 'Engine Surging', 'Engine Performance', 'medium', 'diagnosis-first', 'Engine RPM fluctuates or surges without pressing gas pedal'),
  ('oil_leak', 'Oil Leak', 'Engine', 'medium', 'diagnosis-first', 'Oil spots under vehicle or visible oil on engine'),
  ('coolant_leak', 'Coolant Leak', 'Engine', 'medium', 'diagnosis-first', 'Green, orange, or pink fluid leaking under vehicle')
ON CONFLICT (symptom_key) DO NOTHING;

-- Insert Engine symptoms (Low Priority)
INSERT INTO public.symptom_mappings (
  symptom_key,
  symptom_label,
  category,
  risk_level,
  quote_strategy,
  customer_explainer
) VALUES
  ('engine_noise_general', 'Unusual Engine Noise', 'Engine', 'low', 'diagnosis-first', 'Strange sounds from engine (ticking, rattling, squealing)'),
  ('oil_pressure_warning', 'Oil Pressure Warning Light', 'Engine', 'low', 'diagnosis-first', 'Oil can or pressure warning light is on'),
  ('engine_vibration', 'Excessive Engine Vibration', 'Engine', 'low', 'diagnosis-first', 'More vibration than normal felt through steering wheel or seat'),
  ('engine_smell', 'Burning Smell from Engine', 'Engine', 'low', 'diagnosis-first', 'Unusual burning odor coming from engine bay')
ON CONFLICT (symptom_key) DO NOTHING;

-- Step 3: Create symptom_questions table (without foreign key initially)
CREATE TABLE IF NOT EXISTS public.symptom_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom_key TEXT NOT NULL,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  options JSONB,
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

-- Drop existing policy if it exists
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow public read access to symptom_questions" ON public.symptom_questions;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policy
CREATE POLICY "Allow public read access to symptom_questions"
  ON public.symptom_questions
  FOR SELECT
  USING (true);

-- Step 4: Add foreign key constraint now that both tables exist
DO $$
BEGIN
  ALTER TABLE public.symptom_questions
  ADD CONSTRAINT fk_symptom_questions_symptom_key
  FOREIGN KEY (symptom_key) 
  REFERENCES public.symptom_mappings(symptom_key) 
  ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Verify: Show all engine symptoms
SELECT 
  symptom_key, 
  symptom_label, 
  category, 
  risk_level,
  customer_explainer
FROM public.symptom_mappings 
WHERE category IN ('Engine', 'Engine Performance')
ORDER BY 
  CASE risk_level 
    WHEN 'high' THEN 1 
    WHEN 'medium' THEN 2 
    WHEN 'low' THEN 3 
  END,
  category,
  symptom_label;
