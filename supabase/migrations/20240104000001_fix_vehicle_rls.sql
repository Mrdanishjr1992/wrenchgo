-- ============================================================================
-- Migration: Fix Vehicle RLS (Idempotent)
-- Created: 2024-01-03
-- Description: Allow mechanics to view vehicles for jobs they're working on
-- ============================================================================

-- Drop existing policy (idempotent)
DROP POLICY IF EXISTS "Mechanics can view vehicles for their jobs" ON public.vehicles;

-- Mechanics can view vehicles for jobs they have quotes for
CREATE POLICY "Mechanics can view vehicles for their jobs"
  ON public.vehicles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      INNER JOIN public.quote_requests qr ON qr.job_id = j.id
      WHERE j.vehicle_id = vehicles.id
      AND qr.mechanic_id = auth.uid()
    )
  );
