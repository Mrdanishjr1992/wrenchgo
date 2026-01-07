-- =====================================================
-- HOTFIX: Add get_my_role function
-- =====================================================
-- Run this in Supabase SQL Editor to fix the role check
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.user_role;
  uid uuid;
BEGIN
  uid := auth.uid();
  
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = uid;
  
  RETURN user_role;
END;
$$;

ALTER FUNCTION public.get_my_role() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Verify
SELECT proname FROM pg_proc WHERE proname = 'get_my_role';
