-- =====================================================
-- MIGRATION 0006: SEED DATA
-- =====================================================
-- Purpose: Idempotent seed data for lookup tables
-- Depends on: 0001_baseline_schema.sql
-- Safe for: supabase db reset (uses ON CONFLICT)
-- =====================================================

BEGIN;

-- =====================================================
-- 1) SKILLS
-- =====================================================
INSERT INTO public.skills (key, label, category, created_at)
VALUES
  ('brakes', 'Brakes', 'repair', NOW()),
  ('oil_change', 'Oil Change', 'maintenance', NOW()),
  ('battery', 'Battery', 'repair', NOW()),
  ('diagnostics', 'Diagnostics', 'diagnostics', NOW()),
  ('suspension', 'Suspension', 'repair', NOW()),
  ('engine', 'Engine', 'repair', NOW()),
  ('electrical', 'Electrical', 'repair', NOW()),
  ('cooling', 'Cooling System', 'repair', NOW()),
  ('transmission', 'Transmission', 'repair', NOW()),
  ('electrical_troubleshooting', 'Electrical Troubleshooting', 'diagnostics', NOW()),
  ('battery_charging_system', 'Battery & Charging System', 'repair', NOW()),
  ('cooling_systems', 'Cooling Systems', 'repair', NOW()),
  ('brake_service', 'Brake Service', 'repair', NOW())
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 2) TOOLS
-- =====================================================
INSERT INTO public.tools (key, label, category, created_at) VALUES
  ('scan_tool', 'Diagnostic Scanner', 'Diagnostics', NOW()),
  ('jack', 'Jack', 'Lifting', NOW()),
  ('jack_stands', 'Jack Stands', 'Lifting', NOW()),
  ('wrench_set', 'Wrench Set', 'General', NOW()),
  ('multimeter', 'Multimeter', 'Electrical', NOW()),
  ('work_light', 'Work Light', 'Safety', NOW()),
  ('jump_pack', 'Jump starter pack', 'Electrical', NOW()),
  ('battery_tester', 'Battery tester', 'Electrical', NOW()),
  ('pressure_tester', 'Cooling system pressure tester', 'Cooling', NOW()),
  ('infrared_thermometer', 'Infrared thermometer', 'Diagnostics', NOW()),
  ('uv_dye_kit', 'UV dye leak kit', 'Fluids', NOW()),
  ('hammer', 'Small hammer (starter tap test)', 'General', NOW()),
  ('gloves', 'Safety Gloves', 'Safety', NOW())
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 3) SAFETY_MEASURES
-- =====================================================
INSERT INTO public.safety_measures (key, label, created_at) VALUES
  ('jack_stands_required', 'Use jack stands when lifting vehicle', NOW()),
  ('wheel_chocks_used', 'Use wheel chocks', NOW()),
  ('reflective_gear', 'Wear reflective vest', NOW()),
  ('roadside_awareness', 'Be aware of traffic', NOW()),
  ('photo_documentation', 'Take before/after photos', NOW()),
  ('battery_safety', 'Battery safety (sparks, acid, jump starts)', NOW()),
  ('hazard_positioning', 'Safe positioning & hazard awareness', NOW()),
  ('brake_safety', 'Brake safety (do not test if unsafe)', NOW()),
  ('chemical_safety', 'Heat/fire/chemical safety awareness', NOW()),
  ('do_not_drive', 'Do not drive until inspected', NOW()),
  ('fan_safety', 'Fan safety (fans may turn on unexpectedly)', NOW())
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 4) SYMPTOMS
-- =====================================================
INSERT INTO public.symptoms (key, label, icon) VALUES
  ('basic_maintenance', 'Routine Maintenance', '🔧'),
  ('battery_issue', 'Battery Problems', '🔋'),
  ('brake_issue', 'Brake Problems', '🛑'),
  ('fluid_leak', 'Fluid Leak', '💧'),
  ('no_start_no_crank', 'Won''t Start', '🚨'),
  ('strange_noise', 'Strange Noise', '🔊'),
  ('warning_light', 'Warning Light', '⚠️'),
  ('elec_no_crank_no_click', 'No Crank No Click', '🔌'),
  ('elec_starter_clicking', 'Starter Clicking', '🔌'),
  ('elec_alternator_not_charging', 'Alternator Not Charging', '🔌'),
  ('elec_parasitic_drain', 'Battery Drains When Parked', '🔋'),
  ('elec_abs_light_on', 'ABS Light On', '⚠️'),
  ('cool_overheating', 'Overheating', '🌡️'),
  ('cool_coolant_leak', 'Coolant Leak', '💧'),
  ('cool_radiator_fan_not_working', 'Radiator Fan Not Working', '🌡️'),
  ('cool_thermostat_stuck', 'Thermostat Stuck', '🌡️'),
  ('cool_water_pump_failure', 'Water Pump Failure', '💧')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon;

-- =====================================================
-- 5) SYMPTOM_MAPPINGS
-- =====================================================
INSERT INTO public.symptom_mappings
(symptom_key, symptom_label, category, required_skill_keys, suggested_tool_keys, required_safety_keys, quote_strategy, risk_level, customer_explainer, mechanic_notes)
VALUES
('basic_maintenance', 'Basic Maintenance', 'Maintenance', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'fixed_simple', 'low',
'Routine service like oil change, filters, wipers, or scheduled maintenance.', null),

('battery_issue', 'Battery Issue', 'Electrical & Charging', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'inspection_required', 'medium',
'Slow crank, clicking, dead battery, or needing frequent jump-starts.', null),

('elec_no_crank_no_click', 'No crank, no click, no sound', 'Electrical & Charging', ARRAY['electrical_troubleshooting']::text[], ARRAY['multimeter','scan_tool']::text[], ARRAY['battery_safety','hazard_positioning']::text[], 'diagnostic_only', 'medium',
'No sound at all usually means no power to the starter.',
'Check battery voltage first. Test ignition switch, neutral safety switch, clutch switch.'),

('elec_starter_clicking', 'Starter clicks but won''t crank', 'Electrical & Charging', ARRAY['electrical_troubleshooting']::text[], ARRAY['multimeter','jump_pack','battery_tester']::text[], ARRAY['battery_safety','hazard_positioning']::text[], 'diagnostic_only', 'medium',
'Clicking usually means low battery voltage or a failing starter.',
'Test battery voltage under load. Check starter connections and ground.'),

('elec_alternator_not_charging', 'Alternator not charging', 'Electrical & Charging', ARRAY['battery_charging_system','electrical_troubleshooting']::text[], ARRAY['multimeter','battery_tester']::text[], ARRAY['battery_safety']::text[], 'diagnostic_only', 'medium',
'If the alternator isn''t charging, the battery will drain and the car will stall.',
'Test battery voltage at idle and 2000 RPM.'),

('elec_parasitic_drain', 'Battery drains when parked', 'Electrical & Charging', ARRAY['electrical_troubleshooting']::text[], ARRAY['multimeter','battery_tester']::text[], ARRAY['battery_safety']::text[], 'diagnostic_only', 'low',
'Something is drawing power when the car is off.',
'Test battery health first. Measure draw with multimeter.'),

('brake_issue', 'Brake Issue', 'Brakes', ARRAY['brake_service']::text[], ARRAY[]::text[], ARRAY['brake_safety']::text[], 'inspection_required', 'high',
'Braking feels unsafe: squealing/grinding, vibration, soft pedal.', null),

('elec_abs_light_on', 'ABS warning light on', 'Electrical & Charging', ARRAY['electrical_troubleshooting','brake_service']::text[], ARRAY['scan_tool']::text[], ARRAY['brake_safety']::text[], 'diagnostic_only', 'medium',
'ABS light indicates a fault in the anti-lock brake system.',
'Scan for ABS codes. Common: wheel speed sensors, tone rings.'),

('cool_overheating', 'Engine overheating', 'Cooling System', ARRAY['cooling_systems']::text[], ARRAY['scan_tool','infrared_thermometer','pressure_tester']::text[], ARRAY['chemical_safety','do_not_drive']::text[], 'diagnostic_only', 'high',
'Overheating can cause severe engine damage.',
'Check coolant level and condition. Pressure test system for leaks.'),

('cool_coolant_leak', 'Coolant leak', 'Cooling System', ARRAY['cooling_systems']::text[], ARRAY['pressure_tester','uv_dye_kit']::text[], ARRAY['chemical_safety']::text[], 'inspection_required', 'medium',
'Coolant leaks can come from hoses, radiator, water pump, or head gasket.',
'Pressure test cooling system. Use UV dye if needed.'),

('cool_radiator_fan_not_working', 'Radiator fan not running', 'Cooling System', ARRAY['cooling_systems','electrical_troubleshooting']::text[], ARRAY['multimeter','scan_tool']::text[], ARRAY['fan_safety']::text[], 'diagnostic_only', 'medium',
'If the radiator fan doesn''t run, the engine will overheat in traffic.',
'Test fan motor directly. Check fan relay and fuse.'),

('cool_thermostat_stuck', 'Thermostat stuck', 'Cooling System', ARRAY['cooling_systems']::text[], ARRAY['scan_tool','infrared_thermometer']::text[], ARRAY['chemical_safety']::text[], 'diagnostic_only', 'medium',
'A stuck thermostat causes overheating or slow warm-up.',
'Check engine temp with scan tool.'),

('cool_water_pump_failure', 'Water pump failing', 'Cooling System', ARRAY['cooling_systems']::text[], ARRAY['pressure_tester']::text[], ARRAY['chemical_safety']::text[], 'inspection_required', 'high',
'A failing water pump can leak coolant or cause overheating.',
'Check for coolant leak at weep hole. Listen for bearing noise.'),

('fluid_leak', 'Fluid Leak', 'Engine', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'inspection_required', 'medium',
'Visible fluid under the vehicle or low fluid warnings.', null),

('strange_noise', 'Strange Noise', 'Other', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'inspection_required', 'medium',
'Unusual sound like squeal, rattle, clunk, grinding, or ticking.', null),

('warning_light', 'Check Engine Light On', 'Engine', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'diagnosis-first', 'medium',
'Dashboard warning light is illuminated.', null),

('no_start_no_crank', 'No Start / No Crank', 'Electrical', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'diagnostic_only', 'high',
'Turning the key does nothing or only clicks; engine does not crank.', null)

ON CONFLICT (symptom_key) DO UPDATE SET
  symptom_label = EXCLUDED.symptom_label,
  category = EXCLUDED.category,
  required_skill_keys = EXCLUDED.required_skill_keys,
  suggested_tool_keys = EXCLUDED.suggested_tool_keys,
  required_safety_keys = EXCLUDED.required_safety_keys,
  quote_strategy = EXCLUDED.quote_strategy,
  risk_level = EXCLUDED.risk_level,
  customer_explainer = EXCLUDED.customer_explainer,
  mechanic_notes = EXCLUDED.mechanic_notes,
  updated_at = NOW();

-- =====================================================
-- 6) EDUCATION_CARDS
-- =====================================================
INSERT INTO public.education_cards
(symptom_key, card_key, title, summary, why_it_happens, what_we_check, is_it_safe, prep_before_visit, quote_expectation, red_flags, order_index)
VALUES
('basic_maintenance', 'core', 'Routine maintenance',
  'We''ll confirm the right fluids and parts for your exact vehicle.',
  'Different engines require specific oil types and filters.',
  'Verify vehicle details, inspect fluids/filters, perform service.',
  'Safe—this is preventative.',
  'Know your last service date/mileage. Park on level surface.',
  'Usually fixed-price services.',
  'If warning lights are on, we''ll advise next steps.',
  1),
('battery_issue', 'core', 'Battery keeps dying',
  'We''ll test the battery and charging system.',
  'Old battery, alternator output, or loose connections.',
  'Battery test, alternator test, terminal inspection.',
  'Usually safe short trips, but you might get stranded.',
  'Know battery age. Mention any recent jump starts.',
  'Sometimes fixed-price after testing.',
  'Battery hot/swollen or rotten-egg smell—call for help.',
  1),
('brake_issue', 'core', 'Brakes feel unsafe',
  'Brakes are safety-critical. We''ll inspect before quoting.',
  'Worn pads/rotors, seized calipers, air in lines.',
  'Pad/rotor thickness, caliper movement, fluid level.',
  'If grinding loudly or pulling hard—avoid driving.',
  'Tell us the exact feel and where the car is parked.',
  'Often a range quote after inspection.',
  'Pedal to the floor or metal-on-metal grinding—do not drive.',
  1),
('fluid_leak', 'core', 'Fluid leaking under car',
  'Color and location help diagnose quickly.',
  'Oil, coolant, brake fluid leaks look similar.',
  'Identify fluid type, check levels, inspect hoses.',
  'Brake fluid or overheating coolant—do not drive.',
  'Photo the puddle and note color/smell.',
  'Inspection-first, then repair price.',
  'Rapid leak, overheating, or warning lights—stop safely.',
  1),
('no_start_no_crank', 'core', 'Car won''t start',
  'Often battery, connection, or starter issue.',
  'Weak battery, loose terminals, starter relay.',
  'Battery voltage, terminal condition, starter signal.',
  'Safe to stay parked. Avoid repeated start attempts.',
  'Have keys ready, pop hood, tell us what you heard.',
  'Starts with diagnostic. Repair price depends on findings.',
  'Burning smell, smoke, or hot cables—keep distance.',
  1),
('strange_noise', 'core', 'Strange noise while driving',
  'We''ll narrow it down quickly.',
  'Brakes, suspension, bearings, belts, exhaust.',
  'When/where noise happens + inspection.',
  'If shaking hard or steering unsafe—avoid driving.',
  'Record video/audio and note when it happens.',
  'Often inspection-required.',
  'Loud clunk + loss of control—stop driving.',
  1),
('warning_light', 'core', 'Dashboard warning light',
  'We''ll scan and explain in plain English.',
  'Sensor or system detected something out of range.',
  'Code scan + quick checks.',
  'Red = stop soon. Yellow = usually okay short-term.',
  'Photo the light and note any driving changes.',
  'Best handled as diagnostic-first.',
  'Flashing check-engine light—pull over safely.',
  1)
ON CONFLICT (symptom_key, card_key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  why_it_happens = EXCLUDED.why_it_happens,
  what_we_check = EXCLUDED.what_we_check,
  is_it_safe = EXCLUDED.is_it_safe,
  prep_before_visit = EXCLUDED.prep_before_visit,
  quote_expectation = EXCLUDED.quote_expectation,
  red_flags = EXCLUDED.red_flags,
  order_index = EXCLUDED.order_index;

-- =====================================================
-- 7) SYMPTOM_EDUCATION
-- =====================================================
INSERT INTO public.symptom_education
(symptom_key, title, summary, is_it_safe, what_we_check, how_quotes_work)
VALUES
('basic_maintenance', 'Routine Maintenance',
  'Regular service keeps your car running smoothly.',
  'Completely safe. This is preventative care.',
  'We verify vehicle details, check fluids, inspect filters and belts.',
  'Most maintenance has fixed prices. Oil changes $40-$80.'),
('battery_issue', 'Battery Problems',
  'Slow start or won''t start is usually battery or charging.',
  'Usually safe short trips. If battery is hot/swollen—don''t touch.',
  'We test voltage, alternator output, terminals, parasitic drain.',
  'Battery testing free or $20-$30. New battery $100-$200.'),
('brake_issue', 'Brake Problems',
  'Any change in feel, sound, or stopping power needs attention.',
  'Grinding or pedal to floor = DO NOT DRIVE.',
  'Measure pad thickness, check rotors, test calipers, inspect lines.',
  'Front pads $150-$300. Rotors add $200-$400.'),
('fluid_leak', 'Fluid Leaking',
  'Different fluids mean different problems.',
  'Oil leaks safe short-term. Brake/coolant = DO NOT DRIVE.',
  'Identify fluid type, check levels, inspect hoses/gaskets.',
  'Small leaks $200-$400. Larger leaks $400-$800.'),
('no_start_no_crank', 'Won''t Start',
  'Usually electrical: battery, connections, or starter.',
  'Safe parked. Don''t keep trying—might drain battery.',
  'Battery voltage, terminal connections, starter signal, security codes.',
  'Diagnosis $50-$100. Battery $100-$200. Starter $300-$600.'),
('strange_noise', 'Strange Noise',
  'Noises can come from brakes, suspension, engine, exhaust.',
  'Shaking or loss of control = stop immediately.',
  'When noise happens, listen for source, inspect area.',
  'Diagnosis $50-$100. Repairs $100 to $1,000+.'),
('warning_light', 'Check Engine Light',
  'Your car stored a diagnostic code.',
  'Solid light = usually safe short distances. FLASHING = pull over.',
  'Scan codes, check obvious issues, explain what''s urgent.',
  'Code scanning $50-$100. O2 sensors $200-$400.')
ON CONFLICT (symptom_key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  is_it_safe = EXCLUDED.is_it_safe,
  what_we_check = EXCLUDED.what_we_check,
  how_quotes_work = EXCLUDED.how_quotes_work;

-- =====================================================
-- 8) SYMPTOM_QUESTIONS
-- =====================================================
INSERT INTO public.symptom_questions
(symptom_key, question_key, question_text, question_type, options, affects_safety, affects_quote, display_order)
VALUES
('battery_issue', 'how_old_battery', 'How old is your battery?', 'single_choice', '["Less than 2 years", "2-4 years", "4+ years", "Don''t know"]'::jsonb, false, true, 1),
('battery_issue', 'jump_start_needed', 'Have you needed a jump start recently?', 'yes_no', null, false, true, 2),
('battery_issue', 'lights_dim', 'Do your headlights or interior lights dim?', 'yes_no', null, false, false, 3),
('brake_issue', 'brake_noise_type', 'What kind of noise do you hear?', 'single_choice', '["Squealing", "Grinding", "Clicking", "No noise"]'::jsonb, true, true, 1),
('brake_issue', 'pedal_feel', 'How does the brake pedal feel?', 'single_choice', '["Normal", "Soft/spongy", "Hard/stiff", "Goes to floor"]'::jsonb, true, true, 2),
('brake_issue', 'vibration', 'Do you feel vibration when braking?', 'yes_no', null, false, true, 3),
('fluid_leak', 'fluid_color', 'What color is the fluid?', 'single_choice', '["Clear/water", "Brown/black (oil)", "Green/orange (coolant)", "Red (transmission)", "Yellow/brown (brake)"]'::jsonb, true, true, 1),
('fluid_leak', 'leak_size', 'How much fluid is leaking?', 'single_choice', '["Few drops", "Small puddle", "Large puddle", "Constant drip"]'::jsonb, true, true, 2),
('no_start_no_crank', 'what_happens', 'What happens when you turn the key?', 'single_choice', '["Nothing at all", "Clicking sound", "Lights dim", "Accessories work"]'::jsonb, false, true, 1),
('no_start_no_crank', 'battery_age', 'How old is your battery?', 'single_choice', '["Less than 2 years", "2-4 years", "4+ years", "Don''t know"]'::jsonb, false, true, 2),
('strange_noise', 'when_noise', 'When do you hear the noise?', 'multi_choice', '["While driving", "When turning", "When braking", "Over bumps", "At idle"]'::jsonb, false, true, 1),
('strange_noise', 'noise_type', 'What does it sound like?', 'single_choice', '["Squealing", "Grinding", "Clunking", "Rattling", "Ticking"]'::jsonb, false, true, 2),
('warning_light', 'light_color', 'What color is the warning light?', 'single_choice', '["Yellow/orange", "Red", "Blue", "Don''t know"]'::jsonb, true, false, 1),
('warning_light', 'light_behavior', 'Is the light solid or flashing?', 'single_choice', '["Solid/steady", "Flashing", "Comes and goes"]'::jsonb, true, true, 2),
('basic_maintenance', 'service_type', 'What service do you need?', 'multi_choice', '["Oil change", "Air filter", "Cabin filter", "Tire rotation", "Other"]'::jsonb, false, true, 1),
('basic_maintenance', 'last_service', 'When was your last service?', 'single_choice', '["Less than 3 months", "3-6 months", "6-12 months", "Over a year"]'::jsonb, false, false, 2)
ON CONFLICT (symptom_key, question_key) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  question_type = EXCLUDED.question_type,
  options = EXCLUDED.options,
  affects_safety = EXCLUDED.affects_safety,
  affects_quote = EXCLUDED.affects_quote,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- =====================================================
-- 9) MEDIA_ASSETS (App videos/images)
-- =====================================================
INSERT INTO public.media_assets (key, bucket, path, public_url, content_type) VALUES
  ('logo_video', 'media', 'logovideo.mp4', 'https://komsqqxqirvfgforixxq.supabase.co/storage/v1/object/public/media/logovideo.mp4', 'video/mp4'),
  ('wrenchgo_ad_1', 'media', 'wrenchGoAd.mp4', 'https://komsqqxqirvfgforixxq.supabase.co/storage/v1/object/public/media/wrenchGoAd.mp4', 'video/mp4'),
  ('wrenchgo_ad_2', 'media', 'wrenchGoAd2.mp4', 'https://komsqqxqirvfgforixxq.supabase.co/storage/v1/object/public/media/wrenchGoAd2.mp4', 'video/mp4'),
  ('wrenchgo_ad_3', 'media', 'wrenchGoAd3.mp4', 'https://komsqqxqirvfgforixxq.supabase.co/storage/v1/object/public/media/wrenchGoAd3.mp4', 'video/mp4')
ON CONFLICT (key) DO NOTHING;

COMMIT;
