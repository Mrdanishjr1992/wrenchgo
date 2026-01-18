-- Add missing enum value for mechanic promo events
DO $$ 
BEGIN 
  ALTER TYPE public.job_event_type ADD VALUE IF NOT EXISTS 'mechanic_promo_applied';
EXCEPTION WHEN duplicate_object THEN 
  NULL;
END $$;
