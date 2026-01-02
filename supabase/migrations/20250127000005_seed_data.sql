-- =====================================================
-- SEED DATA: Lookup tables and defaults
-- =====================================================
-- Purpose: Idempotent seed data for reset safety
-- Safe for: supabase db reset (uses ON CONFLICT DO NOTHING)

-- 1) SKILLS

-- =====================================================
-- 1) SKILLS (FIXED: matches actual schema)
-- =====================================================

INSERT INTO public.skills (name, category, description, created_at)
VALUES
  ('Brakes', 'repair', 'Brake inspection, pad and rotor replacement', now()),
  ('Oil Change', 'maintenance', 'Engine oil and filter replacement', now()),
  ('Battery', 'repair', 'Battery testing and replacement', now()),
  ('Diagnostics', 'diagnostics', 'OBD and electrical diagnostics', now()),
  ('Suspension', 'repair', 'Suspension and steering components', now())
ON CONFLICT (name) DO NOTHING;


-- 2) TOOLS

INSERT INTO public.tools (key, label, category, created_at) VALUES
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
ON CONFLICT (key) DO NOTHING;

-- 3) SAFETY_MEASURES

INSERT INTO public.safety_measures (key, label, created_at) VALUES
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
ON CONFLICT (key) DO NOTHING;

-- 4) SYMPTOMS
-- TODO: Paste your full symptoms data here (100 rows)
-- Format: INSERT INTO public.symptoms (key, label, icon) VALUES (...) ON CONFLICT (key) DO NOTHING;

-- 5) SYMPTOM_MAPPINGS
-- TODO: Paste your full symptom_mappings data here
-- Format: INSERT INTO public.symptom_mappings (...) VALUES (...) ON CONFLICT (symptom_key) DO NOTHING;

-- 6) SYMPTOM_QUESTIONS
-- TODO: Paste your full symptom_questions data here
-- Format: INSERT INTO public.symptom_questions (...) VALUES (...) ON CONFLICT (symptom_key, question_key) DO NOTHING;

-- 7) SYMPTOM_REFINEMENTS
-- TODO: Paste your full symptom_refinements data here
-- Format: INSERT INTO public.symptom_refinements (...) VALUES (...) ON CONFLICT (symptom_key, question_key, match_type, match_value) DO NOTHING;

-- 8) EDUCATION_CARDS
-- TODO: Paste your full education_cards data here
-- Format: INSERT INTO public.education_cards (...) VALUES (...) ON CONFLICT (symptom_key, card_key) DO NOTHING;

-- 9) SYMPTOM_EDUCATION (if you have data for this table)
-- TODO: Paste your symptom_education data here if available
-- Format: INSERT INTO public.symptom_education (...) VALUES (...) ON CONFLICT (symptom_key) DO NOTHING;

COMMENT ON TABLE public.skills IS 'Mechanic skill categories - seeded data';
COMMENT ON TABLE public.tools IS 'Required tools for mobile mechanics - seeded data';
COMMENT ON TABLE public.safety_measures IS 'Safety requirements for mobile work - seeded data';
COMMENT ON TABLE public.symptoms IS 'Master symptom list - seeded data';
COMMENT ON TABLE public.symptom_mappings IS 'Symptom metadata - seeded data';
COMMENT ON TABLE public.symptom_questions IS 'Follow-up questions - seeded data';
COMMENT ON TABLE public.symptom_refinements IS 'Symptom refinement rules - seeded data';
COMMENT ON TABLE public.education_cards IS 'Educational content - seeded data';
