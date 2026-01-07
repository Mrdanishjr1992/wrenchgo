-- =====================================================
-- HOTFIX: Function to get profile bypassing RLS
-- For use by Edge Functions
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_profile_for_stripe(p_user_id uuid)
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_for_stripe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_for_stripe(uuid) TO service_role;
