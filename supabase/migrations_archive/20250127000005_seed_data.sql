-- =====================================================
-- SEED DATA: Lookup tables and defaults
-- =====================================================
-- Purpose: Idempotent seed data for reset safety
-- Safe for: supabase db reset (uses ON CONFLICT DO NOTHING)

-- 1) SKILLS

INSERT INTO public.skills ("key", label, category, created_at)
VALUES
  ('brakes', 'Brakes', 'repair', NOW()),
  ('oil_change', 'Oil Change', 'maintenance', NOW()),
  ('battery', 'Battery', 'repair', NOW()),
  ('diagnostics', 'Diagnostics', 'diagnostics', NOW()),
  ('suspension', 'Suspension', 'repair', NOW()),
  ('engine', 'Engine', 'repair', NOW()),
  ('electrical', 'Electrical', 'repair', NOW()),
  ('cooling', 'Cooling System', 'repair', NOW()),
  ('transmission', 'Transmission', 'repair', NOW())
ON CONFLICT ("key") DO NOTHING;

-- 2) TOOLS

INSERT INTO public.tools ("key", label, category, created_at) VALUES
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
ON CONFLICT ("key") DO NOTHING;

-- 3) SAFETY_MEASURES

INSERT INTO public.safety_measures ("key", label, created_at) VALUES
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
ON CONFLICT ("key") DO NOTHING;

-- 4) SYMPTOMS (CUSTOMER-FRIENDLY)

INSERT INTO public.symptoms ("key", label, icon) VALUES
  ('basic_maintenance', 'Routine Maintenance', '🔧'),
  ('battery_issue', 'Battery Problems', '🔋'),
  ('brake_issue', 'Brake Problems', '🛑'),
  ('fluid_leak', 'Fluid Leak', '💧'),
  ('no_start_no_crank', 'Won''t Start', '🚨'),
  ('strange_noise', 'Strange Noise', '🔊'),
  ('warning_light', 'Warning Light', '⚠️'),
  -- Electrical symptoms
  ('elec_no_crank_no_click', 'No Crank No Click', '🔌'),
  ('elec_starter_clicking', 'Starter Clicking', '🔌'),
  ('elec_alternator_not_charging', 'Alternator Not Charging', '🔌'),
  ('elec_parasitic_drain', 'Battery Drains When Parked', '🔋'),
  ('elec_abs_light_on', 'ABS Light On', '⚠️'),
  -- Cooling symptoms
  ('cool_overheating', 'Overheating', '🌡️'),
  ('cool_coolant_leak', 'Coolant Leak', '💧'),
  ('cool_radiator_fan_not_working', 'Radiator Fan Not Working', '🌡️'),
  ('cool_thermostat_stuck', 'Thermostat Stuck', '🌡️'),
  ('cool_water_pump_failure', 'Water Pump Failure', '💧')
ON CONFLICT ("key") DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon;

-- 5) SYMPTOM_MAPPINGS (COMPREHENSIVE - PLAIN ENGLISH)

INSERT INTO public.symptom_mappings
(symptom_key, symptom_label, category, required_skill_keys, suggested_tool_keys, required_safety_keys, quote_strategy, risk_level, customer_explainer, mechanic_notes, created_at, updated_at, id)
VALUES
-- Basic Maintenance
('basic_maintenance', 'Basic Maintenance', 'Maintenance', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'fixed_simple', 'low',
'Routine service like oil change, filters, wipers, or scheduled maintenance.', null, NOW(), NOW(), 'a3e269b7-fa5d-4a80-9306-0da94ae2b0cd'),

-- Battery & Electrical
('battery_issue', 'Battery Issue', 'Electrical & Charging', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'inspection_required', 'medium',
'Slow crank, clicking, dead battery, or needing frequent jump-starts.', null, NOW(), NOW(), '60301166-9543-4190-9663-64ea9a275b0a'),

('elec_no_crank_no_click', 'No crank, no click, no sound', 'Electrical & Charging', ARRAY['electrical_troubleshooting']::text[], ARRAY['multimeter','scan_tool']::text[], ARRAY['battery_safety','hazard_positioning']::text[], 'diagnostic_only', 'medium',
'No sound at all usually means no power to the starter. This can be a dead battery, bad connection, ignition switch, or security system issue.',
'Check battery voltage first. Test ignition switch, neutral safety switch, clutch switch. Check starter relay and fuses. Scan for security system codes.', NOW(), NOW(), '3365f556-a90c-485a-953b-3a5e5d389d7a'),

('elec_starter_clicking', 'Starter clicks but won''t crank', 'Electrical & Charging', ARRAY['electrical_troubleshooting']::text[], ARRAY['multimeter','jump_pack','battery_tester']::text[], ARRAY['battery_safety','hazard_positioning']::text[], 'diagnostic_only', 'medium',
'Clicking usually means low battery voltage or a failing starter. We''ll test the battery and starter circuit to determine which needs replacement.',
'Test battery voltage under load. Check starter connections and ground. Tap starter with hammer while cranking to test for stuck solenoid. May need starter replacement.', NOW(), NOW(), 'fba4161a-6ef2-4241-8538-1cc1074c9379'),

('elec_alternator_not_charging', 'Alternator not charging / battery light on', 'Electrical & Charging', ARRAY['battery_charging_system','electrical_troubleshooting']::text[], ARRAY['multimeter','battery_tester']::text[], ARRAY['battery_safety']::text[], 'diagnostic_only', 'medium',
'If the alternator isn''t charging, the battery will drain and the car will stall. We''ll test the charging system to confirm the alternator, battery, or wiring.',
'Test battery voltage at idle and 2000 RPM. Should see 13.8-14.4V charging. Check belt tension and alternator connections. Scan for charging system codes.', NOW(), NOW(), '4f7c69ac-9141-4696-b142-391f107680f7'),

('elec_parasitic_drain', 'Battery drains when parked', 'Electrical & Charging', ARRAY['electrical_troubleshooting']::text[], ARRAY['multimeter','battery_tester']::text[], ARRAY['battery_safety']::text[], 'diagnostic_only', 'low',
'A parasitic drain means something is drawing power when the car is off. We''ll test the battery and use a multimeter to find the circuit causing the drain.',
'Test battery health first. Measure draw with multimeter (should be under 50mA). Pull fuses one by one to isolate circuit. Common: interior lights, radio, alarm, modules not sleeping.', NOW(), NOW(), '1e5e92f4-e125-4085-aafc-42a71d473dd2'),

-- Brakes
('brake_issue', 'Brake Issue', 'Brakes', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'inspection_required', 'high',
'Braking feels unsafe: squealing/grinding, vibration, soft pedal, or reduced stopping power.', null, NOW(), NOW(), '1920edec-4f19-460e-8c08-7fe3c3587d24'),

('elec_abs_light_on', 'ABS warning light on', 'Electrical & Charging', ARRAY['electrical_troubleshooting','brake_service']::text[], ARRAY['scan_tool']::text[], ARRAY['brake_safety']::text[], 'diagnostic_only', 'medium',
'An ABS light indicates a fault in the anti-lock brake system. This can be a wheel speed sensor, module, or wiring issue. We''ll scan codes to diagnose.',
'Scan for ABS codes. Common: wheel speed sensors, tone rings, wiring damage. Test sensor resistance and signals. May need sensor or module.', NOW(), NOW(), '10ec70fc-b906-460f-9aa2-2efe56534164'),

-- Cooling System
('cool_overheating', 'Engine overheating', 'Cooling System', ARRAY['cooling_systems']::text[], ARRAY['scan_tool','infrared_thermometer','pressure_tester']::text[], ARRAY['chemical_safety','do_not_drive']::text[], 'diagnostic_only', 'high',
'Overheating can cause severe engine damage. Common causes are low coolant, thermostat failure, radiator issues, or water pump failure. We''ll diagnose the cooling system.',
'Check coolant level and condition. Pressure test system for leaks. Test thermostat operation. Check radiator flow and fan operation. Scan for temp sensor codes.', NOW(), NOW(), '29da9f27-f56b-4655-813c-ad10cabf54a7'),

('cool_coolant_leak', 'Coolant leak', 'Cooling System', ARRAY['cooling_systems']::text[], ARRAY['pressure_tester','uv_dye_kit']::text[], ARRAY['chemical_safety']::text[], 'inspection_required', 'medium',
'Coolant leaks can come from hoses, radiator, water pump, or head gasket. We''ll pressure test the system to locate the leak.',
'Pressure test cooling system. Use UV dye if needed. Check hoses, radiator, water pump, heater core, head gasket. Note coolant color and level.', NOW(), NOW(), '7b559988-1519-48dc-bbe0-2114d467fdf6'),

('cool_radiator_fan_not_working', 'Radiator fan not running', 'Cooling System', ARRAY['cooling_systems','electrical_troubleshooting']::text[], ARRAY['multimeter','scan_tool']::text[], ARRAY['fan_safety']::text[], 'diagnostic_only', 'medium',
'If the radiator fan doesn''t run, the engine will overheat in traffic or at idle. This can be the fan motor, relay, fuse, or temperature sensor.',
'Test fan motor directly. Check fan relay and fuse. Scan for temp sensor codes. Test coolant temp sensor. May need fan motor or relay.', NOW(), NOW(), '40c89169-94d4-4e68-b56d-7f88d86f7f65'),

('cool_thermostat_stuck', 'Thermostat stuck open or closed', 'Cooling System', ARRAY['cooling_systems']::text[], ARRAY['scan_tool','infrared_thermometer']::text[], ARRAY['chemical_safety']::text[], 'diagnostic_only', 'medium',
'A stuck thermostat causes overheating (stuck closed) or slow warm-up and poor heat (stuck open). We''ll test the thermostat operation.',
'Check engine temp with scan tool. Feel upper and lower radiator hoses. Stuck closed = overheating; stuck open = slow warm-up. Replace thermostat.', NOW(), NOW(), '8dace4d3-b2a1-4894-88ee-3afeda8425fa'),

('cool_water_pump_failure', 'Water pump leaking or failing', 'Cooling System', ARRAY['cooling_systems']::text[], ARRAY['pressure_tester']::text[], ARRAY['chemical_safety']::text[], 'inspection_required', 'high',
'A failing water pump can leak coolant or cause overheating. We''ll inspect the pump for leaks and bearing noise.',
'Check for coolant leak at weep hole. Listen for bearing noise or grinding. Check for play in pulley. May need timing belt replacement if internal pump.', NOW(), NOW(), 'a0e70bd9-bf9e-4596-a556-1a4d7ecffc8b'),

-- Fluid Leaks
('fluid_leak', 'Fluid Leak', 'Engine', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'inspection_required', 'medium',
'Visible fluid under the vehicle or low fluid warnings (oil, coolant, brake, power steering, etc.).', null, NOW(), NOW(), 'c3f167af-8f20-403d-b7bb-6e0d85bb8478'),

-- Strange Noises
('strange_noise', 'Strange Noise', 'Other', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'inspection_required', 'medium',
'Unusual sound like squeal, rattle, clunk, grinding, or ticking.', null, NOW(), NOW(), 'e92fc47a-cd82-43d0-bc60-82ae69f4b789'),

-- Warning Lights
('warning_light', 'Check Engine Light On', 'Engine', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'diagnosis-first', 'medium',
'Dashboard warning light (engine symbol) is illuminated', null, NOW(), NOW(), '0f0df57f-b619-4fe0-9429-0870e1072034'),

-- No Start
('no_start_no_crank', 'No Start / No Crank', 'Electrical', ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], 'diagnostic_only', 'high',
'Turning the key/push-start does nothing or only clicks; engine does not crank.', null, NOW(), NOW(), '6308a4e2-2930-43e5-b559-70128ed4d7ce')

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

-- 6) EDUCATION_CARDS (DETAILED GUIDES)

INSERT INTO public.education_cards
(symptom_key, card_key, title, summary, why_it_happens, what_we_check, is_it_safe, prep_before_visit, quote_expectation, red_flags, order_index, id)
VALUES
(
  'basic_maintenance',
  'core',
  'Routine maintenance',
  'We''ll confirm the right fluids and parts for your exact vehicle and keep it simple.',
  'Different engines and trims require specific oil types and filters.',
  'Verify vehicle details, inspect fluids/filters, perform requested service.',
  'Safe—this is preventative.',
  'If you know your last service date/mileage, share it. Park on level surface.',
  'Usually fixed-price services (clear quote up front).',
  'If warning lights are on or fluid levels are dangerously low, we''ll advise next steps.',
  1,
  '773ed4c3-c8ea-4f7d-aa0b-e9c0ea24992b'
),
(
  'battery_issue',
  'core',
  'Battery keeps dying / hard starts',
  'We''ll test the battery and charging system so you don''t replace the wrong part.',
  'Old battery, alternator output, parasitic draw, or loose connections are common causes.',
  'Battery test, alternator test, terminal inspection, quick draw checks if needed.',
  'Usually safe short trips, but you might get stranded—best handled soon.',
  'If you know battery age, share it. Mention any recent jump starts.',
  'Sometimes fixed-price (battery) after testing confirms it''s needed.',
  'Battery hot/swollen or rotten-egg smell—keep distance and call for help.',
  1,
  'e57965cf-7ca6-4a36-90ab-0fc88b78ec42'
),
(
  'brake_issue',
  'core',
  'Brakes feel soft/noisy/unsafe',
  'Brakes are safety-critical. We''ll inspect before quoting so we don''t guess wrong.',
  'Worn pads/rotors, seized calipers, air in lines, or ABS issues can change feel and stopping distance.',
  'Pad/rotor thickness, caliper movement, fluid level/leaks, road-test checks if safe.',
  'If braking is weak, grinding loudly, or pulling hard—avoid driving.',
  'Tell us the exact feel (soft/hard/noisy) and where the car is parked (flat vs slope).',
  'Often a range quote after inspection (pads only vs pads+rotors vs caliper work).',
  'Pedal to the floor, fluid leak, or metal-on-metal grinding—do not drive.',
  1,
  '677a1e5e-545c-4dc0-8f15-8c9f19d52cb0'
),
(
  'fluid_leak',
  'core',
  'Fluid leaking under the car',
  'The color and location help a lot. A quick look prevents misquoting and unsafe driving.',
  'Oil, coolant, brake fluid, or power steering leaks can look similar but carry different risks.',
  'Identify fluid type, check levels, inspect hoses/lines, pressure test if needed.',
  'If it''s brake fluid or overheating coolant—do not drive.',
  'Snap a photo of the puddle and where it''s coming from. Note color/smell if you can.',
  'Usually inspection-first, then a clear repair price once confirmed.',
  'Rapid leak, overheating, or warning lights—stop and park safely.',
  1,
  '07452945-6306-42a3-8c56-33d2e50820ae'
),
(
  'no_start_no_crank',
  'core',
  'Car won''t start (no cranking)',
  'This is often a battery, connection, or starter-circuit issue. We''ll confirm the cause before any repair.',
  'Weak battery, loose terminals, starter relay/signal, or security/neutral-safety systems can prevent cranking.',
  'Battery voltage, terminal condition, starter signal, basic scan when applicable.',
  'Safe to stay parked. Avoid repeated start attempts.',
  'Have keys ready, pop the hood if safe, tell us what you heard (clicking/no sound).',
  'Usually starts with a diagnostic. Repair price depends on what we find.',
  'Burning smell, smoke, or hot battery cables—keep distance and wait for help.',
  1,
  'cf98be95-d43e-4520-9ba6-cb1774af4654'
),
(
  'strange_noise',
  'core',
  'Strange noise while driving',
  'Noises can come from different systems. We''ll narrow it down quickly with a focused check.',
  'Brakes, suspension, bearings, belts, or exhaust can all sound similar.',
  'When/where noise happens + quick inspection + test drive only if safe.',
  'If the car shakes hard or steering feels unsafe—avoid driving.',
  'Record a short video/audio and note when it happens (turning/braking/bumps).',
  'Often inspection-required or diagnostic-first to avoid guessing.',
  'Loud clunk + loss of control feel, or grinding that increases fast—stop driving.',
  1,
  '6d2b7f9d-2c7c-48b4-bd2c-639a070f55fc'
),
(
  'warning_light',
  'core',
  'Dashboard warning light',
  'A warning light means the car stored a code. We''ll scan it and explain what it means in plain English.',
  'A sensor or system detected something out of range—some are urgent, many are not.',
  'Code scan + quick checks to confirm if it''s urgent or monitor-only.',
  'Depends on color: Red = stop soon. Yellow = usually okay short-term.',
  'Take a clear photo of the light and note any changes in driving.',
  'Best handled as diagnostic-first. Some fixes can be priced after scan.',
  'Flashing check-engine light, overheating, or sudden loss of power—pull over safely.',
  1,
  '9266e25c-b472-4aff-bcc2-343f6fc5ad44'
)
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

-- 7) SYMPTOM_EDUCATION (GUIDES TAB CONTENT)

INSERT INTO public.symptom_education
(symptom_key, title, summary, is_it_safe, what_we_check, how_quotes_work)
VALUES
(
  'basic_maintenance',
  'Routine Maintenance',
  'Regular service keeps your car running smoothly and prevents bigger problems down the road.',
  'Completely safe. This is preventative care, not a repair.',
  'We verify your vehicle details, check fluid levels and condition, inspect filters and belts, and perform the requested service according to manufacturer specs.',
  'Most maintenance services have fixed prices. Oil changes typically cost $40-$80. Air filter replacement is $20-$40. We''ll give you an exact quote before starting any work.'
),
(
  'battery_issue',
  'Battery Problems',
  'If your car is slow to start or won''t start at all, it''s usually the battery or charging system.',
  'Usually safe for short trips, but you risk getting stranded. Best to address it soon. If the battery is hot, swollen, or smells like rotten eggs, don''t touch it and call for help.',
  'We test battery voltage and health, check the alternator charging output, inspect terminals for corrosion, and measure for parasitic drain if the battery keeps dying overnight.',
  'Battery testing is usually free or $20-$30. A new battery costs $100-$200 installed. If it''s the alternator, expect $300-$600. We''ll test first so you don''t replace the wrong part.'
),
(
  'brake_issue',
  'Brake Problems',
  'Brakes are your most important safety system. Any change in feel, sound, or stopping power needs immediate attention.',
  'If brakes are grinding metal-on-metal, the pedal goes to the floor, or you have a fluid leak, DO NOT DRIVE. For squealing or soft pedal, drive carefully and get help within a day or two.',
  'We measure brake pad thickness (should be 3mm+), check rotor surface condition, test caliper operation, inspect brake lines for leaks, and road-test if safe.',
  'Front brake pads cost $150-$300 installed. Rear brakes are similar. If rotors need replacing, add $200-$400. Calipers are $300-$500 per wheel. We''ll inspect first and give you options.'
),
(
  'fluid_leak',
  'Fluid Leaking',
  'Different fluids mean different problems. Color and location help us diagnose quickly.',
  'Depends on the fluid. Oil leaks are usually safe short-term. Brake fluid or coolant leaks mean DO NOT DRIVE. If you see a puddle and warning lights, stop immediately.',
  'We identify the fluid type by color and smell, check fluid levels, inspect hoses and gaskets, and pressure-test the system if needed to find the exact source.',
  'Small leaks like valve cover gaskets cost $200-$400. Larger leaks like oil pans or radiators are $400-$800. We''ll inspect first and explain what''s urgent versus what can wait.'
),
(
  'no_start_no_crank',
  'Won''t Start',
  'When you turn the key and nothing happens, it''s usually electrical: battery, connections, or starter circuit.',
  'Safe to stay parked. Don''t keep trying to start it—you might drain the battery or damage the starter. If you smell burning or see smoke, keep your distance.',
  'We test battery voltage, check terminal connections, test the starter signal, scan for security system codes, and check neutral safety switch or clutch switch.',
  'Diagnosis costs $50-$100. If it''s just a loose connection, that''s free. A new battery is $100-$200. Starter replacement is $300-$600. We''ll diagnose first and give you an exact price.'
),
(
  'strange_noise',
  'Strange Noise',
  'Noises can come from brakes, suspension, engine, or exhaust. We''ll narrow it down quickly.',
  'If the noise is accompanied by shaking, loss of control, or grinding that gets louder fast, stop driving immediately. For squeaks and rattles, it''s usually safe to drive carefully.',
  'We ask when the noise happens (turning, braking, bumps), listen for the source, inspect the suspected area, and test drive only if it''s safe to do so.',
  'Diagnosis is $50-$100. Repairs range from $100 (loose heat shield) to $1,000+ (suspension components). We''ll identify the source first and explain your options clearly.'
),
(
  'warning_light',
  'Check Engine Light',
  'The check engine light means your car stored a diagnostic code. We''ll scan it and explain what it means in plain English.',
  'Usually safe to drive short distances if the light is solid (not flashing). If it''s FLASHING, pull over immediately—that means serious engine damage is happening right now.',
  'We scan the diagnostic codes, check for obvious issues like a loose gas cap, inspect related sensors and systems, and explain whether it''s urgent or can be monitored.',
  'Code scanning costs $50-$100. Simple fixes like tightening the gas cap are free. Oxygen sensors are $200-$400. Catalytic converters are $1,000-$2,500. We''ll scan first and give you options.'
),
(
  'elec_no_crank_no_click',
  'No Crank, No Click',
  'Complete silence when you turn the key usually means no power is reaching the starter.',
  'Safe to stay parked. This is usually a dead battery, bad connection, or ignition switch issue. Don''t keep trying—you might damage the starter.',
  'We test battery voltage, check all connections and grounds, test the ignition switch, check the neutral safety switch (automatic) or clutch switch (manual), and scan for security system faults.',
  'Diagnosis is $50-$100. Cleaning connections is often free. A new battery is $100-$200. Ignition switch replacement is $200-$400. Starter is $300-$600 if needed.'
),
(
  'elec_starter_clicking',
  'Starter Clicking',
  'Clicking means the starter solenoid is engaging but not getting enough power to crank the engine.',
  'Usually safe to stay parked. This is typically a weak battery or failing starter. Jump-starting might work temporarily, but the problem will return.',
  'We test battery voltage under load, check starter connections and ground, tap the starter with a hammer while cranking to test for a stuck solenoid, and measure voltage drop in the circuit.',
  'Battery testing is free or $20. A new battery is $100-$200. Starter replacement is $300-$600 depending on location. We''ll test first to confirm which part needs replacing.'
),
(
  'elec_alternator_not_charging',
  'Alternator Not Charging',
  'If the alternator isn''t charging, your battery will drain and the car will eventually stall.',
  'You can drive short distances, but the battery will die. If the battery light is on, get help within a few hours. Don''t drive long distances or at night (headlights drain the battery faster).',
  'We test battery voltage at idle and 2000 RPM (should be 13.8-14.4V when charging), check alternator belt tension, inspect connections, and scan for charging system codes.',
  'Alternator replacement costs $300-$600 for most cars. The belt is $50-$100 if needed. We''ll test the charging system first to confirm it''s the alternator and not just a bad connection.'
),
(
  'elec_parasitic_drain',
  'Battery Drains When Parked',
  'If your battery dies overnight, something is drawing power when the car is off.',
  'Safe to drive once jump-started, but you''ll need a jump every time. This won''t damage the car, but it''s annoying and can leave you stranded.',
  'We test battery health first, measure the draw with a multimeter (should be under 50mA), pull fuses one by one to isolate the circuit, and inspect common culprits like interior lights, radio, alarm, or modules not sleeping.',
  'Diagnosis costs $100-$200 because it takes time to isolate the circuit. Repairs range from free (door switch adjustment) to $500+ (module replacement). We''ll find the source first.'
),
(
  'elec_abs_light_on',
  'ABS Light On',
  'The ABS light means the anti-lock brake system detected a fault. Your regular brakes still work, but ABS won''t activate in an emergency.',
  'Safe to drive carefully. Your brakes will work normally, but you won''t have anti-lock protection. Avoid hard braking and get it checked within a few days.',
  'We scan for ABS codes, test wheel speed sensors, inspect tone rings for damage, check wiring for corrosion or breaks, and test the ABS module if needed.',
  'Code scanning is $50-$100. Wheel speed sensors cost $100-$200 each. Tone ring replacement is $200-$400. ABS module replacement is $500-$1,500. We''ll scan first to pinpoint the issue.'
),
(
  'cool_overheating',
  'Engine Overheating',
  'Overheating can cause catastrophic engine damage. Pull over immediately if the temperature gauge is in the red.',
  'DO NOT DRIVE if overheating. Pull over safely, turn off the engine, and wait 30 minutes before opening the hood. Continuing to drive can warp the head or blow the head gasket ($2,000+ repair).',
  'We check coolant level and condition, pressure-test the system for leaks, test thermostat operation, check radiator flow and fan operation, and scan for temperature sensor codes.',
  'Diagnosis is $50-$100. Thermostat replacement is $150-$300. Radiator replacement is $400-$800. Water pump is $300-$600. Head gasket is $1,500-$3,000. We''ll diagnose first to avoid guessing.'
),
(
  'cool_coolant_leak',
  'Coolant Leak',
  'Coolant leaks can come from hoses, radiator, water pump, or head gasket. We''ll find the source.',
  'Small leaks are usually safe for short trips. Large leaks or overheating mean DO NOT DRIVE. If you see steam or the temperature gauge is rising, pull over immediately.',
  'We pressure-test the cooling system, use UV dye if needed to trace the leak, check all hoses and clamps, inspect the radiator and water pump, and test for head gasket leaks.',
  'Hose replacement is $100-$200. Radiator is $400-$800. Water pump is $300-$600. Head gasket is $1,500-$3,000. We''ll pressure-test first to find the exact source.'
),
(
  'cool_radiator_fan_not_working',
  'Radiator Fan Not Running',
  'If the radiator fan doesn''t run, the engine will overheat in traffic or at idle.',
  'Safe to drive on the highway (airflow cools the engine), but avoid stop-and-go traffic. If the temperature gauge starts rising, pull over and let it cool.',
  'We test the fan motor directly, check the fan relay and fuse, scan for temperature sensor codes, test the coolant temperature sensor, and check wiring for damage.',
  'Fan relay is $20-$50. Fan motor replacement is $200-$400. Temperature sensor is $50-$150. Wiring repair is $100-$300. We''ll test the circuit first to find the exact cause.'
),
(
  'cool_thermostat_stuck',
  'Thermostat Stuck',
  'A stuck thermostat causes overheating (stuck closed) or slow warm-up and poor heat (stuck open).',
  'If stuck closed and overheating, DO NOT DRIVE. If stuck open, it''s safe to drive but you''ll have poor heat and reduced fuel economy.',
  'We check engine temperature with a scan tool, feel upper and lower radiator hoses for temperature difference, and confirm thermostat operation. Stuck closed = overheating; stuck open = slow warm-up.',
  'Thermostat replacement costs $150-$300 for most cars. It''s a straightforward repair. We''ll test first to confirm it''s the thermostat and not another cooling system issue.'
),
(
  'cool_water_pump_failure',
  'Water Pump Failing',
  'A failing water pump can leak coolant or cause overheating. It''s a critical component.',
  'If leaking badly or overheating, DO NOT DRIVE. Small leaks are usually safe for short trips, but get it fixed soon to avoid engine damage.',
  'We check for coolant leaks at the weep hole, listen for bearing noise or grinding, check for play in the pulley, and inspect the timing belt if it''s an internal pump.',
  'Water pump replacement costs $300-$600 for most cars. If it''s driven by the timing belt, expect $600-$1,200 (we replace the belt at the same time). We''ll inspect first.'
)
ON CONFLICT (symptom_key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  is_it_safe = EXCLUDED.is_it_safe,
  what_we_check = EXCLUDED.what_we_check,
  how_quotes_work = EXCLUDED.how_quotes_work;

-- 8) SYMPTOM_QUESTIONS (DIAGNOSTIC FLOW)

INSERT INTO public.symptom_questions
(symptom_key, question_key, question_text, question_type, options, affects_safety, affects_quote, display_order)
VALUES
-- Battery Issue Questions
('battery_issue', 'how_old_battery', 'How old is your battery?', 'single_choice', '["Less than 2 years", "2-4 years", "4+ years", "Don''t know"]'::jsonb, false, true, 1),
('battery_issue', 'jump_start_needed', 'Have you needed a jump start recently?', 'yes_no', null, false, true, 2),
('battery_issue', 'lights_dim', 'Do your headlights or interior lights dim?', 'yes_no', null, false, false, 3),
('battery_issue', 'clicking_sound', 'Do you hear clicking when you try to start?', 'yes_no', null, false, true, 4),

-- Brake Issue Questions
('brake_issue', 'brake_noise_type', 'What kind of noise do you hear?', 'single_choice', '["Squealing", "Grinding", "Clicking", "No noise"]'::jsonb, true, true, 1),
('brake_issue', 'pedal_feel', 'How does the brake pedal feel?', 'single_choice', '["Normal", "Soft/spongy", "Hard/stiff", "Goes to floor"]'::jsonb, true, true, 2),
('brake_issue', 'pulling_direction', 'Does the car pull to one side when braking?', 'single_choice', '["No pulling", "Pulls left", "Pulls right"]'::jsonb, true, false, 3),
('brake_issue', 'vibration', 'Do you feel vibration when braking?', 'yes_no', null, false, true, 4),

-- Fluid Leak Questions
('fluid_leak', 'fluid_color', 'What color is the fluid?', 'single_choice', '["Clear/water", "Brown/black (oil)", "Green/orange (coolant)", "Red (transmission)", "Yellow/brown (brake)"]'::jsonb, true, true, 1),
('fluid_leak', 'leak_location', 'Where is the leak coming from?', 'single_choice', '["Front of engine", "Under engine", "Near wheels", "Under transmission", "Don''t know"]'::jsonb, false, true, 2),
('fluid_leak', 'leak_size', 'How much fluid is leaking?', 'single_choice', '["Few drops", "Small puddle", "Large puddle", "Constant drip"]'::jsonb, true, true, 3),
('fluid_leak', 'warning_lights', 'Are any warning lights on?', 'yes_no', null, true, false, 4),

-- No Start Questions
('no_start_no_crank', 'what_happens', 'What happens when you turn the key?', 'single_choice', '["Nothing at all", "Clicking sound", "Lights dim", "Accessories work"]'::jsonb, false, true, 1),
('no_start_no_crank', 'battery_age', 'How old is your battery?', 'single_choice', '["Less than 2 years", "2-4 years", "4+ years", "Don''t know"]'::jsonb, false, true, 2),
('no_start_no_crank', 'recent_issues', 'Have you had starting issues before?', 'yes_no', null, false, false, 3),
('no_start_no_crank', 'security_light', 'Is the security/theft light flashing?', 'yes_no', null, false, true, 4),

-- Strange Noise Questions
('strange_noise', 'when_noise', 'When do you hear the noise?', 'multi_choice', '["While driving", "When turning", "When braking", "Over bumps", "At idle", "When accelerating"]'::jsonb, false, true, 1),
('strange_noise', 'noise_type', 'What does the noise sound like?', 'single_choice', '["Squealing", "Grinding", "Clunking", "Rattling", "Ticking", "Humming"]'::jsonb, false, true, 2),
('strange_noise', 'noise_location', 'Where does the noise come from?', 'single_choice', '["Front", "Rear", "Left side", "Right side", "Under hood", "Don''t know"]'::jsonb, false, false, 3),
('strange_noise', 'getting_worse', 'Is the noise getting worse?', 'yes_no', null, true, false, 4),

-- Warning Light Questions
('warning_light', 'light_color', 'What color is the warning light?', 'single_choice', '["Yellow/orange", "Red", "Blue", "Don''t know"]'::jsonb, true, false, 1),
('warning_light', 'light_behavior', 'Is the light solid or flashing?', 'single_choice', '["Solid/steady", "Flashing", "Comes and goes"]'::jsonb, true, true, 2),
('warning_light', 'which_light', 'Which warning light is on?', 'single_choice', '["Check engine", "Oil pressure", "Battery/charging", "Brake", "ABS", "Airbag", "Other"]'::jsonb, true, true, 3),
('warning_light', 'driving_different', 'Does the car drive differently?', 'yes_no', null, false, true, 4),

-- Electrical: No Crank No Click Questions
('elec_no_crank_no_click', 'dashboard_lights', 'Do dashboard lights come on?', 'yes_no', null, false, true, 1),
('elec_no_crank_no_click', 'accessories_work', 'Do radio/windows/lights work?', 'yes_no', null, false, true, 2),
('elec_no_crank_no_click', 'recent_battery_work', 'Any recent battery or electrical work?', 'yes_no', null, false, false, 3),

-- Electrical: Starter Clicking Questions
('elec_starter_clicking', 'click_speed', 'How fast is the clicking?', 'single_choice', '["Single click", "Rapid clicking", "Slow clicking"]'::jsonb, false, true, 1),
('elec_starter_clicking', 'jump_start_works', 'Does jump-starting help?', 'yes_no', null, false, true, 2),

-- Electrical: Alternator Questions
('elec_alternator_not_charging', 'battery_light_on', 'Is the battery warning light on?', 'yes_no', null, true, false, 1),
('elec_alternator_not_charging', 'electrical_issues', 'Are lights dimming or electronics acting weird?', 'yes_no', null, false, true, 2),
('elec_alternator_not_charging', 'belt_noise', 'Do you hear squealing from the belt?', 'yes_no', null, false, false, 3),

-- Electrical: Parasitic Drain Questions
('elec_parasitic_drain', 'how_long_parked', 'How long before the battery dies?', 'single_choice', '["Overnight", "2-3 days", "A week", "Longer"]'::jsonb, false, true, 1),
('elec_parasitic_drain', 'recent_accessories', 'Any recent accessories installed (radio, alarm, etc.)?', 'yes_no', null, false, true, 2),

-- Electrical: ABS Light Questions
('elec_abs_light_on', 'brake_light_also', 'Is the brake warning light also on?', 'yes_no', null, true, false, 1),
('elec_abs_light_on', 'brakes_feel_normal', 'Do the brakes feel normal?', 'yes_no', null, true, false, 2),

-- Cooling: Overheating Questions
('cool_overheating', 'temp_gauge_reading', 'What does the temperature gauge show?', 'single_choice', '["In red zone", "Near red", "Normal", "No gauge"]'::jsonb, true, true, 1),
('cool_overheating', 'steam_visible', 'Do you see steam from the hood?', 'yes_no', null, true, false, 2),
('cool_overheating', 'coolant_level', 'Is the coolant reservoir full?', 'single_choice', '["Full", "Low", "Empty", "Don''t know"]'::jsonb, true, true, 3),
('cool_overheating', 'when_overheats', 'When does it overheat?', 'single_choice', '["In traffic/idle", "Highway driving", "All the time", "After long drives"]'::jsonb, false, true, 4),

-- Cooling: Coolant Leak Questions
('cool_coolant_leak', 'leak_size', 'How much coolant is leaking?', 'single_choice', '["Few drops", "Small puddle", "Large puddle", "Constant drip"]'::jsonb, true, true, 1),
('cool_coolant_leak', 'coolant_color', 'What color is the coolant?', 'single_choice', '["Green", "Orange", "Pink", "Yellow", "Don''t know"]'::jsonb, false, false, 2),
('cool_coolant_leak', 'overheating_also', 'Is the car also overheating?', 'yes_no', null, true, true, 3),

-- Cooling: Radiator Fan Questions
('cool_radiator_fan_not_working', 'fan_runs_ever', 'Does the fan ever run?', 'single_choice', '["Never runs", "Runs sometimes", "Don''t know"]'::jsonb, false, true, 1),
('cool_radiator_fan_not_working', 'overheating_in_traffic', 'Does it overheat in stop-and-go traffic?', 'yes_no', null, true, true, 2),

-- Cooling: Thermostat Questions
('cool_thermostat_stuck', 'temp_behavior', 'How does the temperature behave?', 'single_choice', '["Overheats quickly", "Never reaches normal", "Fluctuates", "Normal"]'::jsonb, true, true, 1),
('cool_thermostat_stuck', 'heat_works', 'Does the heater blow hot air?', 'yes_no', null, false, false, 2),

-- Cooling: Water Pump Questions
('cool_water_pump_failure', 'noise_from_pump', 'Do you hear grinding or whining from the engine?', 'yes_no', null, false, true, 1),
('cool_water_pump_failure', 'leak_location', 'Where is the coolant leaking from?', 'single_choice', '["Front of engine", "Under engine", "Near timing belt", "Don''t know"]'::jsonb, false, true, 2),

-- Basic Maintenance Questions
('basic_maintenance', 'service_type', 'What service do you need?', 'multi_choice', '["Oil change", "Air filter", "Cabin filter", "Tire rotation", "Fluid top-off", "Other"]'::jsonb, false, true, 1),
('basic_maintenance', 'last_service', 'When was your last service?', 'single_choice', '["Less than 3 months", "3-6 months", "6-12 months", "Over a year", "Don''t know"]'::jsonb, false, false, 2),
('basic_maintenance', 'mileage_since', 'How many miles since last service?', 'single_choice', '["Less than 3,000", "3,000-5,000", "5,000-7,500", "Over 7,500", "Don''t know"]'::jsonb, false, true, 3)

ON CONFLICT (symptom_key, question_key) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  question_type = EXCLUDED.question_type,
  options = EXCLUDED.options,
  affects_safety = EXCLUDED.affects_safety,
  affects_quote = EXCLUDED.affects_quote,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();
