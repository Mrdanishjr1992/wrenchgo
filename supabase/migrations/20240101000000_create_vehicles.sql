-- ============================================================================
-- Migration: Create Vehicles Table (Idempotent)
-- Created: 2024-01-01
-- Description: Creates vehicles table with customer_id (NOT user_id)
-- ============================================================================

-- Create vehicles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Customers can view own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Customers can insert own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Customers can update own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Customers can delete own vehicles" ON public.vehicles;

-- Create RLS policies
CREATE POLICY "Customers can view own vehicles"
  ON public.vehicles FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert own vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update own vehicles"
  ON public.vehicles FOR UPDATE
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can delete own vehicles"
  ON public.vehicles FOR DELETE
  USING (auth.uid() = customer_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON public.vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_created ON public.vehicles(customer_id, created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.vehicles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
