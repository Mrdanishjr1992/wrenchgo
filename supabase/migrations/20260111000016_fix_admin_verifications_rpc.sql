-- Add p_status_filter parameter to admin_get_pending_verifications
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_pending_verifications(
  p_status_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  verification_status text,
  docs_count bigint,
  vetting_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.avatar_url,
    mp.verification_status,
    COUNT(DISTINCT d.id) as docs_count,
    COUNT(DISTINCT vr.id) as vetting_count,
    p.created_at
  FROM public.profiles p
  JOIN public.mechanic_profiles mp ON mp.id = p.id
  LEFT JOIN public.mechanic_verification_documents d ON d.mechanic_id = p.id
  LEFT JOIN public.mechanic_vetting_responses vr ON vr.mechanic_id = p.id
  WHERE p.role = 'mechanic'
    AND (p_status_filter IS NULL OR mp.verification_status = p_status_filter)
  GROUP BY p.id, p.full_name, p.email, p.avatar_url, mp.verification_status, p.created_at
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_pending_verifications(text) TO authenticated;

COMMIT;
