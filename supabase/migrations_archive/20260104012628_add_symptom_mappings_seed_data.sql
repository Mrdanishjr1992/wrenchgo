-- Migration: Add symptom_mappings seed data
-- Purpose: Fix foreign key constraint violation in symptom_questions
-- The symptom_questions table has a FK to symptom_mappings, but symptom_mappings wasn't seeded

-- First ensure symptoms exist (idempotent)
INSERT INTO public.symptoms ("key", label, icon) VALUES
('wont_start', 'Won''t start', '🚨'),
('warning_light', 'Warning light', '🔔'),
('brakes_wrong', 'Brakes feel wrong', '🛑'),
('strange_noise', 'Strange noise', '🔊'),
('fluid_leak', 'Fluid leak', '💧'),
('battery_issues', 'Battery issues', '🔋'),
('maintenance', 'Maintenance', '🧰'),
('not_sure', 'Not sure', '❓')
ON CONFLICT ("key") DO NOTHING;

-- Now insert symptom_mappings
INSERT INTO public.symptom_mappings
(symptom_key, symptom_label, category, quote_strategy, risk_level, created_at, updated_at)
VALUES
('wont_start', 'Won''t start', 'Engine', 'diagnosis-first', 'high', NOW(), NOW()),
('warning_light', 'Warning light', 'Electrical', 'diagnosis-first', 'medium', NOW(), NOW()),
('brakes_wrong', 'Brakes feel wrong', 'Brakes', 'inspection_required', 'high', NOW(), NOW()),
('strange_noise', 'Strange noise', 'Unknown', 'diagnosis-first', 'low', NOW(), NOW()),
('fluid_leak', 'Fluid leak', 'Engine', 'diagnosis-first', 'medium', NOW(), NOW()),
('battery_issues', 'Battery issues', 'Electrical', 'fixed_simple', 'low', NOW(), NOW()),
('maintenance', 'Maintenance', 'Maintenance', 'fixed_simple', 'low', NOW(), NOW()),
('not_sure', 'Not sure', 'Unknown', 'diagnosis-first', 'low', NOW(), NOW())
ON CONFLICT (symptom_key) DO NOTHING;

COMMENT ON TABLE public.symptom_mappings IS 'Symptom metadata and categorization - seeded data (customer-friendly)';
