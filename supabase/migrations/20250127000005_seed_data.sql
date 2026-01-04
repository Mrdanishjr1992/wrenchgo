-- =====================================================
-- SEED DATA: Lookup tables and defaults
-- =====================================================
-- Purpose: Idempotent seed data for reset safety
-- Safe for: supabase db reset (uses ON CONFLICT DO NOTHING)

-- 1) SKILLS

-- =====================================================
-- 1) SKILLS (FIXED: matches actual schema with quoted key)
-- =====================================================

INSERT INTO public.skills ("key", label, category, created_at)
VALUES
  ('brakes', 'Brakes', 'repair', NOW()),
  ('oil_change', 'Oil Change', 'maintenance', NOW()),
  ('battery', 'Battery', 'repair', NOW()),
  ('diagnostics', 'Diagnostics', 'diagnostics', NOW()),
  ('suspension', 'Suspension', 'repair', NOW())
ON CONFLICT ("key") DO NOTHING;


-- 2) TOOLS

INSERT INTO public.tools ("key", label, category, created_at) VALUES
  ('battery_alternator_tester', 'Battery/alternator tester', 'Electrical', NOW()),
  ('breaker_bar', 'Breaker bar', 'Lifting', NOW()),
  ('consumables_kit', 'Consumables (zip ties, connectors, fuses, wire)', 'General', NOW()),
  ('fluid_catch_pan', 'Fluid catch pan', 'Fluids', NOW()),
  ('funnels', 'Funnels', 'Fluids', NOW()),
  ('impact_wrench', 'Impact wrench', 'Lifting', NOW()),
  ('jack', 'Jack', 'Lifting', NOW()),
  ('jack_stands', 'Jack stands', 'Lifting', NOW()),
  ('jump_pack', 'Jump starter pack', 'Electrical', NOW()),
  ('multimeter', 'Multimeter', 'Electrical', NOW()),
  ('ppe_gloves', 'Gloves / PPE', 'Safety', NOW()),
  ('scan_backup_device', 'Phone/tablet backup (scan app)', 'Diagnostics', NOW()),
  ('scan_tool', 'Professional scan tool', 'Diagnostics', NOW()),
  ('small_parts_inventory', 'Small parts inventory (clamps, bulbs, terminals)', 'General', NOW()),
  ('test_light', 'Test light', 'Electrical', NOW()),
  ('torque_wrench', 'Torque wrench', 'Lifting', NOW()),
  ('vacuum_bleeder_kit', 'Vacuum/bleeder kit', 'Brakes', NOW()),
  ('wheel_chocks', 'Wheel chocks', 'Safety', NOW()),
  ('work_light', 'Work light / headlamp', 'Safety', NOW())
ON CONFLICT ("key") DO NOTHING;

-- 3) SAFETY_MEASURES

INSERT INTO public.safety_measures ("key", label, created_at) VALUES
  ('cones_triangles', 'Cones / warning triangles', NOW()),
  ('fire_chemical_safety', 'Heat/fire/chemical safety awareness', NOW()),
  ('hazard_positioning', 'Safe parking strategy & hazard positioning', NOW()),
  ('jack_stands_required', 'Jack stands used when lifted', NOW()),
  ('jacking_on_uneven', 'Lift/jacking safety on uneven surfaces', NOW()),
  ('photo_documentation', 'Photo documentation before/after', NOW()),
  ('reflective_gear', 'Reflective vest / high‑vis gear', NOW()),
  ('refuse_unsafe_jobs', 'Knows when to refuse unsafe jobs on-site', NOW()),
  ('roadside_awareness', 'Traffic & roadside awareness', NOW()),
  ('wheel_chocks_used', 'Wheel chocks used when lifting', NOW())
ON CONFLICT ("key") DO NOTHING;

-- 4) SYMPTOMS (CUSTOMER-FRIENDLY)

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

-- 5) SYMPTOM_EDUCATION (CUSTOMER-FRIENDLY)

INSERT INTO public.symptom_education
(symptom_key, title, summary, is_it_safe, what_we_check, how_quotes_work)
VALUES
(
  'wont_start',
  'Car Won''t Start',
  'Most no-start issues are related to the battery, starter, or fuel system. A quick diagnosis can identify the exact cause.',
  'Don''t drive - needs diagnosis first',
  'Battery voltage, starter motor, fuel pump, ignition system',
  'Diagnostic fee first, then repair quote based on findings'
),
(
  'warning_light',
  'Warning Light On',
  'Warning lights indicate your car''s computer detected an issue. Some are urgent, others can wait. We''ll help you understand what it means.',
  'Depends on the light - we''ll assess',
  'Diagnostic scan, sensor readings, system health',
  'Diagnostic scan first, then repair estimate'
),
(
  'brakes_wrong',
  'Brake Issues',
  'Brake problems should never be ignored. Whether it''s noise, soft pedal, or pulling, we''ll inspect the entire system for safety.',
  'Drive carefully - get checked ASAP',
  'Pads, rotors, fluid, calipers, brake lines',
  'Inspection first, then itemized repair quote'
),
(
  'strange_noise',
  'Unusual Sounds',
  'Different noises point to different issues. Describing when and where you hear it helps mechanics diagnose faster.',
  'Usually safe to drive short distances',
  'Belts, bearings, exhaust, suspension components',
  'Diagnostic inspection, then repair estimate'
),
(
  'fluid_leak',
  'Fluid Leak',
  'Different fluids mean different issues. The color and location help identify what''s leaking and how urgent it is.',
  'Depends on fluid type - we''ll assess',
  'Leak source, fluid levels, hoses, seals',
  'Inspection to locate leak, then repair quote'
),
(
  'battery_issues',
  'Battery Problems',
  'Battery issues can be the battery itself, alternator, or electrical system. Testing will identify the root cause.',
  'Safe to drive if it starts',
  'Battery voltage, alternator output, connections',
  'Quick test, then replacement or repair quote'
),
(
  'maintenance',
  'Scheduled Maintenance',
  'Regular maintenance keeps your car running smoothly and prevents bigger issues.',
  'Safe to drive',
  'Based on your service needs',
  'Clear pricing for standard services'
),
(
  'not_sure',
  'Need Diagnosis',
  'No problem! Our mechanics will perform a thorough inspection to identify what''s going on with your car.',
  'We''ll assess during diagnosis',
  'Complete vehicle inspection',
  'Diagnostic fee, then detailed findings and quote'
)
ON CONFLICT (symptom_key) DO NOTHING;

-- 5.5) SYMPTOM_MAPPINGS (REQUIRED FOR FOREIGN KEY)

INSERT INTO public.symptom_mappings
(symptom_key, symptom_label, category, quote_strategy, risk_level, id, created_at, updated_at)
VALUES
('wont_start', 'Won''t start', 'Engine', 'diagnosis-first', 'high', gen_random_uuid(), NOW(), NOW()),
('warning_light', 'Warning light', 'Electrical', 'diagnosis-first', 'medium', gen_random_uuid(), NOW(), NOW()),
('brakes_wrong', 'Brakes feel wrong', 'Brakes', 'inspection_required', 'high', gen_random_uuid(), NOW(), NOW()),
('strange_noise', 'Strange noise', 'Unknown', 'diagnosis-first', 'low', gen_random_uuid(), NOW(), NOW()),
('fluid_leak', 'Fluid leak', 'Engine', 'diagnosis-first', 'medium', gen_random_uuid(), NOW(), NOW()),
('battery_issues', 'Battery issues', 'Electrical', 'fixed_simple', 'low', gen_random_uuid(), NOW(), NOW()),
('maintenance', 'Maintenance', 'Maintenance', 'fixed_simple', 'low', gen_random_uuid(), NOW(), NOW()),
('not_sure', 'Not sure', 'Unknown', 'diagnosis-first', 'low', gen_random_uuid(), NOW(), NOW())
ON CONFLICT (symptom_key) DO NOTHING;

-- 6) SYMPTOM_QUESTIONS (CUSTOMER-FRIENDLY)

INSERT INTO public.symptom_questions
(symptom_key, question_key, question_text, question_type, options,
 affects_safety, affects_quote, affects_tools, display_order)
VALUES

-- wont_start
('wont_start','key_turn_result','What happens when you turn the key?','single_choice',
 '["Nothing at all","Clicking sound","Engine cranks but won''t start","Not sure"]'::jsonb,
 true,true,false,10),
('wont_start','dashboard_lights','Are your dashboard lights working?','single_choice',
 '["Yes, normal","Dim or flickering","Not working","Not sure"]'::jsonb,
 false,true,false,20),

-- warning_light
('warning_light','which_light','Which light is on?','single_choice',
 '["Check Engine","ABS/Brake","Oil pressure","Battery","Other/Multiple"]'::jsonb,
 true,true,false,10),
('warning_light','solid_or_flashing','Is the light solid or flashing?','single_choice',
 '["Solid","Flashing","Not sure"]'::jsonb,
 true,true,false,20),

-- brakes_wrong
('brakes_wrong','brake_feel','What do you notice when braking?','multi_choice',
 '["Grinding noise","Squealing","Soft/spongy pedal","Pulls to one side","Vibration"]'::jsonb,
 true,true,false,10),
('brakes_wrong','duration','How long has this been happening?','single_choice',
 '["Just started","Few days","Few weeks","Longer"]'::jsonb,
 false,true,false,20),

-- strange_noise
('strange_noise','noise_type','What kind of noise?','single_choice',
 '["Squealing","Grinding","Knocking","Rattling","Humming","Other"]'::jsonb,
 false,true,false,10),
('strange_noise','when_hear','When do you hear it?','single_choice',
 '["When starting","While driving","When turning","When braking","All the time"]'::jsonb,
 false,true,false,20),

-- fluid_leak
('fluid_leak','fluid_color','What color is the fluid?','single_choice',
 '["Clear/water","Green/yellow","Red/pink","Brown/black","Not sure"]'::jsonb,
 true,true,false,10),
('fluid_leak','puddle_location','Where is the puddle?','single_choice',
 '["Front of car","Middle","Back","Not sure"]'::jsonb,
 false,true,false,20),

-- battery_issues
('battery_issues','battery_symptom','What''s happening?','single_choice',
 '["Slow to start","Won''t hold charge","Electrical issues","Battery light on"]'::jsonb,
 false,true,false,10),
('battery_issues','battery_age','How old is your battery?','single_choice',
 '["Less than 2 years","2-4 years","4+ years","Not sure"]'::jsonb,
 false,false,false,20),

-- maintenance
('maintenance','service_needed','What service do you need?','single_choice',
 '["Oil change","Tire rotation","Brake inspection","Full service","Other"]'::jsonb,
 false,true,false,10),

-- not_sure
('not_sure','concern_reason','What made you concerned?','single_choice',
 '["Something feels off","Preventive check","Recent issue","Other"]'::jsonb,
 false,false,false,10)
ON CONFLICT (symptom_key, question_key) DO NOTHING;

COMMENT ON TABLE public.skills IS 'Mechanic skill categories - seeded data';
COMMENT ON TABLE public.tools IS 'Required tools for mobile mechanics - seeded data';
COMMENT ON TABLE public.safety_measures IS 'Safety requirements for mobile work - seeded data';
COMMENT ON TABLE public.symptoms IS 'Master symptom list - seeded data (customer-friendly)';
COMMENT ON TABLE public.symptom_education IS 'Educational content for symptoms - seeded data (customer-friendly)';
COMMENT ON TABLE public.symptom_questions IS 'Follow-up questions for symptoms - seeded data (customer-friendly)';
