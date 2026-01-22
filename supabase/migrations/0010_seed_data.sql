-- ===================================================================
-- 0010_seed_data.sql
-- WrenchGo – CANONICAL, RESET-SAFE SEED FILE
-- Matches ACTUAL schemas from 0003_tables_core.sql + 0004_tables_lookup.sql
-- Zero phantom columns. Zero legacy assumptions.
-- ===================================================================

SET search_path TO public, extensions;

-- =====================================================
-- BADGES (canonical, minimal schema)
-- Table: badges(id, key, label, description, category, created_at)
-- =====================================================
INSERT INTO public.badges (key, label, description, category)
SELECT *
FROM (
  VALUES
    ('first_job', 'First Job', 'Completed your first job', 'milestone'),
    ('jobs_5', 'Rising Star', 'Completed 5 jobs', 'milestone'),
    ('jobs_10', 'Experienced', 'Completed 10 jobs', 'milestone'),
    ('jobs_25', 'Seasoned Pro', 'Completed 25 jobs', 'milestone'),
    ('jobs_50', 'Expert', 'Completed 50 jobs', 'milestone'),
    ('jobs_100', 'Master Mechanic', 'Completed 100 jobs', 'milestone'),

    ('high_rated', 'Highly Rated', 'Maintained high customer ratings', 'quality'),
    ('perfect_score', 'Perfect Score', 'Perfect 5.0 rating', 'quality'),
    ('recommended', 'Recommended', 'Frequently recommended by customers', 'quality'),

    ('on_time', 'Punctual Pro', 'Consistently on-time arrivals', 'reliability'),
    ('reliable', 'Reliable', 'High completion reliability', 'reliability'),
    ('quick_responder', 'Quick Responder', 'Fast response times', 'reliability'),

    ('verified_skill', 'Verified Specialist', 'Verified skill expertise', 'skill'),
    ('multi_skilled', 'Multi-Skilled', 'Multiple verified skills', 'skill'),

    ('early_adopter', 'Early Adopter', 'Joined during early launch', 'special'),
    ('top_performer', 'Top Performer', 'Top performer in local market', 'special')
) v(key, label, description, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.badges b WHERE b.key = v.key
);

-- =====================================================
-- SKILLS
-- =====================================================
INSERT INTO public.skills (key, label, category)
VALUES
  ('brakes', 'Brakes', 'repair'),
  ('oil_change', 'Oil Change', 'maintenance'),
  ('battery', 'Battery', 'repair'),
  ('diagnostics', 'Diagnostics', 'diagnostics'),
  ('suspension', 'Suspension', 'repair'),
  ('engine', 'Engine', 'repair'),
  ('electrical', 'Electrical', 'repair'),
  ('cooling', 'Cooling System', 'repair'),
  ('transmission', 'Transmission', 'repair'),
  ('brake_service', 'Brake Service', 'repair')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- TOOLS
-- =====================================================
INSERT INTO public.tools (key, label, category)
VALUES
  ('scan_tool', 'Diagnostic Scanner', 'Diagnostics'),
  ('multimeter', 'Multimeter', 'Electrical'),
  ('jack', 'Jack', 'Lifting'),
  ('jack_stands', 'Jack Stands', 'Lifting'),
  ('wheel_chocks', 'Wheel Chocks', 'Lifting'),
  ('wrench_set', 'Wrench Set', 'General'),
  ('socket_set', 'Socket Set', 'General'),
  ('torque_wrench', 'Torque Wrench', 'General'),
  ('impact_wrench', 'Impact Wrench', 'Power Tools'),
  ('work_light', 'Work Light', 'Safety')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- SAFETY MEASURES
-- =====================================================
INSERT INTO public.safety_measures (key, label)
VALUES
  ('jack_stands_required', 'Use jack stands when lifting'),
  ('wheel_chocks_used', 'Use wheel chocks'),
  ('battery_safety', 'Battery safety precautions'),
  ('brake_safety', 'Brake system safety'),
  ('do_not_drive', 'Vehicle should not be driven')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- SYMPTOMS
-- =====================================================
INSERT INTO public.symptoms (key, label, icon)
VALUES
  ('basic_maintenance', 'Routine Maintenance', '🔧'),
  ('battery_issue', 'Battery Problem', '🔋'),
  ('brake_issue', 'Brake Problem', '🛑'),
  ('fluid_leak', 'Fluid Leak', '💧'),
  ('no_start', 'Won’t Start', '🚨'),
  ('warning_light', 'Warning Light', '⚠️')
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label,
    icon = EXCLUDED.icon;

-- =====================================================
-- SYMPTOM MAPPINGS (CANONICAL + SCHEMA-CORRECT)
-- Table:
--   symptom_mappings(
--     id,
--     symptom_key,
--     category,
--     risk_level,
--     quote_strategy,
--     customer_explainer,
--     mechanic_notes,
--     required_skill_keys,
--     required_tool_keys,
--     required_safety_keys,
--     created_at,
--     updated_at
--   )
-- =====================================================

INSERT INTO public.symptom_mappings (
  symptom_key,
  category,
  risk_level,
  quote_strategy,
  customer_explainer,
  mechanic_notes,
  required_skill_keys,
  required_tool_keys,
  required_safety_keys
)
VALUES
(
  'basic_maintenance',
  'maintenance',
  'low',
  'fixed_simple',
  'Routine maintenance such as oil changes or filters.',
  NULL,
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
),
(
  'battery_issue',
  'electrical',
  'medium',
  'inspection_required',
  'Battery or charging issue causing starting problems.',
  'Test battery and charging system first.',
  ARRAY['electrical']::text[],
  ARRAY['multimeter']::text[],
  ARRAY['battery_safety']::text[]
),
(
  'brake_issue',
  'brakes',
  'high',
  'inspection_required',
  'Braking feels unsafe or abnormal.',
  'Do not road test if braking feels compromised.',
  ARRAY['brake_service']::text[],
  ARRAY['jack','jack_stands']::text[],
  ARRAY['brake_safety','jack_stands_required']::text[]
),
(
  'fluid_leak',
  'engine',
  'medium',
  'inspection_required',
  'Visible fluid leaking under the vehicle.',
  'Identify fluid type before starting engine.',
  ARRAY[]::text[],
  ARRAY['work_light']::text[],
  ARRAY[]::text[]
),
(
  'no_start',
  'electrical',
  'high',
  'diagnostic_only',
  'Vehicle will not start or crank.',
  'Check battery, starter signal, and grounds.',
  ARRAY['electrical']::text[],
  ARRAY['multimeter']::text[],
  ARRAY['battery_safety']::text[]
),
(
  'warning_light',
  'engine',
  'medium',
  'diagnosis_first',
  'Dashboard warning light is illuminated.',
  'Scan codes and confirm before clearing.',
  ARRAY[]::text[],
  ARRAY['scan_tool']::text[],
  ARRAY[]::text[]
)
ON CONFLICT (symptom_key) DO UPDATE
SET
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level,
  quote_strategy = EXCLUDED.quote_strategy,
  customer_explainer = EXCLUDED.customer_explainer,
  mechanic_notes = EXCLUDED.mechanic_notes,
  required_skill_keys = EXCLUDED.required_skill_keys,
  required_tool_keys = EXCLUDED.required_tool_keys,
  required_safety_keys = EXCLUDED.required_safety_keys,
  updated_at = NOW();

-- =====================================================
-- EDUCATION CARDS
-- =====================================================
INSERT INTO public.education_cards (
  symptom_key,
  card_key,
  title,
  summary,
  why_it_happens,
  what_we_check,
  is_it_safe,
  order_index
)
VALUES
(
  'battery_issue',
  'core',
  'Battery keeps dying',
  'We test the battery and charging system.',
  'Age, alternator issues, or parasitic drain.',
  'Battery voltage, terminals, alternator output.',
  'Usually safe short-term.',
  1
),
(
  'brake_issue',
  'core',
  'Brakes feel unsafe',
  'Brakes are safety critical.',
  'Worn pads, rotors, or hydraulic issues.',
  'Pad thickness, rotors, calipers, fluid.',
  'May be unsafe to drive.',
  1
)
ON CONFLICT (symptom_key, card_key) DO UPDATE
SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  why_it_happens = EXCLUDED.why_it_happens,
  what_we_check = EXCLUDED.what_we_check,
  is_it_safe = EXCLUDED.is_it_safe,
  order_index = EXCLUDED.order_index;

-- =====================================================
-- SYMPTOM QUESTIONS
-- =====================================================
INSERT INTO public.symptom_questions (
  symptom_key,
  question_key,
  question_text,
  question_type,
  affects_safety,
  affects_quote,
  display_order
)
VALUES
(
  'battery_issue',
  'battery_age',
  'How old is your battery?',
  'single_choice',
  false,
  true,
  1
),
(
  'brake_issue',
  'brake_noise',
  'Do you hear any noise when braking?',
  'yes_no',
  true,
  true,
  1
)
ON CONFLICT (symptom_key, question_key) DO UPDATE
SET
  question_text = EXCLUDED.question_text,
  question_type = EXCLUDED.question_type,
  affects_safety = EXCLUDED.affects_safety,
  affects_quote = EXCLUDED.affects_quote,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ===================================================================
-- END 0010_seed_data.sql
-- ===================================================================
