-- =========================================================
-- WrenchGo seed (LOCAL DEV)
-- Matches your current schema:
-- symptoms(key,label,icon)
-- symptom_education(symptom_key,...)
-- symptom_questions(symptom_key, question_key, question_text, question_type, options jsonb,
--                  affects_safety, affects_quote, affects_tools, display_order)
-- =========================================================

-- 1) Clean slate (FK-safe order)
TRUNCATE TABLE
  public.symptom_question_options,
  public.symptom_questions,
  public.symptom_education,
  public.symptoms
RESTART IDENTITY CASCADE;

-- 2) Seed symptoms first
INSERT INTO public.symptoms (key, label, icon) VALUES
('wont_start', 'Won’t start', '🚨'),
('warning_light', 'Warning light', '🔔'),
('brakes_wrong', 'Brakes feel wrong', '🛑'),
('strange_noise', 'Strange noise', '🔊'),
('fluid_leak', 'Fluid leak', '💧'),
('battery_issues', 'Battery issues', '🔋'),
('maintenance', 'Maintenance', '🧰'),
('not_sure', 'Not sure', '❓');

-- 3) Seed education
INSERT INTO public.symptom_education
(symptom_key, title, summary, is_it_safe, what_we_check, how_quotes_work)
VALUES
(
  'wont_start',
  'Car Won’t Start',
  'Most no-start issues are related to the battery, starter, or fuel system. A quick diagnosis can identify the exact cause.',
  'Don’t drive - needs diagnosis first',
  'Battery voltage, starter motor, fuel pump, ignition system',
  'Diagnostic fee first, then repair quote based on findings'
),
(
  'warning_light',
  'Warning Light On',
  'Warning lights indicate your car''s computer detected an issue. Some are urgent, others can wait. We''ll help you understand what it means.',
  'Depends on the light - we’ll assess',
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
  'Depends on fluid type - we’ll assess',
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
  'We’ll assess during diagnosis',
  'Complete vehicle inspection',
  'Diagnostic fee, then detailed findings and quote'
);

-- 4) Guard: ensure symptoms exist before questions
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(req.k, ', ')
    INTO missing
  FROM (VALUES
    ('wont_start'),
    ('warning_light'),
    ('brakes_wrong'),
    ('strange_noise'),
    ('fluid_leak'),
    ('battery_issues'),
    ('maintenance'),
    ('not_sure')
  ) AS req(k)
  WHERE NOT EXISTS (SELECT 1 FROM public.symptoms s WHERE s.key = req.k);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing symptoms before seeding questions: %', missing;
  END IF;
END $$;

-- 5) Seed questions (options stored in jsonb)
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
 false,false,false,10);
