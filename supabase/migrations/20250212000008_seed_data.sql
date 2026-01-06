-- =====================================================
-- MIGRATION 8: SEED DATA
-- =====================================================
-- Purpose: Insert initial symptom data for the app
-- =====================================================

BEGIN;

-- =====================================================
-- SEED: symptoms (master list with icons)
-- =====================================================
INSERT INTO public.symptoms (key, label, icon) VALUES
  ('engine_noise', 'Engine Noise', '🔊'),
  ('check_engine_light', 'Check Engine Light', '⚠️'),
  ('brake_issues', 'Brake Issues', '🛑'),
  ('battery_dead', 'Dead Battery', '🔋'),
  ('flat_tire', 'Flat Tire', '🛞'),
  ('overheating', 'Overheating', '🌡️'),
  ('transmission_slip', 'Transmission Slipping', '⚙️'),
  ('ac_not_working', 'AC Not Working', '❄️'),
  ('oil_leak', 'Oil Leak', '💧'),
  ('smoke_exhaust', 'Smoke from Exhaust', '💨'),
  ('steering_issues', 'Steering Issues', '🎯'),
  ('suspension_noise', 'Suspension Noise', '🔧'),
  ('electrical_issues', 'Electrical Issues', '⚡'),
  ('fuel_system', 'Fuel System Issues', '⛽'),
  ('windshield_damage', 'Windshield Damage', '🪟')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- SEED: symptom_mappings (detailed symptom info)
-- =====================================================
INSERT INTO public.symptom_mappings (
  symptom_key,
  symptom_label,
  category,
  risk_level,
  quote_strategy,
  customer_explainer,
  required_skill_keys,
  suggested_tool_keys,
  required_safety_keys
) VALUES
  (
    'engine_noise',
    'Engine Making Strange Noises',
    'Engine',
    'high',
    'diagnostic_first',
    'Unusual engine noises can indicate serious mechanical issues. A mechanic will need to diagnose the specific cause.',
    ARRAY['engine_diagnostics', 'engine_repair'],
    ARRAY['diagnostic_scanner', 'socket_set'],
    ARRAY['eye_protection', 'gloves']
  ),
  (
    'check_engine_light',
    'Check Engine Light On',
    'Engine',
    'medium',
    'diagnostic_first',
    'The check engine light indicates a potential issue detected by your vehicle''s computer. Requires diagnostic scan.',
    ARRAY['engine_diagnostics'],
    ARRAY['diagnostic_scanner'],
    ARRAY['eye_protection']
  ),
  (
    'brake_issues',
    'Brake Problems',
    'Brakes',
    'high',
    'fixed_price',
    'Brake issues are safety-critical and should be addressed immediately.',
    ARRAY['brake_repair'],
    ARRAY['brake_tools', 'jack_stands'],
    ARRAY['eye_protection', 'gloves', 'jack_safety']
  ),
  (
    'battery_dead',
    'Dead or Weak Battery',
    'Electrical',
    'medium',
    'fixed_price',
    'A dead battery may need jump-starting or replacement.',
    ARRAY['electrical_systems'],
    ARRAY['multimeter', 'battery_charger'],
    ARRAY['gloves', 'eye_protection']
  ),
  (
    'flat_tire',
    'Flat or Damaged Tire',
    'Tires',
    'medium',
    'fixed_price',
    'Flat tires can be repaired or replaced depending on the damage.',
    ARRAY['tire_service'],
    ARRAY['tire_iron', 'jack'],
    ARRAY['jack_safety', 'gloves']
  ),
  (
    'overheating',
    'Engine Overheating',
    'Cooling System',
    'high',
    'diagnostic_first',
    'Engine overheating can cause serious damage. Requires immediate attention.',
    ARRAY['cooling_system'],
    ARRAY['pressure_tester', 'coolant_tools'],
    ARRAY['eye_protection', 'gloves', 'burn_protection']
  ),
  (
    'transmission_slip',
    'Transmission Slipping or Jerking',
    'Transmission',
    'high',
    'diagnostic_first',
    'Transmission issues require specialized diagnosis and repair.',
    ARRAY['transmission_repair'],
    ARRAY['diagnostic_scanner', 'transmission_tools'],
    ARRAY['eye_protection', 'gloves']
  ),
  (
    'ac_not_working',
    'Air Conditioning Not Working',
    'HVAC',
    'low',
    'diagnostic_first',
    'AC issues can range from simple refrigerant recharge to compressor replacement.',
    ARRAY['hvac_systems'],
    ARRAY['ac_gauges', 'refrigerant_tools'],
    ARRAY['eye_protection', 'gloves']
  ),
  (
    'oil_leak',
    'Oil Leak',
    'Engine',
    'medium',
    'diagnostic_first',
    'Oil leaks should be identified and repaired to prevent engine damage.',
    ARRAY['engine_repair'],
    ARRAY['socket_set', 'torque_wrench'],
    ARRAY['eye_protection', 'gloves']
  ),
  (
    'smoke_exhaust',
    'Smoke Coming from Exhaust',
    'Exhaust',
    'high',
    'diagnostic_first',
    'Exhaust smoke color indicates different issues. Requires diagnosis.',
    ARRAY['engine_diagnostics', 'exhaust_systems'],
    ARRAY['diagnostic_scanner'],
    ARRAY['eye_protection', 'gloves']
  ),
  (
    'steering_issues',
    'Steering Problems',
    'Steering',
    'high',
    'diagnostic_first',
    'Steering issues are safety-critical and require immediate attention.',
    ARRAY['steering_suspension'],
    ARRAY['alignment_tools', 'power_steering_tools'],
    ARRAY['eye_protection', 'gloves', 'jack_safety']
  ),
  (
    'suspension_noise',
    'Suspension Making Noise',
    'Suspension',
    'medium',
    'diagnostic_first',
    'Suspension noises can indicate worn components that need replacement.',
    ARRAY['steering_suspension'],
    ARRAY['socket_set', 'jack_stands'],
    ARRAY['eye_protection', 'gloves', 'jack_safety']
  ),
  (
    'electrical_issues',
    'Electrical System Problems',
    'Electrical',
    'medium',
    'diagnostic_first',
    'Electrical issues require systematic diagnosis to identify the root cause.',
    ARRAY['electrical_systems'],
    ARRAY['multimeter', 'diagnostic_scanner'],
    ARRAY['eye_protection', 'gloves']
  ),
  (
    'fuel_system',
    'Fuel System Issues',
    'Fuel System',
    'medium',
    'diagnostic_first',
    'Fuel system problems can affect engine performance and efficiency.',
    ARRAY['fuel_systems'],
    ARRAY['fuel_pressure_gauge', 'diagnostic_scanner'],
    ARRAY['eye_protection', 'gloves', 'fire_safety']
  ),
  (
    'windshield_damage',
    'Windshield Crack or Chip',
    'Glass',
    'low',
    'fixed_price',
    'Small chips can often be repaired, larger cracks may require replacement.',
    ARRAY['glass_repair'],
    ARRAY['windshield_repair_kit'],
    ARRAY['eye_protection', 'gloves']
  )
ON CONFLICT (symptom_key) DO NOTHING;

-- =====================================================
-- SEED: media_assets (for uploaded media files)
-- =====================================================
INSERT INTO public.media_assets (key, bucket, path, public_url, content_type) VALUES
  ('logo_video', 'media', 'logovideo.mp4', 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/logovideo.mp4', 'video/mp4'),
  ('wrenchgo_ad_1', 'media', 'wrenchGoAd.mp4', 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/wrenchGoAd.mp4', 'video/mp4'),
  ('wrenchgo_ad_2', 'media', 'wrenchGoAd2.mp4', 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/wrenchGoAd2.mp4', 'video/mp4'),
  ('wrenchgo_ad_3', 'media', 'wrenchGoAd3.mp4', 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/media/wrenchGoAd3.mp4', 'video/mp4')
ON CONFLICT (key) DO NOTHING;

COMMIT;
