-- ============================================================================
-- Migration: Add Vehicle to Jobs (Idempotent)
-- Created: 2024-01-04
-- Description: Adds vehicle_id column to jobs table with proper RLS
-- ============================================================================

-- Add vehicle_id column to jobs table
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_jobs_vehicle_id ON public.jobs(vehicle_id);

-- Drop existing policy (idempotent)
DROP POLICY IF EXISTS "Customers can insert jobs with their vehicles" ON public.jobs;

-- Update RLS policy to ensure customers can only insert jobs with their own vehicles
CREATE POLICY "Customers can insert jobs with their vehicles"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = customer_id
  AND (
    vehicle_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.vehicles
      WHERE vehicles.id = jobs.vehicle_id
      AND vehicles.customer_id = auth.uid()
    )
  )
);
