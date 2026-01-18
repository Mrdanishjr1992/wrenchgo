-- Drop and recreate admin_get_support_requests to match actual table schema
DROP FUNCTION IF EXISTS public.admin_get_support_requests(text, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_support_requests(
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  job_title text,
  user_id uuid,
  user_name text,
  user_role text,
  category text,
  message text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    sr.id,
    sr.job_id,
    j.title as job_title,
    sr.user_id,
    p.full_name as user_name,
    p.role::text as user_role,
    sr.category,
    sr.message,
    sr.status,
    sr.created_at,
    sr.updated_at
  FROM public.support_requests sr
  LEFT JOIN public.jobs j ON j.id = sr.job_id
  LEFT JOIN public.profiles p ON p.id = sr.user_id
  WHERE (p_status IS NULL OR sr.status = p_status)
  ORDER BY sr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_support_requests(text, int, int) TO authenticated;