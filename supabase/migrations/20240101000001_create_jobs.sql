-- ============================================================================
-- Migration: Create Jobs Table
-- Created: 2024-01-01 (before quotes)
-- Description: Creates the core jobs table for customer service requests
-- ============================================================================

-- Create job_status enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'searching',
    'quoted',
    'accepted',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create jobs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_mechanic_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Job details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  symptom_id UUID,
  
  -- Location
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_address TEXT,
  
  -- Status and timing
  status job_status DEFAULT 'searching' NOT NULL,
  scheduled_for TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id 
  ON public.jobs(customer_id);

CREATE INDEX IF NOT EXISTS idx_jobs_accepted_mechanic_id 
  ON public.jobs(accepted_mechanic_id);

CREATE INDEX IF NOT EXISTS idx_jobs_status 
  ON public.jobs(status);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at 
  ON public.jobs(created_at DESC);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Customers can insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Customers can view their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Mechanics can view searching jobs" ON public.jobs;
DROP POLICY IF EXISTS "Assigned mechanics can view their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Customers can update their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Assigned mechanics can update their jobs" ON public.jobs;

-- Create RLS policies
CREATE POLICY "Customers can insert jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can view their own jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Mechanics can view searching jobs"
  ON public.jobs FOR SELECT
  USING (status = 'searching');

CREATE POLICY "Assigned mechanics can view their jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = accepted_mechanic_id);

CREATE POLICY "Customers can update their own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = customer_id);

CREATE POLICY "Assigned mechanics can update their jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = accepted_mechanic_id);