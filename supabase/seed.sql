-- =====================================================
-- Supabase seed data
--
-- Goal: minimal-but-useful dataset so the app boots after `supabase db reset`
-- without empty screens (symptoms, skills, hubs, platform terms, etc.).
--
-- You should customize these values (especially hub coordinates + legal text)
-- before production.
-- =====================================================

BEGIN;

-- -----------------------------
-- Platform Terms (required by TermsModal / onboarding)
-- -----------------------------
INSERT INTO public.platform_terms_versions (
  version,
  role,
  title,
  summary,
  full_text,
  is_active,
  published_at
)
VALUES
(
  '2025.01',
  'all',
  'WrenchGo Platform Terms',
  'Basic platform terms (seed). Replace with your real legal text.',
  'This is seed legal text. Replace with your real Terms of Service and Privacy Policy before production.',
  true,
  now()
)
ON CONFLICT (version) DO UPDATE
SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  full_text = EXCLUDED.full_text,
  is_active = EXCLUDED.is_active,
  published_at = EXCLUDED.published_at;

-- -----------------------------
-- Zip Codes (required by service_hubs FK)
-- -----------------------------
INSERT INTO public.zip_codes (zip, lat, lng, city, state)
VALUES
  ('75201', 32.7767, -96.7970, 'Dallas', 'TX')
ON CONFLICT (zip) DO NOTHING;

-- -----------------------------
-- Service Hubs (required by service-area logic)
-- -----------------------------
INSERT INTO public.service_hubs (
  name,
  slug,
  zip,
  lat,
  lng,
  max_radius_miles,
  active_radius_miles,
  invite_only,
  is_active,
  launch_date
)
VALUES
(
  'Default Hub',
  'default-hub',
  '75201',
  32.7767,
  -96.7970,
  100,
  25,
  true,
  true,
  CURRENT_DATE
)
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------
-- Skills / Tools / Safety
-- -----------------------------
INSERT INTO public.skills (key, label, category)
VALUES
  ('oil_change', 'Oil Change', 'maintenance'),
  ('brakes', 'Brakes', 'repair'),
  ('battery', 'Battery', 'electrical'),
  ('diagnostics', 'Diagnostics', 'diagnostics')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.tools (key, label, category)
VALUES
  ('jack', 'Jack', 'equipment'),
  ('scan_tool', 'OBD Scan Tool', 'diagnostics'),
  ('socket_set', 'Socket Set', 'hand_tools')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.safety_measures (key, label)
VALUES
  ('no_private_contact', 'No personal contact until booking'),
  ('photo_evidence', 'Require photo evidence for critical work'),
  ('id_verification', 'Verified mechanic identity')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------
-- Symptoms + mapping (drives customer Explore & request-service UX)
-- -----------------------------
INSERT INTO public.symptoms (key, label, icon)
VALUES
  ('oil_leak', 'Oil leak', 'drop'),
  ('brake_noise', 'Brake noise', 'alert'),
  ('no_start', 'Car won''t start', 'flash'),
  ('check_engine', 'Check engine light', 'warning')
ON CONFLICT (key) DO NOTHING;

-- Basic mapping so Explore returns content
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
  'brake_noise',
  'brakes',
  'high',
  'inspect_then_quote',
  'Brake noises can indicate worn pads/rotors. Avoid driving if braking feels unsafe.',
  'Inspect pads, rotors, calipers; document wear and confirm with road test if safe.',
  ARRAY['brakes'],
  ARRAY['jack', 'socket_set'],
  ARRAY['photo_evidence']
),
(
  'no_start',
  'electrical',
  'high',
  'diagnose_first',
  'A no-start can be battery, starter, or fuel/ignition. A mechanic will diagnose on-site.',
  'Test battery/alternator, check starter signal, scan for codes where possible.',
  ARRAY['battery','diagnostics'],
  ARRAY['scan_tool'],
  ARRAY['no_private_contact']
),
(
  'check_engine',
  'diagnostics',
  'medium',
  'scan_then_quote',
  'A check engine light usually requires a scan to identify the cause.',
  'Scan codes, record freeze-frame, propose next steps. Document before clearing codes.',
  ARRAY['diagnostics'],
  ARRAY['scan_tool'],
  ARRAY['photo_evidence']
)
ON CONFLICT (symptom_key) DO NOTHING;

COMMIT;
