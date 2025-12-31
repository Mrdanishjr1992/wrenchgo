-- ============================================================================
-- Migration: Create Quote Requests Table
-- Created: 2024-01-01 (after jobs, before quotes)
-- Description: Creates quote_requests table for mechanic quotes on jobs
-- ============================================================================

-- Create quote_request_status enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE quote_request_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'expired',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create quote_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Quote details
  price_cents INTEGER NOT NULL,
  estimated_hours DECIMAL(5,2),
  notes TEXT,
  
  -- Status and timing
  status quote_request_status DEFAULT 'pending' NOT NULL,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quote_requests_job_id 
  ON public.quote_requests(job_id);

CREATE INDEX IF NOT EXISTS idx_quote_requests_mechanic_id 
  ON public.quote_requests(mechanic_id);

CREATE INDEX IF NOT EXISTS idx_quote_requests_customer_id 
  ON public.quote_requests(customer_id);

CREATE INDEX IF NOT EXISTS idx_quote_requests_status 
  ON public.quote_requests(status);

-- Enable RLS
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Mechanics can insert quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Customers can view quote requests for their jobs" ON public.quote_requests;
DROP POLICY IF EXISTS "Mechanics can view their own quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Customers can update quote requests for their jobs" ON public.quote_requests;
DROP POLICY IF EXISTS "Mechanics can update their own quote requests" ON public.quote_requests;

-- Create RLS policies
CREATE POLICY "Mechanics can insert quote requests"
  ON public.quote_requests FOR INSERT
  WITH CHECK (auth.uid() = mechanic_id);

CREATE POLICY "Customers can view quote requests for their jobs"
  ON public.quote_requests FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Mechanics can view their own quote requests"
  ON public.quote_requests FOR SELECT
  USING (auth.uid() = mechanic_id);

CREATE POLICY "Customers can update quote requests for their jobs"
  ON public.quote_requests FOR UPDATE
  USING (auth.uid() = customer_id);

CREATE POLICY "Mechanics can update their own quote requests"
  ON public.quote_requests FOR UPDATE
  USING (auth.uid() = mechanic_id);
