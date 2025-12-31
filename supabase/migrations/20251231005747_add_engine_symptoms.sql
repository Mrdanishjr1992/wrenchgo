-- Migration: Add Engine and Engine Performance symptoms
-- Created: 2024
-- Description: Adds comprehensive engine-related symptoms to symptom_mappings table

-- Engine Performance Issues (High Priority)
INSERT INTO public.symptom_mappings (
  symptom_key,
  symptom_label,
  category,
  risk_level,
  quote_strategy,
  customer_explainer
) VALUES
  (
    'engine_misfire',
    'Engine Misfiring',
    'Engine',
    'high',
    'diagnosis-first',
    'Engine is running rough, shaking, or has a noticeable vibration'
  ),
  (
    'engine_overheating',
    'Engine Overheating',
    'Engine',
    'high',
    'diagnosis-first',
    'Temperature gauge is in the red zone or steam coming from hood'
  ),
  (
    'engine_stalling',
    'Engine Stalling',
    'Engine',
    'high',
    'diagnosis-first',
    'Engine shuts off unexpectedly while driving or idling'
  ),
  (
    'loss_of_power',
    'Loss of Power / Acceleration',
    'Engine Performance',
    'high',
    'diagnosis-first',
    'Vehicle feels sluggish, won''t accelerate, or lacks power going uphill'
  ),
  (
    'smoke_from_exhaust',
    'Smoke from Exhaust',
    'Engine',
    'high',
    'diagnosis-first',
    'Visible smoke (white, blue, or black) coming from tailpipe'
  ),
  (
    'engine_knocking',
    'Engine Knocking / Pinging',
    'Engine',
    'high',
    'diagnosis-first',
    'Metallic knocking or pinging sound from engine, especially under acceleration'
  );

-- Engine Issues (Medium Priority)
INSERT INTO public.symptom_mappings (
  symptom_key,
  symptom_label,
  category,
  risk_level,
  quote_strategy,
  customer_explainer
) VALUES
  (
    'check_engine_light',
    'Check Engine Light On',
    'Engine',
    'medium',
    'diagnosis-first',
    'Dashboard warning light (engine symbol) is illuminated'
  ),
  (
    'rough_idle',
    'Rough Idle',
    'Engine',
    'medium',
    'diagnosis-first',
    'Engine shakes, vibrates, or runs unevenly when stopped'
  ),
  (
    'hard_to_start',
    'Hard to Start / Won''t Start',
    'Engine',
    'medium',
    'diagnosis-first',
    'Engine cranks but takes multiple attempts to start, or won''t start at all'
  ),
  (
    'poor_fuel_economy',
    'Poor Fuel Economy',
    'Engine Performance',
    'medium',
    'diagnosis-first',
    'Noticeable decrease in miles per gallon'
  ),
  (
    'engine_hesitation',
    'Engine Hesitation / Stumbling',
    'Engine Performance',
    'medium',
    'diagnosis-first',
    'Engine hesitates or stumbles when accelerating'
  ),
  (
    'engine_surging',
    'Engine Surging',
    'Engine Performance',
    'medium',
    'diagnosis-first',
    'Engine RPM fluctuates or surges without pressing gas pedal'
  ),
  (
    'oil_leak',
    'Oil Leak',
    'Engine',
    'medium',
    'diagnosis-first',
    'Oil spots under vehicle or visible oil on engine'
  ),
  (
    'coolant_leak',
    'Coolant Leak',
    'Engine',
    'medium',
    'diagnosis-first',
    'Green, orange, or pink fluid leaking under vehicle'
  );

-- Engine Issues (Low Priority)
INSERT INTO public.symptom_mappings (
  symptom_key,
  symptom_label,
  category,
  risk_level,
  quote_strategy,
  customer_explainer
) VALUES
  (
    'engine_noise_general',
    'Unusual Engine Noise',
    'Engine',
    'low',
    'diagnosis-first',
    'Strange sounds from engine (ticking, rattling, squealing)'
  ),
  (
    'oil_pressure_warning',
    'Oil Pressure Warning Light',
    'Engine',
    'low',
    'diagnosis-first',
    'Oil can or pressure warning light is on'
  ),
  (
    'engine_vibration',
    'Excessive Engine Vibration',
    'Engine',
    'low',
    'diagnosis-first',
    'More vibration than normal felt through steering wheel or seat'
  ),
  (
    'engine_smell',
    'Burning Smell from Engine',
    'Engine',
    'low',
    'diagnosis-first',
    'Unusual burning odor coming from engine bay'
  );

-- Add a comment for tracking
COMMENT ON TABLE public.symptom_mappings IS 'Updated with Engine and Engine Performance symptoms';
