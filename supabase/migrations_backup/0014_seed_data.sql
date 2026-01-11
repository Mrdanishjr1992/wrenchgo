-- =====================================================
-- MIGRATION 0006: SEED DATA (POLISHED + EXPANDED)
-- =====================================================
-- Purpose: Idempotent seed data for lookup tables
-- Depends on: 0001_baseline_schema.sql
-- Safe for: supabase db reset (uses ON CONFLICT)
--
-- Notes:
-- - “DO NOTHING” is used where keys should be immutable once created.
-- - “DO UPDATE” is used where copy/labels/icons may evolve over time.
-- - All inserts are deterministic and can be re-run safely.
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
-- 2) TOOLS (Expanded + standardized categories)
-- =====================================================
-- Categories used: General, Diagnostics, Lifting, Electrical, Safety, Cooling, Fluids, Brakes, Tires, Power Tools
INSERT INTO public.tools (key, label, category, created_at) VALUES
  -- Diagnostics
  ('scan_tool', 'Diagnostic Scanner', 'Diagnostics', NOW()),
  ('code_reader_basic', 'Basic OBD-II Code Reader', 'Diagnostics', NOW()),
  ('bidirectional_scan_tool', 'Bi-directional Scan Tool', 'Diagnostics', NOW()),
  ('infrared_thermometer', 'Infrared Thermometer', 'Diagnostics', NOW()),
  ('smoke_machine', 'EVAP/Intake Smoke Machine', 'Diagnostics', NOW()),
  ('vacuum_gauge', 'Vacuum Gauge', 'Diagnostics', NOW()),
  ('compression_tester', 'Compression Tester', 'Diagnostics', NOW()),
  ('leakdown_tester', 'Cylinder Leakdown Tester', 'Diagnostics', NOW()),
  ('fuel_pressure_gauge', 'Fuel Pressure Gauge', 'Diagnostics', NOW()),

  -- Lifting / Support
  ('jack', 'Jack', 'Lifting', NOW()),
  ('floor_jack', 'Floor Jack', 'Lifting', NOW()),
  ('bottle_jack', 'Bottle Jack', 'Lifting', NOW()),
  ('jack_stands', 'Jack Stands', 'Lifting', NOW()),
  ('wheel_chocks', 'Wheel Chocks', 'Lifting', NOW()),
  ('ramps', 'Vehicle Ramps', 'Lifting', NOW()),
  ('creeper', 'Mechanic Creeper', 'Lifting', NOW()),

  -- General hand tools
  ('wrench_set', 'Wrench Set', 'General', NOW()),
  ('socket_set', 'Socket Set (Metric + SAE)', 'General', NOW()),
  ('ratchet_set', 'Ratchet Set', 'General', NOW()),
  ('breaker_bar', 'Breaker Bar', 'General', NOW()),
  ('torque_wrench', 'Torque Wrench', 'General', NOW()),
  ('screwdriver_set', 'Screwdriver Set', 'General', NOW()),
  ('pliers_set', 'Pliers Set', 'General', NOW()),
  ('allen_keys', 'Allen/Hex Key Set', 'General', NOW()),
  ('pry_bar', 'Pry Bar', 'General', NOW()),
  ('hammer', 'Small Hammer (Tap Test)', 'General', NOW()),
  ('utility_knife', 'Utility Knife', 'General', NOW()),
  ('trim_tools', 'Trim Removal Tools', 'General', NOW()),
  ('magnetic_pickup', 'Magnetic Pickup Tool', 'General', NOW()),

  -- Power tools / air tools
  ('impact_wrench', 'Impact Wrench', 'Power Tools', NOW()),
  ('air_compressor', 'Air Compressor', 'Power Tools', NOW()),
  ('air_ratchet', 'Air Ratchet', 'Power Tools', NOW()),
  ('electric_ratchet', 'Electric Ratchet', 'Power Tools', NOW()),
  ('drill_driver', 'Drill/Driver', 'Power Tools', NOW()),

  -- Electrical
  ('multimeter', 'Multimeter', 'Electrical', NOW()),
  ('test_light', 'Test Light', 'Electrical', NOW()),
  ('power_probe', 'Power Probe (Circuit Tester)', 'Electrical', NOW()),
  ('jump_pack', 'Jump Starter Pack', 'Electrical', NOW()),
  ('battery_tester', 'Battery Tester', 'Electrical', NOW()),
  ('battery_charger', 'Battery Charger/Maintainer', 'Electrical', NOW()),

  -- Cooling / fluids
  ('pressure_tester', 'Cooling System Pressure Tester', 'Cooling', NOW()),
  ('coolant_funnel', 'No-Spill Coolant Funnel', 'Cooling', NOW()),
  ('uv_dye_kit', 'UV Dye Leak Kit', 'Fluids', NOW()),
  ('oil_filter_wrench', 'Oil Filter Wrench', 'Fluids', NOW()),
  ('fluid_pump', 'Fluid Transfer Pump', 'Fluids', NOW()),
  ('drain_pan', 'Drain Pan', 'Fluids', NOW()),

  -- Brakes
  ('brake_bleeder', 'Brake Bleeder Kit', 'Brakes', NOW()),
  ('brake_caliper_tool', 'Brake Caliper Piston Tool', 'Brakes', NOW()),
  ('c_clamp', 'C-Clamp (Brake Compression)', 'Brakes', NOW()),

  -- Tires / wheel
  ('tire_pressure_gauge', 'Tire Pressure Gauge', 'Tires', NOW()),
  ('lug_wrench', 'Lug Wrench', 'Tires', NOW()),
  ('tire_plug_kit', 'Tire Plug Kit', 'Tires', NOW()),

  -- Safety / visibility
  ('work_light', 'Work Light', 'Safety', NOW()),
  ('gloves', 'Safety Gloves', 'Safety', NOW()),
  ('safety_glasses', 'Safety Glasses', 'Safety', NOW()),
  ('reflective_vest', 'Reflective Vest', 'Safety', NOW()),
  ('fire_extinguisher', 'Fire Extinguisher', 'Safety', NOW())
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category;

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

  -- Electrical (more specific)
  ('elec_no_crank_no_click', 'No Crank No Click', '🔌'),
  ('elec_starter_clicking', 'Starter Clicking', '🔌'),
  ('elec_alternator_not_charging', 'Alternator Not Charging', '🔌'),
  ('elec_parasitic_drain', 'Battery Drains When Parked', '🔋'),
  ('elec_abs_light_on', 'ABS Light On', '⚠️'),

  -- Cooling
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
-- quote_strategy suggestions:
-- - fixed_simple, inspection_required, diagnostic_only, diagnosis_first
-- risk_level suggestions:
-- - low, medium, high
INSERT INTO public.symptom_mappings
(symptom_key, symptom_label, category, required_skill_keys, suggested_tool_keys, required_safety_keys, quote_strategy, risk_level, customer_explainer, mechanic_notes)
VALUES
('basic_maintenance', 'Basic Maintenance', 'Maintenance',
  ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[],
  'fixed_simple', 'low',
  'Routine service like oil change, filters, wipers, or scheduled maintenance.',
  NULL),

('battery_issue', 'Battery Issue', 'Electrical & Charging',
  ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[],
  'inspection_required', 'medium',
  'Slow crank, clicking, dead battery, or needing frequent jump-starts.',
  NULL),

('elec_no_crank_no_click', 'No crank, no click, no sound', 'Electrical & Charging',
  ARRAY['electrical_troubleshooting']::text[],
  ARRAY['multimeter','scan_tool']::text[],
  ARRAY['battery_safety','hazard_positioning']::text[],
  'diagnostic_only', 'medium',
  'No sound at all usually means no power to the starter.',
  'Check battery voltage first. Test ignition switch, neutral safety switch, clutch switch.'),

('elec_starter_clicking', 'Starter clicks but won''t crank', 'Electrical & Charging',
  ARRAY['electrical_troubleshooting']::text[],
  ARRAY['multimeter','jump_pack','battery_tester']::text[],
  ARRAY['battery_safety','hazard_positioning']::text[],
  'diagnostic_only', 'medium',
  'Clicking usually means low battery voltage or a failing starter.',
  'Test battery voltage under load. Check starter connections and ground.'),

('elec_alternator_not_charging', 'Alternator not charging', 'Electrical & Charging',
  ARRAY['battery_charging_system','electrical_troubleshooting']::text[],
  ARRAY['multimeter','battery_tester']::text[],
  ARRAY['battery_safety']::text[],
  'diagnostic_only', 'medium',
  'If the alternator isn''t charging, the battery will drain and the car may stall.',
  'Test battery voltage at idle and ~2000 RPM. Confirm belt condition and connections.'),

('elec_parasitic_drain', 'Battery drains when parked', 'Electrical & Charging',
  ARRAY['electrical_troubleshooting']::text[],
  ARRAY['multimeter','battery_tester']::text[],
  ARRAY['battery_safety']::text[],
  'diagnostic_only', 'low',
  'Something is drawing power when the car is off.',
  'Test battery health first. Then measure key-off draw and isolate by fuses.'),

('brake_issue', 'Brake Issue', 'Brakes',
  ARRAY['brake_service']::text[],
  ARRAY['jack','jack_stands','wheel_chocks','work_light']::text[],
  ARRAY['brake_safety','jack_stands_required','wheel_chocks_used']::text[],
  'inspection_required', 'high',
  'Braking feels unsafe: squealing/grinding, vibration, soft pedal, or pulling.',
  'Do not road-test if unsafe. Inspect pad/rotor thickness and caliper function first.'),

('elec_abs_light_on', 'ABS warning light on', 'Electrical & Charging',
  ARRAY['electrical_troubleshooting','brake_service']::text[],
  ARRAY['scan_tool']::text[],
  ARRAY['brake_safety']::text[],
  'diagnostic_only', 'medium',
  'ABS light indicates a fault in the anti-lock brake system.',
  'Scan for ABS codes. Common causes: wheel speed sensors, tone rings, wiring.'),

('cool_overheating', 'Engine overheating', 'Cooling System',
  ARRAY['cooling_systems']::text[],
  ARRAY['scan_tool','infrared_thermometer','pressure_tester']::text[],
  ARRAY['chemical_safety','do_not_drive']::text[],
  'diagnostic_only', 'high',
  'Overheating can cause severe engine damage.',
  'Check coolant level/condition, fan operation, and pressure test for leaks.'),

('cool_coolant_leak', 'Coolant leak', 'Cooling System',
  ARRAY['cooling_systems']::text[],
  ARRAY['pressure_tester','uv_dye_kit']::text[],
  ARRAY['chemical_safety']::text[],
  'inspection_required', 'medium',
  'Coolant leaks can come from hoses, radiator, water pump, or head gasket.',
  'Pressure test cooling system. Use UV dye if needed.'),

('cool_radiator_fan_not_working', 'Radiator fan not running', 'Cooling System',
  ARRAY['cooling_systems','electrical_troubleshooting']::text[],
  ARRAY['multimeter','scan_tool']::text[],
  ARRAY['fan_safety']::text[],
  'diagnostic_only', 'medium',
  'If the radiator fan doesn''t run, the engine may overheat in traffic.',
  'Command fan (if supported), test motor, relay, fuse, and sensor inputs.'),

('cool_thermostat_stuck', 'Thermostat stuck', 'Cooling System',
  ARRAY['cooling_systems']::text[],
  ARRAY['scan_tool','infrared_thermometer']::text[],
  ARRAY['chemical_safety']::text[],
  'diagnostic_only', 'medium',
  'A stuck thermostat can cause overheating or slow warm-up.',
  'Confirm temps via scan tool and compare inlet/outlet temps.'),

('cool_water_pump_failure', 'Water pump failing', 'Cooling System',
  ARRAY['cooling_systems']::text[],
  ARRAY['pressure_tester']::text[],
  ARRAY['chemical_safety','do_not_drive']::text[],
  'inspection_required', 'high',
  'A failing water pump can leak coolant or cause overheating.',
  'Check for leak at weep hole, bearing noise, and belt-driven play.'),

('fluid_leak', 'Fluid Leak', 'Engine',
  ARRAY[]::text[],
  ARRAY['work_light','uv_dye_kit','drain_pan']::text[],
  ARRAY['hazard_positioning','photo_documentation']::text[],
  'inspection_required', 'medium',
  'Visible fluid under the vehicle or low fluid warnings.',
  'Identify fluid type first (oil/coolant/brake/trans). Confirm level before starting.'),

('strange_noise', 'Strange Noise', 'Other',
  ARRAY[]::text[],
  ARRAY['work_light']::text[],
  ARRAY['hazard_positioning']::text[],
  'inspection_required', 'medium',
  'Unusual sound like squeal, rattle, clunk, grinding, or ticking.',
  'Try to reproduce: turning/braking/bumps/idle. Inspect likely systems.'),

('warning_light', 'Check Engine Light On', 'Engine',
  ARRAY[]::text[],
  ARRAY['scan_tool']::text[],
  ARRAY['photo_documentation']::text[],
  'diagnosis_first', 'medium',
  'Your vehicle stored a diagnostic code that points us to the system to inspect.',
  'Scan codes, check freeze frame, verify symptoms, then recommend fixes.'),

('no_start_no_crank', 'No Start / No Crank', 'Electrical',
  ARRAY[]::text[],
  ARRAY['multimeter','jump_pack','battery_tester']::text[],
  ARRAY['battery_safety','hazard_positioning']::text[],
  'diagnostic_only', 'high',
  'Turning the key does nothing or only clicks; engine does not crank.',
  'Verify battery state-of-charge, terminals/grounds, starter signal, immobilizer issues.')
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
  'Old battery, alternator output, parasitic drain, or loose connections.',
  'Battery test, alternator test, terminal inspection, draw check if needed.',
  'Usually safe short trips, but you might get stranded.',
  'Know battery age. Mention any recent jump-starts.',
  'Often diagnostic-first, then fixed price after findings.',
  'Battery hot/swollen or rotten-egg smell—do not touch. Get help.',
  1),

('brake_issue', 'core', 'Brakes feel unsafe',
  'Brakes are safety-critical. We''ll inspect before quoting.',
  'Worn pads/rotors, seized calipers, air in lines, or leaks.',
  'Pad/rotor thickness, caliper movement, fluid level, lines/hoses.',
  'If grinding loudly or pulling hard—avoid driving.',
  'Tell us the exact feel and where the car is parked.',
  'Often a range quote after inspection.',
  'Pedal to the floor or metal-on-metal grinding—do not drive.',
  1),

('fluid_leak', 'core', 'Fluid leaking under car',
  'Color and location help diagnose quickly.',
  'Oil, coolant, brake fluid, and transmission fluid can look similar at first glance.',
  'Identify fluid type, check levels, inspect hoses/gaskets/seals.',
  'Brake fluid or overheating coolant—do not drive.',
  'Photo the puddle and note color/smell. Put cardboard under the leak if possible.',
  'Inspection-first, then repair price.',
  'Rapid leak, overheating, or warning lights—stop safely.',
  1),

('no_start_no_crank', 'core', 'Car won''t start',
  'Often battery, connection, starter, or security issue.',
  'Weak battery, loose terminals, starter relay, or immobilizer.',
  'Battery voltage, terminal condition, starter signal, code scan if needed.',
  'Safe to stay parked. Avoid repeated start attempts.',
  'Have keys ready, pop hood, tell us what you heard/saw on the dash.',
  'Starts with diagnostic. Repair price depends on findings.',
  'Burning smell, smoke, or hot cables—keep distance.',
  1),

('strange_noise', 'core', 'Strange noise while driving',
  'We''ll narrow it down quickly with a few questions and a targeted inspection.',
  'Brakes, suspension, bearings, belts, exhaust, or loose hardware.',
  'When/where it happens + inspection of likely systems.',
  'If shaking hard or steering feels unsafe—avoid driving.',
  'Record video/audio and note when it happens (speed, turning, bumps).',
  'Often inspection-required.',
  'Loud clunk + loss of control—stop driving.',
  1),

('warning_light', 'core', 'Dashboard warning light',
  'We''ll scan and explain in plain English.',
  'A sensor or system detected something out of range and stored a code.',
  'Code scan + quick checks to confirm root cause.',
  'Red = stop soon. Yellow = usually okay short-term (depends on symptoms).',
  'Photo the light and note any driving changes (rough idle, limp mode).',
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
  'Regular service keeps your car running smoothly and prevents bigger repairs.',
  'Completely safe. This is preventative care.',
  'We verify vehicle details, check fluids, inspect filters, belts, and key wear items.',
  'Most maintenance has fixed prices. Oil changes often range $40–$80 (market dependent).'),

('battery_issue', 'Battery Problems',
  'Slow crank or no-start is usually battery, connections, alternator, or parasitic drain.',
  'Usually safe short trips. If the battery is hot/swollen—don''t touch it.',
  'We test voltage, alternator output, terminals/grounds, and draw if needed.',
  'Battery testing is often free or ~$20–$30. New battery commonly $100–$200.'),

('brake_issue', 'Brake Problems',
  'Any change in stopping power, noise, or pedal feel needs attention.',
  'Grinding or pedal to floor = DO NOT DRIVE.',
  'We measure pad thickness, check rotors, test calipers, and inspect lines/fluid.',
  'Front pads often $150–$300. Rotors can add $200–$400 depending on vehicle.'),

('fluid_leak', 'Fluid Leaking',
  'Different fluids mean different problems; identifying the fluid is step one.',
  'Oil leaks can be okay short-term. Brake/coolant issues can be unsafe—don''t drive.',
  'We identify the fluid, check levels, inspect hoses/gaskets/seals, and confirm source.',
  'Small leaks often $200–$400. Larger leaks can be $400–$800+ depending on access.'),

('no_start_no_crank', 'Won''t Start',
  'Often electrical: battery, terminals/grounds, starter circuit, or security system.',
  'Safe parked. Don''t keep trying—repeated attempts can drain the battery.',
  'We check battery health/voltage, connections, starter signal, and scan if needed.',
  'Diagnosis often $50–$100. Battery $100–$200. Starter commonly $300–$600.'),

('strange_noise', 'Strange Noise',
  'Noises can come from brakes, suspension, engine, bearings, belts, or exhaust.',
  'If it shakes hard or feels unsafe—stop driving.',
  'We reproduce the noise (when possible) and inspect the most likely systems first.',
  'Diagnosis often $50–$100. Repairs range widely from $100 to $1,000+.'),

('warning_light', 'Check Engine Light',
  'The vehicle stored a diagnostic trouble code pointing to a system to inspect.',
  'Solid light = often safe short distances. FLASHING = pull over safely.',
  'We scan codes, review freeze frame, do quick verification checks, then advise.',
  'Code scanning often $50–$100. Common fixes vary widely (e.g., sensors $200–$400).')
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
('battery_issue', 'how_old_battery', 'How old is your battery?', 'single_choice',
  '["Less than 2 years","2-4 years","4+ years","Don''t know"]'::jsonb, false, true, 1),
('battery_issue', 'jump_start_needed', 'Have you needed a jump start recently?', 'yes_no',
  NULL, false, true, 2),
('battery_issue', 'lights_dim', 'Do your headlights or interior lights dim?', 'yes_no',
  NULL, false, false, 3),

('brake_issue', 'brake_noise_type', 'What kind of noise do you hear?', 'single_choice',
  '["Squealing","Grinding","Clicking","No noise"]'::jsonb, true, true, 1),
('brake_issue', 'pedal_feel', 'How does the brake pedal feel?', 'single_choice',
  '["Normal","Soft/spongy","Hard/stiff","Goes to floor"]'::jsonb, true, true, 2),
('brake_issue', 'vibration', 'Do you feel vibration when braking?', 'yes_no',
  NULL, false, true, 3),

('fluid_leak', 'fluid_color', 'What color is the fluid?', 'single_choice',
  '["Clear/water","Brown/black (oil)","Green/orange (coolant)","Red (transmission)","Yellow/brown (brake)"]'::jsonb, true, true, 1),
('fluid_leak', 'leak_size', 'How much fluid is leaking?', 'single_choice',
  '["Few drops","Small puddle","Large puddle","Constant drip"]'::jsonb, true, true, 2),

('no_start_no_crank', 'what_happens', 'What happens when you turn the key?', 'single_choice',
  '["Nothing at all","Clicking sound","Lights dim","Accessories work"]'::jsonb, false, true, 1),
('no_start_no_crank', 'battery_age', 'How old is your battery?', 'single_choice',
  '["Less than 2 years","2-4 years","4+ years","Don''t know"]'::jsonb, false, true, 2),

('strange_noise', 'when_noise', 'When do you hear the noise?', 'multi_choice',
  '["While driving","When turning","When braking","Over bumps","At idle"]'::jsonb, false, true, 1),
('strange_noise', 'noise_type', 'What does it sound like?', 'single_choice',
  '["Squealing","Grinding","Clunking","Rattling","Ticking"]'::jsonb, false, true, 2),

('warning_light', 'light_color', 'What color is the warning light?', 'single_choice',
  '["Yellow/orange","Red","Blue","Don''t know"]'::jsonb, true, false, 1),
('warning_light', 'light_behavior', 'Is the light solid or flashing?', 'single_choice',
  '["Solid/steady","Flashing","Comes and goes"]'::jsonb, true, true, 2),

('basic_maintenance', 'service_type', 'What service do you need?', 'multi_choice',
  '["Oil change","Air filter","Cabin filter","Tire rotation","Other"]'::jsonb, false, true, 1),
('basic_maintenance', 'last_service', 'When was your last service?', 'single_choice',
  '["Less than 3 months","3-6 months","6-12 months","Over a year"]'::jsonb, false, false, 2)
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
ON CONFLICT (key) DO UPDATE SET
  bucket = EXCLUDED.bucket,
  path = EXCLUDED.path,
  public_url = EXCLUDED.public_url,
  content_type = EXCLUDED.content_type;

COMMIT;
