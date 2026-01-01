-- Migration: Create jobs_public view for safe mechanic browsing
-- Purpose: Expose only non-sensitive job data to mechanics before acceptance

CREATE OR REPLACE VIEW public.jobs_public AS
SELECT
  j.id,
  j.customer_id,
  j.title,
  j.description,
  j.status,
  j.scheduled_for,
  j.vehicle_id,
  j.created_at,
  j.updated_at,
  j.accepted_mechanic_id,
  j.completed_at,
  j.canceled_at,
  j.canceled_by,
  j.public_latitude,
  j.public_longitude,
  j.public_area_label,
  v.year  AS vehicle_year,
  v.make  AS vehicle_make,
  v.model AS vehicle_model,
  p.full_name  AS customer_name,
  p.avatar_url AS customer_avatar_url
FROM public.jobs j
LEFT JOIN public.vehicles v ON j.vehicle_id = v.id
LEFT JOIN public.profiles p ON j.customer_id = p.id;

-- make sure permissions exist
GRANT SELECT ON public.jobs_public TO authenticated;

-- ensure view runs as invoker (respects underlying table RLS)
ALTER VIEW public.jobs_public SET (security_invoker = true);

COMMENT ON VIEW public.jobs_public IS
'Safe view of jobs for mechanic browsing - excludes exact address and private notes.';
