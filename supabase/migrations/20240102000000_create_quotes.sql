-- ============================================================================
-- Migration: Create Quotes Table (Idempotent)
-- Created: 2024-01-02
-- Description: Creates quotes table with proper RLS policies
-- ============================================================================

-- Create quote_status enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE quote_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create quotes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  estimated_hours DECIMAL(5,2),
  notes TEXT,
  status quote_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Mechanics can view their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Customers can view quotes for their jobs" ON public.quotes;
DROP POLICY IF EXISTS "Mechanics can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Mechanics can update their own quotes" ON public.quotes;

-- Create RLS policies
CREATE POLICY "Mechanics can view their own quotes"
  ON public.quotes FOR SELECT
  USING (auth.uid() = mechanic_id);

CREATE POLICY "Customers can view quotes for their jobs"
  ON public.quotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = quotes.job_id
      AND jobs.customer_id = auth.uid()
    )
  );

CREATE POLICY "Mechanics can create quotes"
  ON public.quotes FOR INSERT
  WITH CHECK (auth.uid() = mechanic_id);

CREATE POLICY "Mechanics can update their own quotes"
  ON public.quotes FOR UPDATE
  USING (auth.uid() = mechanic_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON public.quotes(job_id);
CREATE INDEX IF NOT EXISTS idx_quotes_mechanic_id ON public.quotes(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.quotes;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
