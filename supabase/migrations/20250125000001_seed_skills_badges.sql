-- Seed Data: Skills and Badges for WrenchGo
-- Description: Populate initial skills and badges for the marketplace

-- ============================================================================
-- SEED SKILLS
-- ============================================================================

INSERT INTO public.skills (name, category, description) VALUES
('Brake Repair', 'brakes', 'Brake pad replacement, rotor resurfacing, brake fluid service'),
('Brake System Diagnostics', 'brakes', 'ABS diagnostics, brake line inspection, master cylinder testing'),
('Oil Change', 'maintenance', 'Engine oil and filter replacement'),
('Tire Rotation', 'tires', 'Tire rotation and balancing'),
('Tire Replacement', 'tires', 'Tire mounting, balancing, and installation'),
('Wheel Alignment', 'tires', 'Front and rear wheel alignment'),
('Battery Replacement', 'electrical', 'Battery testing and replacement'),
('Alternator Repair', 'electrical', 'Alternator testing, repair, and replacement'),
('Starter Repair', 'electrical', 'Starter motor diagnostics and replacement'),
('Electrical Diagnostics', 'electrical', 'Wiring diagnostics, fuse testing, electrical troubleshooting'),
('Engine Diagnostics', 'engine', 'Check engine light diagnostics, OBD-II scanning'),
('Engine Tune-Up', 'engine', 'Spark plug replacement, ignition system service'),
('Timing Belt Replacement', 'engine', 'Timing belt and chain replacement'),
('Engine Overhaul', 'engine', 'Complete engine rebuild and overhaul'),
('Transmission Diagnostics', 'transmission', 'Transmission fluid check, diagnostics'),
('Transmission Repair', 'transmission', 'Transmission rebuild and repair'),
('Clutch Replacement', 'transmission', 'Manual transmission clutch replacement'),
('Suspension Repair', 'suspension', 'Shock and strut replacement'),
('Steering Repair', 'steering', 'Power steering pump, rack and pinion repair'),
('Air Conditioning Service', 'hvac', 'A/C recharge, compressor repair'),
('Heating System Repair', 'hvac', 'Heater core, blower motor repair'),
('Exhaust System Repair', 'exhaust', 'Muffler, catalytic converter, exhaust pipe repair'),
('Emissions Testing', 'diagnostics', 'Emissions testing and repair'),
('Pre-Purchase Inspection', 'diagnostics', 'Comprehensive vehicle inspection'),
('Fluid Services', 'maintenance', 'Coolant, transmission, power steering fluid service'),
('Windshield Wiper Replacement', 'maintenance', 'Wiper blade replacement'),
('Light Bulb Replacement', 'electrical', 'Headlight, taillight, turn signal replacement'),
('Fuel System Service', 'fuel', 'Fuel filter, fuel pump, injector cleaning'),
('Diesel Engine Repair', 'engine', 'Diesel engine diagnostics and repair'),
('Hybrid Vehicle Service', 'specialized', 'Hybrid battery and system service'),
('Electric Vehicle Service', 'specialized', 'EV battery and charging system service')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED BADGES
-- ============================================================================

INSERT INTO public.badges (code, title, description, icon, badge_type, criteria_json) VALUES
('VERIFIED_ID', 'Verified Identity', 'Identity verified by WrenchGo', 'shield-check', 'admin', NULL),
('TOP_RATED', 'Top Rated', 'Maintains 4.8+ star rating with 50+ reviews', 'star', 'earned', '{"min_rating": 4.8, "min_reviews": 50}'),
('EXPERT_MECHANIC', 'Expert Mechanic', 'Completed 200+ jobs with 4.5+ rating', 'wrench', 'earned', '{"min_jobs": 200, "min_rating": 4.5}'),
('RELIABLE', 'Reliable', 'Less than 5% cancellation rate with 30+ jobs', 'clock-check', 'earned', '{"max_cancellation_rate": 0.05, "min_jobs": 30}'),
('FAST_RESPONDER', 'Fast Responder', 'Responds to quotes within 1 hour on average', 'lightning-bolt', 'earned', '{"avg_response_time_hours": 1}'),
('VERIFIED_BRAKES', 'Verified: Brakes', 'Brake repair skills verified', 'check-circle', 'verified_skill', '{"skill": "Brake Repair"}'),
('VERIFIED_ENGINE', 'Verified: Engine', 'Engine repair skills verified', 'check-circle', 'verified_skill', '{"skill": "Engine Diagnostics"}'),
('VERIFIED_ELECTRICAL', 'Verified: Electrical', 'Electrical system skills verified', 'check-circle', 'verified_skill', '{"skill": "Electrical Diagnostics"}'),
('VERIFIED_TRANSMISSION', 'Verified: Transmission', 'Transmission repair skills verified', 'check-circle', 'verified_skill', '{"skill": "Transmission Repair"}'),
('VERIFIED_DIAGNOSTICS', 'Verified: Diagnostics', 'Diagnostic skills verified', 'check-circle', 'verified_skill', '{"skill": "Engine Diagnostics"}'),
('NEW_MECHANIC', 'New Mechanic', 'Welcome to WrenchGo!', 'sparkles', 'admin', NULL),
('RISING_STAR', 'Rising Star', 'Completed 10 jobs with 4.5+ rating', 'trending-up', 'earned', '{"min_jobs": 10, "min_rating": 4.5}'),
('CUSTOMER_FAVORITE', 'Customer Favorite', '95%+ positive reviews', 'heart', 'earned', '{"min_positive_rate": 0.95, "min_reviews": 20}'),
('SPECIALIST', 'Specialist', 'Expert in 3+ verified skills', 'award', 'earned', '{"min_verified_skills": 3}'),
('MOBILE_PRO', 'Mobile Pro', 'Provides mobile service', 'truck', 'admin', NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SAMPLE DATA (for testing - remove in production)
-- ============================================================================

-- Note: This section should be removed or commented out in production
-- It's here for development/testing purposes only

-- Example: Auto-award NEW_MECHANIC badge to all mechanics without badges
-- INSERT INTO public.user_badges (user_id, badge_id, source)
-- SELECT 
--   p.id,
--   b.id,
--   'system'
-- FROM public.profiles p
-- CROSS JOIN public.badges b
-- WHERE p.role = 'mechanic'
--   AND b.code = 'NEW_MECHANIC'
--   AND NOT EXISTS (
--     SELECT 1 FROM public.user_badges ub
--     WHERE ub.user_id = p.id AND ub.badge_id = b.id
--   );
