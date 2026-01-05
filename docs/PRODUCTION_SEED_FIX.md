# 🔧 Manual Production Seed Data Fix

## Problem
The production database is missing seed data for:
- `symptoms` (only 8 rows, should be 17)
- `education_cards` (0 rows)
- `symptom_education` (0 rows)

The root cause: `symptom_education` has a foreign key to `symptoms.key`, so we must seed `symptoms` first.

## Solution
Run these SQL statements **in order** in Supabase Studio SQL Editor:

### 1. Seed symptoms (MUST RUN FIRST)

```sql
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
```

### 2. Seed symptom_education

```sql
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
```

### 2. Seed education_cards

```sql
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
```

## Verification

After running all three SQL statements in order, verify:

```sql
SELECT COUNT(*) FROM public.symptoms;            -- Should return 17
SELECT COUNT(*) FROM public.symptom_education;  -- Should return 17
SELECT COUNT(*) FROM public.education_cards;     -- Should return 7
```

## Why This Happened

The migrations were already pushed to production, but the seed data SQL file wasn't executed. This is because:
1. Supabase CLI only runs migration files once (tracked by hash)
2. The seed data was in the same migration file that created the tables
3. The tables were created, but the INSERT statements may have failed silently or weren't executed
4. Foreign key constraints require parent rows (`symptoms`) to exist before child rows (`symptom_education`)

## Prevention

For future seed data updates:
1. Create a new migration file with a new timestamp
2. Use `ON CONFLICT` clauses to make inserts idempotent
3. Test locally first with `supabase db reset`

**Expected Result**: `17 rows inserted/updated`

---

## Step 4: Verify Data

Run this query to verify:

```sql
SELECT 
  (SELECT COUNT(*) FROM education_cards) as education_cards_count,
  (SELECT COUNT(*) FROM symptom_education) as symptom_education_count,
  (SELECT COUNT(*) FROM symptoms) as symptoms_count;
```

**Expected Result**:
```
education_cards_count: 7
symptom_education_count: 17
symptoms_count: 8 (or more)
```

---

## Step 5: Reload App

After inserting the data:

1. Go back to your app
2. Press `r` in the Expo terminal (Terminal 10) to reload
3. Check the logs for:
   ```
   LOG  Education cards loaded: 7
   LOG  Symptom education loaded: 17
   ```

---

## Alternative: Use Supabase CLI (if SQL Editor doesn't work)

If you prefer CLI, save the SQL to a file and run:

```bash
# Save SQL to temp file
$sql = @"
-- paste SQL here
"@
$sql | Out-File -FilePath temp_seed.sql -Encoding UTF8

# Run against production
npx supabase db execute --file temp_seed.sql --linked

# Clean up
Remove-Item temp_seed.sql
```

---

## Why This Happened

The migration file `20250127000005_seed_data.sql` uses `ON CONFLICT DO NOTHING`, which means:
- If data already existed and was deleted, it won't re-insert
- If there were constraint violations, it silently fails
- The migration is marked as "applied" even if no data was inserted
- Foreign key constraints require parent rows (`symptoms`) to exist before child rows (`symptom_education`)

Using `ON CONFLICT DO UPDATE` (as in the SQL above) ensures data is always present.

---

**Last Updated**: 2025-02-04
**Version**: 2.0
