-- =====================================================
-- MIGRATION: Platform Terms + Job Acknowledgement (Phase 4.5)
-- =====================================================
-- Purpose: Reduce liability and improve enforceability
-- - Platform terms acceptance (account-level)
-- - Job acknowledgement (job-level)
-- =====================================================

BEGIN;

-- =====================================================
-- TABLE: platform_terms_versions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.platform_terms_versions (
  version text PRIMARY KEY,
  role text NOT NULL DEFAULT 'all' CHECK (role IN ('customer', 'mechanic', 'all')),
  title text NOT NULL,
  summary text NOT NULL,
  full_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_terms_versions IS 'Versioned platform terms of service';

-- =====================================================
-- TABLE: platform_terms_acceptances
-- =====================================================
CREATE TABLE IF NOT EXISTS public.platform_terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer', 'mechanic')),
  terms_version text NOT NULL REFERENCES public.platform_terms_versions(version),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  UNIQUE(user_id, terms_version)
);

COMMENT ON TABLE public.platform_terms_acceptances IS 'Immutable record of user terms acceptances';

CREATE INDEX IF NOT EXISTS idx_platform_terms_acceptances_user 
  ON public.platform_terms_acceptances(user_id);

-- =====================================================
-- TABLE: job_acknowledgements
-- =====================================================
CREATE TABLE IF NOT EXISTS public.job_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.job_contracts(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer', 'mechanic')),
  acknowledgement_version text NOT NULL,
  acknowledgement_text text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  UNIQUE(job_id, user_id, role, acknowledgement_version)
);

COMMENT ON TABLE public.job_acknowledgements IS 'Immutable record of job-specific acknowledgements';

CREATE INDEX IF NOT EXISTS idx_job_acknowledgements_job 
  ON public.job_acknowledgements(job_id);
CREATE INDEX IF NOT EXISTS idx_job_acknowledgements_user 
  ON public.job_acknowledgements(user_id);

-- =====================================================
-- ADD COLUMNS TO job_contracts
-- =====================================================
ALTER TABLE public.job_contracts 
  ADD COLUMN IF NOT EXISTS customer_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS mechanic_acknowledged_at timestamptz;

-- =====================================================
-- RLS: platform_terms_versions
-- =====================================================
ALTER TABLE public.platform_terms_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terms_versions_select_authenticated" ON public.platform_terms_versions;
CREATE POLICY "terms_versions_select_authenticated" ON public.platform_terms_versions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "terms_versions_admin_insert" ON public.platform_terms_versions;
CREATE POLICY "terms_versions_admin_insert" ON public.platform_terms_versions
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "terms_versions_admin_update" ON public.platform_terms_versions;
CREATE POLICY "terms_versions_admin_update" ON public.platform_terms_versions
  FOR UPDATE TO authenticated USING (public.is_admin());

-- =====================================================
-- RLS: platform_terms_acceptances
-- =====================================================
ALTER TABLE public.platform_terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terms_acceptances_select_own" ON public.platform_terms_acceptances;
CREATE POLICY "terms_acceptances_select_own" ON public.platform_terms_acceptances
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "terms_acceptances_insert_own" ON public.platform_terms_acceptances;
CREATE POLICY "terms_acceptances_insert_own" ON public.platform_terms_acceptances
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE policies - acceptances are immutable

-- =====================================================
-- RLS: job_acknowledgements
-- =====================================================
ALTER TABLE public.job_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_ack_select_own_or_admin" ON public.job_acknowledgements;
CREATE POLICY "job_ack_select_own_or_admin" ON public.job_acknowledgements
  FOR SELECT TO authenticated 
  USING (
    user_id = auth.uid() 
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs j 
      WHERE j.id = job_id 
      AND (j.customer_id = auth.uid() OR j.accepted_mechanic_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "job_ack_insert_own" ON public.job_acknowledgements;
CREATE POLICY "job_ack_insert_own" ON public.job_acknowledgements
  FOR INSERT TO authenticated 
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs j 
      WHERE j.id = job_id 
      AND (
        (role = 'customer' AND j.customer_id = auth.uid())
        OR (role = 'mechanic' AND j.accepted_mechanic_id = auth.uid())
      )
    )
  );

-- No UPDATE/DELETE policies - acknowledgements are immutable

-- =====================================================
-- SEED: Initial platform terms version
-- =====================================================
INSERT INTO public.platform_terms_versions (version, role, title, summary, full_text, is_active)
VALUES (
  '2026.01',
  'all',
  'WrenchGo Platform Terms of Service',
  'By using WrenchGo, you agree to our terms governing the marketplace relationship between customers and independent mechanics.',
  E'WRENCHGO PLATFORM TERMS OF SERVICE\n\nVersion 2026.01\nEffective Date: January 2026\n\n1. ACCEPTANCE OF TERMS\nBy accessing or using the WrenchGo platform, you agree to be bound by these Terms of Service.\n\n2. PLATFORM NATURE\nWrenchGo is a marketplace connecting customers with independent mobile mechanics. WrenchGo does not employ mechanics and is not responsible for the quality of work performed.\n\n3. INDEPENDENT CONTRACTORS\nMechanics on the platform are independent contractors, not employees of WrenchGo. They are solely responsible for their work, tools, insurance, and compliance with applicable laws.\n\n4. CUSTOMER RESPONSIBILITIES\n- Provide accurate vehicle and location information\n- Ensure safe, accessible workspace for mechanic\n- Authorize work and approve any additional charges\n- Make timely payment through the platform\n\n5. MECHANIC RESPONSIBILITIES\n- Maintain required licenses and insurance\n- Perform work professionally and safely\n- Communicate clearly about scope and pricing\n- Process all payments through the platform\n\n6. PAYMENTS AND FEES\nAll payments must be processed through WrenchGo. Off-platform payments are prohibited and may result in account termination.\n\n7. DISPUTES\nDisputes should be reported through the app. WrenchGo will mediate but final resolution may require external arbitration.\n\n8. LIMITATION OF LIABILITY\nWrenchGo''s liability is limited to platform fees paid. We are not liable for work quality, property damage, or personal injury.\n\n9. CHANGES TO TERMS\nWe may update these terms. Continued use constitutes acceptance of updated terms.\n\n10. CONTACT\nFor questions, contact support@wrenchgo.com',
  true
) ON CONFLICT (version) DO NOTHING;

-- =====================================================
-- RPC: get_active_terms
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_active_terms(p_role text)
RETURNS TABLE (
  version text,
  title text,
  summary text,
  full_text text,
  published_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ptv.version,
    ptv.title,
    ptv.summary,
    ptv.full_text,
    ptv.published_at
  FROM public.platform_terms_versions ptv
  WHERE ptv.is_active = true
    AND (ptv.role = 'all' OR ptv.role = p_role)
  ORDER BY ptv.published_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_terms(text) TO authenticated;

-- =====================================================
-- RPC: accept_platform_terms
-- =====================================================
CREATE OR REPLACE FUNCTION public.accept_platform_terms(
  p_terms_version text,
  p_role text,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_acceptance_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate terms version exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_terms_versions 
    WHERE version = p_terms_version 
    AND is_active = true
    AND (role = 'all' OR role = p_role)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid terms version');
  END IF;

  -- Insert acceptance (idempotent via ON CONFLICT)
  INSERT INTO public.platform_terms_acceptances (user_id, role, terms_version, user_agent)
  VALUES (v_user_id, p_role, p_terms_version, p_user_agent)
  ON CONFLICT (user_id, terms_version) DO NOTHING
  RETURNING id INTO v_acceptance_id;

  RETURN jsonb_build_object(
    'success', true,
    'acceptance_id', COALESCE(v_acceptance_id, (
      SELECT id FROM public.platform_terms_acceptances 
      WHERE user_id = v_user_id AND terms_version = p_terms_version
    ))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_platform_terms(text, text, text) TO authenticated;

-- =====================================================
-- RPC: check_terms_accepted
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_terms_accepted(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_active_version text;
  v_accepted boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'error', 'Not authenticated');
  END IF;

  -- Get active version for this role
  SELECT version INTO v_active_version
  FROM public.platform_terms_versions
  WHERE is_active = true AND (role = 'all' OR role = p_role)
  ORDER BY published_at DESC
  LIMIT 1;

  IF v_active_version IS NULL THEN
    RETURN jsonb_build_object('accepted', true, 'version', NULL);
  END IF;

  -- Check if accepted
  SELECT EXISTS (
    SELECT 1 FROM public.platform_terms_acceptances
    WHERE user_id = v_user_id AND terms_version = v_active_version
  ) INTO v_accepted;

  RETURN jsonb_build_object(
    'accepted', v_accepted,
    'version', v_active_version,
    'requires_acceptance', NOT v_accepted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_terms_accepted(text) TO authenticated;

-- =====================================================
-- RPC: require_terms_or_throw
-- =====================================================
CREATE OR REPLACE FUNCTION public.require_terms_or_throw(p_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_active_version text;
  v_accepted boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get active version for this role
  SELECT version INTO v_active_version
  FROM public.platform_terms_versions
  WHERE is_active = true AND (role = 'all' OR role = p_role)
  ORDER BY published_at DESC
  LIMIT 1;

  -- If no active terms, allow
  IF v_active_version IS NULL THEN
    RETURN true;
  END IF;

  -- Check if accepted
  SELECT EXISTS (
    SELECT 1 FROM public.platform_terms_acceptances
    WHERE user_id = v_user_id AND terms_version = v_active_version
  ) INTO v_accepted;

  IF NOT v_accepted THEN
    RAISE EXCEPTION 'Platform terms not accepted. Version: %', v_active_version;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.require_terms_or_throw(text) TO authenticated;

-- =====================================================
-- RPC: accept_job_acknowledgement
-- =====================================================
CREATE OR REPLACE FUNCTION public.accept_job_acknowledgement(
  p_job_id uuid,
  p_role text,
  p_ack_version text,
  p_ack_text text,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_job RECORD;
  v_contract_id uuid;
  v_ack_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get job and validate user is part of it
  SELECT j.*, jc.id as contract_id
  INTO v_job
  FROM public.jobs j
  LEFT JOIN public.job_contracts jc ON jc.job_id = j.id
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Validate user is correct party
  IF p_role = 'customer' AND v_job.customer_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized as customer');
  END IF;

  IF p_role = 'mechanic' AND v_job.accepted_mechanic_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized as mechanic');
  END IF;

  v_contract_id := v_job.contract_id;

  -- Insert acknowledgement
  INSERT INTO public.job_acknowledgements (
    job_id, contract_id, user_id, role, acknowledgement_version, acknowledgement_text, user_agent
  ) VALUES (
    p_job_id, v_contract_id, v_user_id, p_role, p_ack_version, p_ack_text, p_user_agent
  )
  ON CONFLICT (job_id, user_id, role, acknowledgement_version) DO NOTHING
  RETURNING id INTO v_ack_id;

  -- Update contract timestamps if contract exists
  IF v_contract_id IS NOT NULL THEN
    IF p_role = 'customer' THEN
      UPDATE public.job_contracts 
      SET customer_acknowledged_at = COALESCE(customer_acknowledged_at, now())
      WHERE id = v_contract_id;
    ELSIF p_role = 'mechanic' THEN
      UPDATE public.job_contracts 
      SET mechanic_acknowledged_at = COALESCE(mechanic_acknowledged_at, now())
      WHERE id = v_contract_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'acknowledgement_id', COALESCE(v_ack_id, (
      SELECT id FROM public.job_acknowledgements 
      WHERE job_id = p_job_id AND user_id = v_user_id AND role = p_role AND acknowledgement_version = p_ack_version
    ))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_job_acknowledgement(uuid, text, text, text, text) TO authenticated;

-- =====================================================
-- UPDATED RPC: accept_quote_and_create_contract (with enforcement)
-- =====================================================
CREATE OR REPLACE FUNCTION accept_quote_and_create_contract(
  p_quote_id uuid,
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_job RECORD;
  v_contract_id uuid;
  v_progress_id uuid;
  v_platform_fee_cents int := 1500;
  v_commission_cents int;
  v_total_customer_cents int;
  v_mechanic_payout_cents int;
  v_line_item_id uuid;
  v_terms_check jsonb;
BEGIN
  -- ENFORCEMENT: Check platform terms accepted
  v_terms_check := public.check_terms_accepted('customer');
  IF NOT (v_terms_check->>'accepted')::boolean THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Please accept platform terms first',
      'requires_terms', true,
      'terms_version', v_terms_check->>'version'
    );
  END IF;

  -- Get quote with lock
  SELECT q.*, j.customer_id as job_customer_id, j.status as job_status, j.id as actual_job_id
  INTO v_quote
  FROM public.quotes q
  JOIN public.jobs j ON j.id = q.job_id
  WHERE q.id = p_quote_id
  FOR UPDATE OF q, j;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  IF v_quote.job_customer_id != p_customer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  
  IF v_quote.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote is no longer available');
  END IF;
  
  IF v_quote.job_status NOT IN ('searching', 'quoted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job is no longer accepting quotes');
  END IF;
  
  -- ENFORCEMENT: Check job acknowledgement exists
  IF NOT EXISTS (
    SELECT 1 FROM public.job_acknowledgements
    WHERE job_id = v_quote.actual_job_id 
    AND user_id = p_customer_id 
    AND role = 'customer'
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Please acknowledge job terms first',
      'requires_acknowledgement', true,
      'job_id', v_quote.actual_job_id
    );
  END IF;
  
  -- Calculate fees
  v_commission_cents := calculate_mechanic_commission(v_quote.price_cents);
  v_total_customer_cents := v_quote.price_cents + v_platform_fee_cents;
  v_mechanic_payout_cents := v_quote.price_cents - v_commission_cents;
  
  -- Create contract
  INSERT INTO public.job_contracts (
    job_id, quote_id, customer_id, mechanic_id,
    status, quoted_price_cents, platform_fee_cents, estimated_hours,
    subtotal_cents, total_customer_cents, mechanic_commission_cents, mechanic_payout_cents,
    customer_acknowledged_at
  ) VALUES (
    v_quote.job_id, p_quote_id, p_customer_id, v_quote.mechanic_id,
    'active', v_quote.price_cents, v_platform_fee_cents, v_quote.estimated_hours,
    v_quote.price_cents, v_total_customer_cents, v_commission_cents, v_mechanic_payout_cents,
    now()
  )
  RETURNING id INTO v_contract_id;
  
  -- Update job_acknowledgements with contract_id
  UPDATE public.job_acknowledgements
  SET contract_id = v_contract_id
  WHERE job_id = v_quote.job_id AND user_id = p_customer_id AND role = 'customer';
  
  -- Create initial line item for base labor
  INSERT INTO public.invoice_line_items (
    contract_id, item_type, description, quantity, unit_price_cents, total_cents,
    approval_status, requires_approval, added_by, added_by_role, sort_order
  ) VALUES (
    v_contract_id, 'base_labor', 'Service as quoted', 1, v_quote.price_cents, v_quote.price_cents,
    'approved', false, v_quote.mechanic_id, 'mechanic', 0
  )
  RETURNING id INTO v_line_item_id;
  
  -- Create platform fee line item
  INSERT INTO public.invoice_line_items (
    contract_id, item_type, description, quantity, unit_price_cents, total_cents,
    approval_status, requires_approval, added_by, added_by_role, sort_order
  ) VALUES (
    v_contract_id, 'platform_fee', 'WrenchGo platform fee', 1, v_platform_fee_cents, v_platform_fee_cents,
    'approved', false, p_customer_id, 'customer', 100
  );
  
  -- Create job progress record
  INSERT INTO public.job_progress (job_id, contract_id)
  VALUES (v_quote.job_id, v_contract_id)
  RETURNING id INTO v_progress_id;
  
  -- Update quote status
  UPDATE public.quotes
  SET status = 'accepted', updated_at = now()
  WHERE id = p_quote_id;
  
  -- Decline all other quotes for this job
  UPDATE public.quotes
  SET status = 'declined', updated_at = now()
  WHERE job_id = v_quote.job_id AND id != p_quote_id;
  
  -- Update job status
  UPDATE public.jobs
  SET 
    status = 'accepted',
    accepted_mechanic_id = v_quote.mechanic_id,
    updated_at = now()
  WHERE id = v_quote.job_id;
  
  -- Log event
  PERFORM log_job_event(
    v_quote.job_id, v_contract_id, 'contract_created',
    p_customer_id, 'customer',
    'Contract created',
    'Quote accepted and contract created',
    jsonb_build_object(
      'quoted_price_cents', v_quote.price_cents,
      'platform_fee_cents', v_platform_fee_cents,
      'total_cents', v_total_customer_cents
    ),
    v_total_customer_cents
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract_id,
    'total_cents', v_total_customer_cents,
    'mechanic_id', v_quote.mechanic_id
  );
END;
$$;

-- =====================================================
-- UPDATED RPC: mechanic_start_work (with enforcement)
-- =====================================================
CREATE OR REPLACE FUNCTION mechanic_start_work(
  p_job_id uuid,
  p_mechanic_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract RECORD;
  v_terms_check jsonb;
BEGIN
  -- ENFORCEMENT: Check platform terms accepted
  v_terms_check := public.check_terms_accepted('mechanic');
  IF NOT (v_terms_check->>'accepted')::boolean THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Please accept platform terms first',
      'requires_terms', true,
      'terms_version', v_terms_check->>'version'
    );
  END IF;

  -- ENFORCEMENT: Check job acknowledgement exists
  IF NOT EXISTS (
    SELECT 1 FROM public.job_acknowledgements
    WHERE job_id = p_job_id 
    AND user_id = p_mechanic_id 
    AND role = 'mechanic'
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Please acknowledge job terms first',
      'requires_acknowledgement', true,
      'job_id', p_job_id
    );
  END IF;

  -- Get contract with lock
  SELECT c.*, jp.customer_confirmed_arrival_at, jp.work_started_at
  INTO v_contract
  FROM public.job_contracts c
  JOIN public.job_progress jp ON jp.contract_id = c.id
  WHERE c.job_id = p_job_id AND c.mechanic_id = p_mechanic_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract is not active');
  END IF;
  
  IF v_contract.work_started_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Work already started');
  END IF;
  
  -- Update progress and set mechanic_acknowledged_at
  UPDATE public.job_progress
  SET 
    work_started_at = now(),
    updated_at = now()
  WHERE contract_id = v_contract.id;

  UPDATE public.job_contracts
  SET mechanic_acknowledged_at = COALESCE(mechanic_acknowledged_at, now())
  WHERE id = v_contract.id;
  
  -- Update job status
  UPDATE public.jobs
  SET status = 'in_progress', updated_at = now()
  WHERE id = p_job_id;
  
  -- Log event
  PERFORM log_job_event(
    p_job_id, v_contract.id, 'work_started',
    p_mechanic_id, 'mechanic',
    'Work started',
    'Mechanic has begun working on the vehicle',
    jsonb_build_object()
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT ON public.platform_terms_versions TO authenticated;
GRANT SELECT, INSERT ON public.platform_terms_acceptances TO authenticated;
GRANT SELECT, INSERT ON public.job_acknowledgements TO authenticated;

COMMIT;
