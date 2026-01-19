-- =====================================================
-- MIGRATION: ADMIN HUB SCOPING
-- =====================================================
-- Adds hub_id to admin_users for hub-admin scoping
-- Updates all admin RPCs to respect hub scope
-- =====================================================

BEGIN;

-- =====================================================
-- A) ADD HUB SCOPING TO ADMIN_USERS
-- =====================================================
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS hub_id uuid REFERENCES public.service_hubs(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.admin_users.hub_id IS 'Hub ID for hub-admin scoping. NULL = super admin sees all.';

-- =====================================================
-- B) HELPER FUNCTIONS FOR ADMIN SCOPE
-- =====================================================

-- Get admin hub_id (NULL for super admins)
CREATE OR REPLACE FUNCTION public.get_admin_hub_id(uid uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hub_id uuid;
BEGIN
  SELECT hub_id INTO v_hub_id
  FROM public.admin_users
  WHERE user_id = uid;
  RETURN v_hub_id;
END;
$$;

-- Check if admin can access a specific hub
CREATE OR REPLACE FUNCTION public.admin_can_access_hub(target_hub_id uuid, uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
  v_admin_hub_id uuid;
BEGIN
  SELECT is_super, hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users
  WHERE user_id = uid;
  
  IF v_is_super THEN
    RETURN true;
  END IF;
  
  IF v_admin_hub_id IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_admin_hub_id = target_hub_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_hub_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_can_access_hub(uuid, uuid) TO authenticated;

-- =====================================================
-- C) UPDATED ADMIN RPCs WITH HUB SCOPING
-- =====================================================

-- C.1) admin_get_jobs - with hub scoping, search, date range, pagination
DROP FUNCTION IF EXISTS public.admin_get_jobs(text, uuid, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_jobs(
  p_status text DEFAULT NULL,
  p_hub_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  customer_id uuid,
  customer_name text,
  mechanic_id uuid,
  mechanic_name text,
  hub_id uuid,
  hub_name text,
  created_at timestamptz,
  completed_at timestamptz,
  quote_count bigint,
  has_dispute boolean,
  has_support_ticket boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  RETURN QUERY
  SELECT 
    j.id,
    j.title::text,
    j.status::text,
    j.customer_id,
    cp.full_name::text as customer_name,
    j.accepted_mechanic_id as mechanic_id,
    mp.full_name::text as mechanic_name,
    j.hub_id,
    h.name::text as hub_name,
    j.created_at,
    j.completed_at,
    (SELECT COUNT(*) FROM public.quotes q WHERE q.job_id = j.id) as quote_count,
    EXISTS(SELECT 1 FROM public.disputes d WHERE d.job_id = j.id) as has_dispute,
    EXISTS(SELECT 1 FROM public.support_requests sr WHERE sr.job_id = j.id) as has_support_ticket
  FROM public.jobs j
  LEFT JOIN public.profiles cp ON cp.id = j.customer_id
  LEFT JOIN public.profiles mp ON mp.id = j.accepted_mechanic_id
  LEFT JOIN public.service_hubs h ON h.id = j.hub_id
  WHERE 
    (v_is_super OR j.hub_id = v_admin_hub_id)
    AND (p_status IS NULL OR j.status = p_status)
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id)
    AND (p_date_from IS NULL OR j.created_at >= p_date_from)
    AND (p_date_to IS NULL OR j.created_at <= p_date_to)
    AND (p_search IS NULL OR p_search = '' OR 
         j.title ILIKE '%' || p_search || '%' OR
         j.id::text ILIKE '%' || p_search || '%' OR
         cp.full_name ILIKE '%' || p_search || '%' OR
         mp.full_name ILIKE '%' || p_search || '%')
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_jobs(text, uuid, text, timestamptz, timestamptz, int, int) TO authenticated;

-- C.2) admin_get_mechanics - with hub scoping, search, date range, pagination
DROP FUNCTION IF EXISTS public.admin_get_mechanics(text, uuid, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_mechanics(
  p_status text DEFAULT NULL,
  p_hub_id uuid DEFAULT NULL,
  p_tier text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  verification_status text,
  tier text,
  hub_id uuid,
  hub_name text,
  rating_avg numeric,
  rating_count bigint,
  jobs_completed bigint,
  is_available boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name::text,
    p.email::text,
    p.phone::text,
    mp.verification_status::text,
    mp.tier::text,
    p.hub_id,
    h.name::text as hub_name,
    mp.rating_avg,
    mp.rating_count,
    mp.jobs_completed,
    mp.is_available,
    p.created_at
  FROM public.profiles p
  JOIN public.mechanic_profiles mp ON mp.id = p.id
  LEFT JOIN public.service_hubs h ON h.id = p.hub_id
  WHERE 
    p.role = 'mechanic'
    AND (v_is_super OR p.hub_id = v_admin_hub_id)
    AND (p_status IS NULL OR mp.verification_status = p_status)
    AND (p_hub_id IS NULL OR p.hub_id = p_hub_id)
    AND (p_tier IS NULL OR mp.tier = p_tier)
    AND (p_date_from IS NULL OR p.created_at >= p_date_from)
    AND (p_date_to IS NULL OR p.created_at <= p_date_to)
    AND (p_search IS NULL OR p_search = '' OR 
         p.full_name ILIKE '%' || p_search || '%' OR
         p.email ILIKE '%' || p_search || '%' OR
         p.phone ILIKE '%' || p_search || '%')
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_mechanics(text, uuid, text, text, timestamptz, timestamptz, int, int) TO authenticated;

-- C.3) admin_list_customers - with hub scoping, search, date range, pagination
DROP FUNCTION IF EXISTS public.admin_list_customers(int, int, text);

CREATE OR REPLACE FUNCTION public.admin_list_customers(
  p_hub_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  customer_id uuid,
  full_name text,
  email text,
  phone text,
  city text,
  state text,
  hub_id uuid,
  hub_name text,
  created_at timestamptz,
  total_jobs bigint,
  completed_jobs bigint,
  total_spent_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  RETURN QUERY
  SELECT 
    p.id as customer_id,
    p.full_name::text,
    p.email::text,
    p.phone::text,
    p.city::text,
    p.state::text,
    p.hub_id,
    h.name::text as hub_name,
    p.created_at,
    (SELECT COUNT(*) FROM public.jobs j WHERE j.customer_id = p.id) as total_jobs,
    (SELECT COUNT(*) FROM public.jobs j WHERE j.customer_id = p.id AND j.status = 'completed') as completed_jobs,
    COALESCE((SELECT SUM(c.total_customer_cents) FROM public.contracts c 
              JOIN public.jobs j ON j.id = c.job_id 
              WHERE j.customer_id = p.id AND c.status = 'completed'), 0)::bigint as total_spent_cents
  FROM public.profiles p
  LEFT JOIN public.service_hubs h ON h.id = p.hub_id
  WHERE 
    p.role = 'customer'
    AND (v_is_super OR p.hub_id = v_admin_hub_id)
    AND (p_hub_id IS NULL OR p.hub_id = p_hub_id)
    AND (p_date_from IS NULL OR p.created_at >= p_date_from)
    AND (p_date_to IS NULL OR p.created_at <= p_date_to)
    AND (p_search IS NULL OR p_search = '' OR 
         p.full_name ILIKE '%' || p_search || '%' OR
         p.email ILIKE '%' || p_search || '%' OR
         p.phone ILIKE '%' || p_search || '%')
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_customers(uuid, text, timestamptz, timestamptz, int, int) TO authenticated;

-- C.4) admin_list_support_requests - with hub scoping, search, date range
DROP FUNCTION IF EXISTS public.admin_list_support_requests(text, text, int, int);

CREATE OR REPLACE FUNCTION public.admin_list_support_threads(
  p_hub_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  thread_id uuid,
  user_id uuid,
  user_name text,
  user_role text,
  user_email text,
  hub_id uuid,
  hub_name text,
  job_id uuid,
  job_title text,
  status text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  RETURN QUERY
  WITH thread_data AS (
    SELECT DISTINCT ON (am.thread_id)
      am.thread_id,
      am.user_id,
      am.related_job_id,
      am.body as last_message,
      am.created_at as last_message_at,
      FIRST_VALUE(am.created_at) OVER (PARTITION BY am.thread_id ORDER BY am.created_at ASC) as thread_created_at
    FROM public.admin_messages am
    WHERE am.thread_id IS NOT NULL
    ORDER BY am.thread_id, am.created_at DESC
  )
  SELECT 
    td.thread_id,
    td.user_id,
    p.full_name::text as user_name,
    p.role::text as user_role,
    p.email::text as user_email,
    p.hub_id,
    h.name::text as hub_name,
    td.related_job_id as job_id,
    j.title::text as job_title,
    CASE WHEN EXISTS(SELECT 1 FROM public.admin_messages am2 WHERE am2.thread_id = td.thread_id AND am2.read_at IS NULL AND am2.sender_type = 'user') 
         THEN 'open'::text ELSE 'closed'::text END as status,
    td.last_message::text,
    td.last_message_at,
    (SELECT COUNT(*) FROM public.admin_messages am3 WHERE am3.thread_id = td.thread_id AND am3.read_at IS NULL AND am3.sender_type = 'user') as unread_count,
    td.thread_created_at as created_at
  FROM thread_data td
  JOIN public.profiles p ON p.id = td.user_id
  LEFT JOIN public.service_hubs h ON h.id = p.hub_id
  LEFT JOIN public.jobs j ON j.id = td.related_job_id
  WHERE 
    (v_is_super OR p.hub_id = v_admin_hub_id)
    AND (p_hub_id IS NULL OR p.hub_id = p_hub_id)
    AND (p_status IS NULL OR 
         (p_status = 'open' AND EXISTS(SELECT 1 FROM public.admin_messages am2 WHERE am2.thread_id = td.thread_id AND am2.read_at IS NULL AND am2.sender_type = 'user')) OR
         (p_status = 'closed' AND NOT EXISTS(SELECT 1 FROM public.admin_messages am2 WHERE am2.thread_id = td.thread_id AND am2.read_at IS NULL AND am2.sender_type = 'user')))
    AND (p_date_from IS NULL OR td.thread_created_at >= p_date_from)
    AND (p_date_to IS NULL OR td.thread_created_at <= p_date_to)
    AND (p_search IS NULL OR p_search = '' OR 
         p.full_name ILIKE '%' || p_search || '%' OR
         td.thread_id::text ILIKE '%' || p_search || '%' OR
         td.related_job_id::text ILIKE '%' || p_search || '%')
  ORDER BY td.last_message_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_support_threads(uuid, text, text, timestamptz, timestamptz, int, int) TO authenticated;

-- C.5) admin_get_payments - with hub scoping, search, date range
DROP FUNCTION IF EXISTS public.admin_get_payments(text, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_payments(
  p_hub_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  job_title text,
  customer_id uuid,
  customer_name text,
  mechanic_id uuid,
  mechanic_name text,
  hub_id uuid,
  hub_name text,
  amount_cents int,
  status text,
  created_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  RETURN QUERY
  SELECT 
    pay.id,
    pay.job_id,
    j.title::text as job_title,
    j.customer_id,
    cp.full_name::text as customer_name,
    c.mechanic_id,
    mp.full_name::text as mechanic_name,
    j.hub_id,
    h.name::text as hub_name,
    pay.amount_cents::int,
    pay.status::text,
    pay.created_at,
    pay.paid_at,
    pay.refunded_at
  FROM public.payments pay
  JOIN public.jobs j ON j.id = pay.job_id
  LEFT JOIN public.contracts c ON c.job_id = j.id
  LEFT JOIN public.profiles cp ON cp.id = j.customer_id
  LEFT JOIN public.profiles mp ON mp.id = c.mechanic_id
  LEFT JOIN public.service_hubs h ON h.id = j.hub_id
  WHERE 
    (v_is_super OR j.hub_id = v_admin_hub_id)
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id)
    AND (p_status IS NULL OR pay.status = p_status)
    AND (p_date_from IS NULL OR pay.created_at >= p_date_from)
    AND (p_date_to IS NULL OR pay.created_at <= p_date_to)
    AND (p_search IS NULL OR p_search = '' OR 
         pay.id::text ILIKE '%' || p_search || '%' OR
         j.id::text ILIKE '%' || p_search || '%' OR
         cp.full_name ILIKE '%' || p_search || '%')
  ORDER BY pay.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_payments(uuid, text, text, timestamptz, timestamptz, int, int) TO authenticated;

-- C.6) admin_get_payouts - with hub scoping, search, date range
DROP FUNCTION IF EXISTS public.admin_get_payouts(text, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_payouts(
  p_hub_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  mechanic_id uuid,
  mechanic_name text,
  hub_id uuid,
  hub_name text,
  gross_amount_cents int,
  net_amount_cents int,
  commission_cents int,
  status text,
  created_at timestamptz,
  processed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  RETURN QUERY
  SELECT 
    po.id,
    po.mechanic_id,
    p.full_name::text as mechanic_name,
    p.hub_id,
    h.name::text as hub_name,
    po.gross_amount_cents::int,
    po.net_amount_cents::int,
    po.commission_cents::int,
    po.status::text,
    po.created_at,
    po.processed_at
  FROM public.payouts po
  JOIN public.profiles p ON p.id = po.mechanic_id
  LEFT JOIN public.service_hubs h ON h.id = p.hub_id
  WHERE 
    (v_is_super OR p.hub_id = v_admin_hub_id)
    AND (p_hub_id IS NULL OR p.hub_id = p_hub_id)
    AND (p_status IS NULL OR po.status = p_status)
    AND (p_date_from IS NULL OR po.created_at >= p_date_from)
    AND (p_date_to IS NULL OR po.created_at <= p_date_to)
    AND (p_search IS NULL OR p_search = '' OR 
         po.id::text ILIKE '%' || p_search || '%' OR
         p.full_name ILIKE '%' || p_search || '%')
  ORDER BY po.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_payouts(uuid, text, text, timestamptz, timestamptz, int, int) TO authenticated;

-- C.7) admin_list_disputes - with hub scoping, search, date range
DROP FUNCTION IF EXISTS public.admin_list_disputes(text, int, int);

CREATE OR REPLACE FUNCTION public.admin_list_disputes(
  p_hub_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  job_title text,
  customer_id uuid,
  customer_name text,
  mechanic_id uuid,
  mechanic_name text,
  hub_id uuid,
  hub_name text,
  category text,
  status text,
  priority text,
  created_at timestamptz,
  resolved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  RETURN QUERY
  SELECT 
    d.id,
    d.job_id,
    j.title::text as job_title,
    j.customer_id,
    cp.full_name::text as customer_name,
    j.accepted_mechanic_id as mechanic_id,
    mp.full_name::text as mechanic_name,
    j.hub_id,
    h.name::text as hub_name,
    d.category::text,
    d.status::text,
    d.priority::text,
    d.created_at,
    d.resolved_at
  FROM public.disputes d
  JOIN public.jobs j ON j.id = d.job_id
  LEFT JOIN public.profiles cp ON cp.id = j.customer_id
  LEFT JOIN public.profiles mp ON mp.id = j.accepted_mechanic_id
  LEFT JOIN public.service_hubs h ON h.id = j.hub_id
  WHERE 
    (v_is_super OR j.hub_id = v_admin_hub_id)
    AND (p_hub_id IS NULL OR j.hub_id = p_hub_id)
    AND (p_status IS NULL OR d.status = p_status)
    AND (p_date_from IS NULL OR d.created_at >= p_date_from)
    AND (p_date_to IS NULL OR d.created_at <= p_date_to)
    AND (p_search IS NULL OR p_search = '' OR 
         d.id::text ILIKE '%' || p_search || '%' OR
         j.id::text ILIKE '%' || p_search || '%' OR
         cp.full_name ILIKE '%' || p_search || '%' OR
         mp.full_name ILIKE '%' || p_search || '%')
  ORDER BY d.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_disputes(uuid, text, text, timestamptz, timestamptz, int, int) TO authenticated;

-- C.8) admin_get_verification_queue - with hub scoping
DROP FUNCTION IF EXISTS public.admin_get_verification_queue(text, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_verification_queue(
  p_hub_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  hub_id uuid,
  hub_name text,
  verification_status text,
  verification_reason text,
  created_at timestamptz,
  verification_updated_at timestamptz,
  documents_count bigint,
  pending_documents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name::text,
    p.email::text,
    p.phone::text,
    p.hub_id,
    h.name::text as hub_name,
    mp.verification_status::text,
    mp.verification_reason::text,
    p.created_at,
    mp.verification_updated_at,
    (SELECT COUNT(*) FROM public.mechanic_documents md WHERE md.mechanic_id = p.id) as documents_count,
    (SELECT COUNT(*) FROM public.mechanic_documents md WHERE md.mechanic_id = p.id AND md.status = 'pending') as pending_documents
  FROM public.profiles p
  JOIN public.mechanic_profiles mp ON mp.id = p.id
  LEFT JOIN public.service_hubs h ON h.id = p.hub_id
  WHERE 
    p.role = 'mechanic'
    AND (v_is_super OR p.hub_id = v_admin_hub_id)
    AND (p_hub_id IS NULL OR p.hub_id = p_hub_id)
    AND (p_status IS NULL OR mp.verification_status = p_status)
    AND (p_search IS NULL OR p_search = '' OR 
         p.full_name ILIKE '%' || p_search || '%' OR
         p.email ILIKE '%' || p_search || '%')
  ORDER BY 
    CASE WHEN mp.verification_status = 'pending_verification' THEN 0 ELSE 1 END,
    p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_verification_queue(uuid, text, text, int, int) TO authenticated;

-- C.9) admin_get_waitlist - with hub scoping
DROP FUNCTION IF EXISTS public.admin_get_waitlist(uuid, int, int);

CREATE OR REPLACE FUNCTION public.admin_get_waitlist(
  p_hub_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  phone text,
  full_name text,
  zip text,
  city text,
  state text,
  user_type text,
  hub_id uuid,
  hub_name text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  RETURN QUERY
  SELECT 
    w.id,
    w.email::text,
    w.phone::text,
    w.full_name::text,
    w.zip::text,
    zc.city::text,
    zc.state::text,
    w.user_type::text,
    w.hub_id,
    h.name::text as hub_name,
    COALESCE(w.status, 'new')::text as status,
    w.created_at
  FROM public.waitlist w
  LEFT JOIN public.zip_codes zc ON zc.zip = w.zip
  LEFT JOIN public.service_hubs h ON h.id = w.hub_id
  WHERE 
    (v_is_super OR w.hub_id = v_admin_hub_id OR v_admin_hub_id IS NULL)
    AND (p_hub_id IS NULL OR w.hub_id = p_hub_id)
    AND (p_status IS NULL OR COALESCE(w.status, 'new') = p_status)
    AND (p_date_from IS NULL OR w.created_at >= p_date_from)
    AND (p_date_to IS NULL OR w.created_at <= p_date_to)
    AND (p_search IS NULL OR p_search = '' OR 
         w.full_name ILIKE '%' || p_search || '%' OR
         w.email ILIKE '%' || p_search || '%' OR
         w.phone ILIKE '%' || p_search || '%')
  ORDER BY w.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_waitlist(uuid, text, text, timestamptz, timestamptz, int, int) TO authenticated;

-- C.10) admin_get_hubs - updated with hub scoping for hub admins
DROP FUNCTION IF EXISTS public.admin_get_hubs();

CREATE OR REPLACE FUNCTION public.admin_get_hubs()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  zip text,
  city text,
  state text,
  lat numeric,
  lng numeric,
  active_radius_miles int,
  max_radius_miles int,
  invite_only boolean,
  auto_expand_enabled boolean,
  is_active boolean,
  launch_date date,
  created_at timestamptz,
  active_mechanics bigint,
  jobs_last_14d bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  RETURN QUERY
  SELECT 
    h.id,
    h.name::text,
    h.slug::text,
    h.zip::text,
    zc.city::text,
    zc.state::text,
    h.lat::numeric,
    h.lng::numeric,
    h.active_radius_miles::int,
    h.max_radius_miles::int,
    h.invite_only,
    h.auto_expand_enabled,
    h.is_active,
    h.launch_date,
    h.created_at,
    (SELECT COUNT(DISTINCT p.id) 
     FROM public.profiles p
     JOIN public.mechanic_profiles mp ON mp.id = p.id
     WHERE p.hub_id = h.id AND mp.verification_status = 'active') as active_mechanics,
    (SELECT COUNT(*) 
     FROM public.jobs j 
     WHERE j.hub_id = h.id AND j.created_at >= CURRENT_DATE - 14) as jobs_last_14d
  FROM public.service_hubs h
  LEFT JOIN public.zip_codes zc ON zc.zip = h.zip
  WHERE v_is_super OR h.id = v_admin_hub_id
  ORDER BY h.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_hubs() TO authenticated;

-- C.11) admin_get_metrics - with hub scoping
DROP FUNCTION IF EXISTS public.admin_get_metrics(uuid, int);

CREATE OR REPLACE FUNCTION public.admin_get_metrics(
  p_hub_id uuid DEFAULT NULL,
  p_days int DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_hub_id uuid;
  v_is_super boolean;
  v_effective_hub_id uuid;
  v_start_date timestamptz;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT is_super, au.hub_id INTO v_is_super, v_admin_hub_id
  FROM public.admin_users au
  WHERE au.user_id = auth.uid();

  -- Hub admins can only see their hub
  IF NOT v_is_super AND v_admin_hub_id IS NOT NULL THEN
    v_effective_hub_id := v_admin_hub_id;
  ELSE
    v_effective_hub_id := p_hub_id;
  END IF;

  v_start_date := CURRENT_DATE - p_days;

  SELECT jsonb_build_object(
    'period_days', p_days,
    'hub_id', v_effective_hub_id,
    'daily_jobs_created', (
      SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
      FROM (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM public.jobs
        WHERE created_at >= v_start_date
          AND (v_effective_hub_id IS NULL OR hub_id = v_effective_hub_id)
        GROUP BY DATE(created_at)
        ORDER BY date
      ) d
    ),
    'daily_jobs_completed', (
      SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
      FROM (
        SELECT DATE(completed_at) as date, COUNT(*) as count
        FROM public.jobs
        WHERE completed_at >= v_start_date
          AND (v_effective_hub_id IS NULL OR hub_id = v_effective_hub_id)
        GROUP BY DATE(completed_at)
        ORDER BY date
      ) d
    ),
    'totals', jsonb_build_object(
      'jobs_created', (SELECT COUNT(*) FROM public.jobs WHERE created_at >= v_start_date AND (v_effective_hub_id IS NULL OR hub_id = v_effective_hub_id)),
      'jobs_completed', (SELECT COUNT(*) FROM public.jobs WHERE completed_at >= v_start_date AND (v_effective_hub_id IS NULL OR hub_id = v_effective_hub_id)),
      'quotes', (SELECT COUNT(*) FROM public.quotes q JOIN public.jobs j ON j.id = q.job_id WHERE q.created_at >= v_start_date AND (v_effective_hub_id IS NULL OR j.hub_id = v_effective_hub_id)),
      'accepted', (SELECT COUNT(*) FROM public.quotes q JOIN public.jobs j ON j.id = q.job_id WHERE q.status = 'accepted' AND q.created_at >= v_start_date AND (v_effective_hub_id IS NULL OR j.hub_id = v_effective_hub_id)),
      'disputes', (SELECT COUNT(*) FROM public.disputes d JOIN public.jobs j ON j.id = d.job_id WHERE d.created_at >= v_start_date AND (v_effective_hub_id IS NULL OR j.hub_id = v_effective_hub_id)),
      'refunds', (SELECT COUNT(*) FROM public.payments p JOIN public.jobs j ON j.id = p.job_id WHERE p.refunded_at >= v_start_date AND (v_effective_hub_id IS NULL OR j.hub_id = v_effective_hub_id)),
      'support_tickets', (SELECT COUNT(*) FROM public.support_requests sr LEFT JOIN public.jobs j ON j.id = sr.job_id WHERE sr.created_at >= v_start_date AND (v_effective_hub_id IS NULL OR j.hub_id = v_effective_hub_id OR sr.job_id IS NULL))
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_metrics(uuid, int) TO authenticated;

-- C.12) admin_get_scope - returns current admin's scope info
CREATE OR REPLACE FUNCTION public.admin_get_scope()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
  v_hub_id uuid;
  v_hub_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Admin access required');
  END IF;

  SELECT au.is_super, au.hub_id, h.name
  INTO v_is_super, v_hub_id, v_hub_name
  FROM public.admin_users au
  LEFT JOIN public.service_hubs h ON h.id = au.hub_id
  WHERE au.user_id = auth.uid();

  RETURN jsonb_build_object(
    'is_super', v_is_super,
    'hub_id', v_hub_id,
    'hub_name', v_hub_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_scope() TO authenticated;

COMMIT;
