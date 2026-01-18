-- Fix admin_list_customers - 'paid' is not a valid payment_status enum value
-- Valid values: pending, processing, succeeded, failed, refunded, partially_refunded

DROP FUNCTION IF EXISTS public.admin_list_customers(int, int, text);

CREATE OR REPLACE FUNCTION public.admin_list_customers(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_query text DEFAULT NULL
)
RETURNS TABLE (
  customer_id uuid,
  full_name text,
  email text,
  phone text,
  city text,
  state text,
  hub_id uuid,
  created_at timestamptz,
  total_jobs bigint,
  completed_jobs bigint,
  total_spent_cents bigint
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
    p.id as customer_id,
    p.full_name::text,
    p.email::text,
    p.phone::text,
    p.city::text,
    p.state::text,
    p.hub_id,
    p.created_at,
    (SELECT COUNT(*) FROM public.jobs j WHERE j.customer_id = p.id) as total_jobs,
    (SELECT COUNT(*) FROM public.jobs j WHERE j.customer_id = p.id AND j.status = 'completed') as completed_jobs,
    COALESCE((SELECT SUM(pay.amount_cents) FROM public.payments pay 
              JOIN public.jobs j ON j.id = pay.job_id 
              WHERE j.customer_id = p.id AND pay.status = 'succeeded'), 0)::bigint as total_spent_cents
  FROM public.profiles p
  WHERE p.role = 'customer'
    AND p.deleted_at IS NULL
    AND (p_query IS NULL OR 
         p.full_name ILIKE '%' || p_query || '%' OR 
         p.email ILIKE '%' || p_query || '%' OR
         p.phone ILIKE '%' || p_query || '%')
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_customers(int, int, text) TO authenticated;