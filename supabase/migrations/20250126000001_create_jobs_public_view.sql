-- Migration: Create jobs_public view for safe mechanic browsing
-- Purpose: Expose only non-sensitive job data to mechanics before acceptance

-- 1. Create view with only safe fields
CREATE OR REPLACE VIEW public.jobs_public AS
SELECT 
  j.id,
  j.customer_id,
  j.title,
  j.description,
  j.status,
  j.preferred_time,
  j.vehicle_id,
  j.intake,
  j.created_at,
  j.updated_at,
  j.accepted_mechanic_id,
  j.started_at,
  j.completed_at,
  j.canceled_at,
  j.canceled_by,
  j.public_latitude,
  j.public_longitude,
  j.public_area_label,
  v.year AS vehicle_year,
  v.make AS vehicle_make,
  v.model AS vehicle_model,
  p.full_name AS customer_name,
  p.photo_url AS customer_photo_url
FROM public.jobs j
LEFT JOIN public.vehicles v ON j.vehicle_id = v.id
LEFT JOIN public.profiles p ON j.customer_id = p.id
WHERE j.deleted_at IS NULL;

-- 2. Grant access to authenticated users
GRANT SELECT ON public.jobs_public TO authenticated;

-- 3. Enable RLS on the view
ALTER VIEW public.jobs_public SET (security_invoker = true);

-- 4. Create RLS policy for mechanics browsing
CREATE POLICY "Mechanics can view all active jobs via public view"
  ON public.jobs_public
  FOR SELECT
  TO authenticated
  USING (
    status IN ('searching', 'quoted', 'accepted', 'in_progress', 'completed')
    AND deleted_at IS NULL
  );

COMMENT ON VIEW public.jobs_public IS 'Safe view of jobs for mechanic browsing - excludes exact location and private notes';
