-- =====================================================
-- MIGRATION 0027: INVITATION PROMO SYSTEM
-- =====================================================
-- Purpose: Implement referral/invitation system with promo credits
-- Awards: Inviter earns credits when invited user completes first paid fee transaction
-- =====================================================

BEGIN;

-- =====================================================
-- ENUM: promo_credit_type
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.promo_credit_type AS ENUM ('FEELESS', 'FEELESS3');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TABLE: invite_codes
-- =====================================================
-- Shareable invite codes for users
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT NULL,
  max_uses int DEFAULT NULL,
  current_uses int DEFAULT 0 NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_inviter ON public.invite_codes(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);

COMMENT ON TABLE public.invite_codes IS 'Shareable invite codes for referral system';

-- =====================================================
-- TABLE: invitations
-- =====================================================
-- Tracks who invited whom (invited_id is unique - can only be invited once)
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inviter_role public.user_role NOT NULL,
  invited_role public.user_role NOT NULL,
  invite_code_id uuid REFERENCES public.invite_codes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT invitations_no_self_invite CHECK (inviter_id != invited_id),
  CONSTRAINT invitations_invited_unique UNIQUE (invited_id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_inviter ON public.invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invited ON public.invitations(invited_id);

COMMENT ON TABLE public.invitations IS 'Tracks invitation relationships between users';

-- =====================================================
-- TABLE: promo_credits
-- =====================================================
-- Individual credit buckets for FIFO consumption
CREATE TABLE IF NOT EXISTS public.promo_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_type public.promo_credit_type NOT NULL,
  remaining_uses int NOT NULL CHECK (remaining_uses >= 0),
  source_invited_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_invitation_id uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_promo_credits_user_created ON public.promo_credits(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_promo_credits_user_remaining ON public.promo_credits(user_id, remaining_uses) WHERE remaining_uses > 0;

COMMENT ON TABLE public.promo_credits IS 'Promo credit buckets for fee discounts (FIFO consumption)';

-- =====================================================
-- TABLE: invitation_awards
-- =====================================================
-- Idempotency + audit for awards (unique on invited_id ensures one award per invited user)
ALTER TABLE public.invitation_awards
DROP CONSTRAINT IF EXISTS invitation_awards_award_type_check;

ALTER TABLE public.invitation_awards
ADD CONSTRAINT invitation_awards_award_type_check
CHECK (award_type IN ('FEELESS_1', 'FEELESS_3'));

CREATE UNIQUE INDEX IF NOT EXISTS invitation_awards_stripe_event_id_unique
ON public.invitation_awards (stripe_event_id)
WHERE stripe_event_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_invitation_awards_inviter ON public.invitation_awards(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitation_awards_invited ON public.invitation_awards(invited_id);

COMMENT ON TABLE public.invitation_awards IS 'Audit trail for invitation awards (one per invited user)';

-- =====================================================
-- TABLE: payment_promo_applications
-- =====================================================
-- Immutable record of promo redemption per payment (unique on payment_id)
CREATE TABLE IF NOT EXISTS public.payment_promo_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  promo_credit_id uuid REFERENCES public.promo_credits(id) ON DELETE SET NULL,
  credit_type public.promo_credit_type NOT NULL,
  fee_before_cents int NOT NULL,
  discount_cents int NOT NULL,
  fee_after_cents int NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT valid_promo_amounts CHECK (
    fee_before_cents >= 0 AND
    discount_cents >= 0 AND
    fee_after_cents >= 0 AND
    fee_after_cents = fee_before_cents - discount_cents
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_promo_applications_payment ON public.payment_promo_applications(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_promo_applications_credit ON public.payment_promo_applications(promo_credit_id);

COMMENT ON TABLE public.payment_promo_applications IS 'Immutable record of promo credit redemption per payment';

-- =====================================================
-- TABLE: promotions (for validate-promotion edge function)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('percent_discount', 'fixed_discount', 'waive_platform_fee')),
  description text,
  percent_off numeric CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
  amount_cents int CHECK (amount_cents IS NULL OR amount_cents > 0),
  minimum_amount_cents int DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  max_redemptions int,
  max_redemptions_per_user int DEFAULT 1,
  current_redemptions int DEFAULT 0,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_promotions_code ON public.promotions(code) WHERE active = true;

COMMENT ON TABLE public.promotions IS 'Manual promo codes for validate-promotion edge function';

-- =====================================================
-- TABLE: promotion_redemptions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_promotion_user ON public.promotion_redemptions(promotion_id, user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_user ON public.promotion_redemptions(user_id);

COMMENT ON TABLE public.promotion_redemptions IS 'Tracks manual promo code redemptions';

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- invite_codes
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY invite_codes_select ON public.invite_codes
  FOR SELECT USING (inviter_id = auth.uid());

CREATE POLICY invite_codes_insert ON public.invite_codes
  FOR INSERT WITH CHECK (inviter_id = auth.uid());

CREATE POLICY invite_codes_update ON public.invite_codes
  FOR UPDATE USING (inviter_id = auth.uid());

-- invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitations_select ON public.invitations
  FOR SELECT USING (inviter_id = auth.uid() OR invited_id = auth.uid());

CREATE POLICY invitations_insert ON public.invitations
  FOR INSERT WITH CHECK (inviter_id = auth.uid());

-- promo_credits (read own, writes via RPC/service role)
ALTER TABLE public.promo_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY promo_credits_select ON public.promo_credits
  FOR SELECT USING (user_id = auth.uid());

-- invitation_awards (read own)
ALTER TABLE public.invitation_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitation_awards_select ON public.invitation_awards
  FOR SELECT USING (inviter_id = auth.uid() OR invited_id = auth.uid());

-- payment_promo_applications (read via payment ownership)
ALTER TABLE public.payment_promo_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_promo_applications_select ON public.payment_promo_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_promo_applications.payment_id
      AND (p.customer_id = auth.uid() OR p.mechanic_id = auth.uid())
    )
  );

-- promotions (public read for active)
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY promotions_select ON public.promotions
  FOR SELECT USING (active = true);

-- promotion_redemptions (read own)
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY promotion_redemptions_select ON public.promotion_redemptions
  FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- FUNCTION: generate_invite_code
-- =====================================================
-- Generates a unique 8-character invite code for a user
CREATE OR REPLACE FUNCTION public.generate_invite_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    -- Generate 8-char alphanumeric code
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- Check if exists
    SELECT EXISTS(SELECT 1 FROM invite_codes WHERE code = v_code) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  INSERT INTO invite_codes (code, inviter_id)
  VALUES (v_code, p_user_id)
  ON CONFLICT (code) DO NOTHING;
  
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_invite_code(uuid) TO authenticated;

-- =====================================================
-- FUNCTION: get_or_create_invite_code
-- =====================================================
-- Gets existing invite code or creates new one for user
CREATE OR REPLACE FUNCTION public.get_or_create_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_code text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Try to get existing code
  SELECT code INTO v_code
  FROM invite_codes
  WHERE inviter_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_code IS NULL THEN
    v_code := generate_invite_code(v_user_id);
  END IF;
  
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_invite_code() TO authenticated;

-- =====================================================
-- FUNCTION: accept_invitation
-- =====================================================
-- Called when a new user signs up with an invite code
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_id uuid;
  v_invited_role public.user_role;
  v_inviter_id uuid;
  v_inviter_role public.user_role;
  v_invite_code_id uuid;
  v_already_invited boolean;
BEGIN
  v_invited_id := auth.uid();
  
  IF v_invited_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check if already invited
  SELECT EXISTS(SELECT 1 FROM invitations WHERE invited_id = v_invited_id) INTO v_already_invited;
  IF v_already_invited THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already invited by another user');
  END IF;
  
  -- Get invite code details
  SELECT ic.id, ic.inviter_id INTO v_invite_code_id, v_inviter_id
  FROM invite_codes ic
  WHERE ic.code = upper(p_invite_code)
    AND (ic.expires_at IS NULL OR ic.expires_at > now())
    AND (ic.max_uses IS NULL OR ic.current_uses < ic.max_uses);
  
  IF v_inviter_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite code');
  END IF;
  
  -- No self-invites
  IF v_inviter_id = v_invited_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own invite code');
  END IF;
  
  -- Get roles
  SELECT role INTO v_inviter_role FROM profiles WHERE id = v_inviter_id;
  SELECT role INTO v_invited_role FROM profiles WHERE id = v_invited_id;
  
  IF v_inviter_role IS NULL OR v_invited_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profiles not found');
  END IF;
  
  -- Create invitation
  INSERT INTO invitations (inviter_id, invited_id, inviter_role, invited_role, invite_code_id)
  VALUES (v_inviter_id, v_invited_id, v_inviter_role, v_invited_role, v_invite_code_id);
  
  -- Increment invite code usage
  UPDATE invite_codes SET current_uses = current_uses + 1 WHERE id = v_invite_code_id;
  
  RETURN jsonb_build_object('success', true, 'inviter_id', v_inviter_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- =====================================================
-- FUNCTION: award_invitation_credits
-- =====================================================
-- Called by webhook when invited user completes first qualifying paid transaction
-- Idempotent: unique constraint on invitation_awards.invited_id prevents double awards
CREATE OR REPLACE FUNCTION public.award_invitation_credits(
  p_invited_id uuid,
  p_payment_id uuid,
  p_stripe_event_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_award_type text;
  v_credit_type public.promo_credit_type := 'FEELESS';
  v_credit_uses int;
  v_credit_id uuid;
BEGIN
  -- Get invitation details
  SELECT * INTO v_invitation
  FROM invitations
  WHERE invited_id = p_invited_id;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No invitation found for user');
  END IF;

  -- New rules:
  -- Invite CUSTOMER -> 1 FEELESS use
  -- Invite MECHANIC -> 3 FEELESS uses
  IF v_invitation.invited_role = 'customer' THEN
    v_award_type := 'FEELESS_1';
    v_credit_uses := 1;
  ELSIF v_invitation.invited_role = 'mechanic' THEN
    v_award_type := 'FEELESS_3';
    v_credit_uses := 3;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid invited_role on invitation',
      'invited_role', v_invitation.invited_role
    );
  END IF;

  -- Insert award (idempotent by UNIQUE(invited_id))
  BEGIN
    INSERT INTO invitation_awards (inviter_id, invited_id, award_type, payment_id, stripe_event_id)
    VALUES (v_invitation.inviter_id, p_invited_id, v_award_type, p_payment_id, p_stripe_event_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Award already granted for this invited user');
  END;

  -- Create promo credit bucket for inviter
  INSERT INTO promo_credits (user_id, credit_type, remaining_uses, source_invited_user_id, source_invitation_id)
  VALUES (v_invitation.inviter_id, v_credit_type, v_credit_uses, p_invited_id, v_invitation.id)
  RETURNING id INTO v_credit_id;

  RETURN jsonb_build_object(
    'success', true,
    'inviter_id', v_invitation.inviter_id,
    'award_type', v_award_type,
    'credit_id', v_credit_id,
    'credit_uses', v_credit_uses
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_invitation_credits(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_invitation_credits(uuid, uuid, text) FROM authenticated;


-- =====================================================
-- FUNCTION: get_user_promo_credits
-- =====================================================
-- Returns user's available promo credits summary
CREATE OR REPLACE FUNCTION public.get_user_promo_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_feeless_count int;
  v_feeless3_count int;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT COALESCE(SUM(remaining_uses), 0) INTO v_feeless_count
  FROM promo_credits
  WHERE user_id = v_user_id AND credit_type = 'FEELESS' AND remaining_uses > 0;

  SELECT COALESCE(SUM(remaining_uses), 0) INTO v_feeless3_count
  FROM promo_credits
  WHERE user_id = v_user_id AND credit_type = 'FEELESS3' AND remaining_uses > 0;

  RETURN jsonb_build_object(
    'success', true,
    'feeless_credits', v_feeless_count,
    'feeless3_credits', v_feeless3_count,
    'total_credits', v_feeless_count + v_feeless3_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_promo_credits() TO authenticated;

-- =====================================================
-- FUNCTION: preview_promo_discount
-- =====================================================
-- Preview what discount would apply (read-only, no consumption)
CREATE OR REPLACE FUNCTION public.preview_promo_discount(p_platform_fee_cents int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_credit record;
  v_discount_cents int;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_platform_fee_cents <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_discount', false,
      'discount_cents', 0,
      'fee_after_cents', 0,
      'reason', 'No platform fee to discount'
    );
  END IF;

  -- Get oldest available credit, prioritizing FEELESS over FEELESS3
  SELECT * INTO v_credit
  FROM promo_credits
  WHERE user_id = v_user_id AND remaining_uses > 0
  ORDER BY
    CASE credit_type WHEN 'FEELESS' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_credit IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_discount', false,
      'discount_cents', 0,
      'fee_after_cents', p_platform_fee_cents,
      'reason', 'No promo credits available'
    );
  END IF;

  -- Calculate discount
  IF v_credit.credit_type = 'FEELESS' THEN
    v_discount_cents := p_platform_fee_cents;
  ELSE -- FEELESS3
    v_discount_cents := LEAST(500, p_platform_fee_cents);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'has_discount', true,
    'credit_type', v_credit.credit_type,
    'discount_cents', v_discount_cents,
    'fee_after_cents', p_platform_fee_cents - v_discount_cents
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_promo_discount(int) TO authenticated;

-- =====================================================
-- FUNCTION: apply_promo_to_payment
-- =====================================================
-- Atomically applies best available promo credit to a payment
-- Must be called within payment finalization flow
CREATE OR REPLACE FUNCTION public.apply_promo_to_payment(
  p_payment_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_credit record;
  v_fee_before int;
  v_discount_cents int;
  v_fee_after int;
  v_application_id uuid;
BEGIN
  -- Lock payment row
  SELECT * INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;
  
  -- Check if promo already applied
  IF EXISTS(SELECT 1 FROM payment_promo_applications WHERE payment_id = p_payment_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo already applied to this payment');
  END IF;
  
  v_fee_before := COALESCE(v_payment.platform_fee_cents, 0);
  
  -- If no fee, nothing to discount
  IF v_fee_before <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'applied', false,
      'reason', 'No platform fee to discount'
    );
  END IF;
  
  -- Get oldest available credit for user, prioritizing FEELESS
  SELECT * INTO v_credit
  FROM promo_credits
  WHERE user_id = p_user_id AND remaining_uses > 0
  ORDER BY 
    CASE credit_type WHEN 'FEELESS' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1
  FOR UPDATE;
  
  IF v_credit IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'applied', false,
      'reason', 'No promo credits available'
    );
  END IF;
  
  -- Calculate discount
  IF v_credit.credit_type = 'FEELESS' THEN
    v_discount_cents := v_fee_before;
  ELSE -- FEELESS3
    v_discount_cents := LEAST(500, v_fee_before);
  END IF;
  
  v_fee_after := v_fee_before - v_discount_cents;
  
  -- Decrement credit
  UPDATE promo_credits
  SET remaining_uses = remaining_uses - 1, updated_at = now()
  WHERE id = v_credit.id;
  
  -- Record application (immutable)
  INSERT INTO payment_promo_applications (
    payment_id, promo_credit_id, credit_type, fee_before_cents, discount_cents, fee_after_cents
  )
  VALUES (
    p_payment_id, v_credit.id, v_credit.credit_type, v_fee_before, v_discount_cents, v_fee_after
  )
  RETURNING id INTO v_application_id;
  
  -- Update payment with discount (if payment has a discount column, otherwise store in metadata)
  -- Note: payments table may not have discount_cents column, so we update platform_fee_cents
  UPDATE payments
  SET platform_fee_cents = v_fee_after,
      updated_at = now()
  WHERE id = p_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'applied', true,
    'credit_type', v_credit.credit_type,
    'fee_before_cents', v_fee_before,
    'discount_cents', v_discount_cents,
    'fee_after_cents', v_fee_after,
    'application_id', v_application_id
  );
END;
$$;

-- Only service role should call this (from payment flow)
REVOKE EXECUTE ON FUNCTION public.apply_promo_to_payment(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_promo_to_payment(uuid, uuid) FROM authenticated;

-- =====================================================
-- FUNCTION: check_first_qualifying_payment
-- =====================================================
-- Checks if a payment is the user's first qualifying paid fee transaction
CREATE OR REPLACE FUNCTION public.check_first_qualifying_payment(
  p_user_id uuid,
  p_payment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_prior_paid boolean;
BEGIN
  -- Check if user has any prior succeeded payments with platform_fee_cents > 0
  -- excluding the current payment
  SELECT EXISTS(
    SELECT 1 FROM payments
    WHERE customer_id = p_user_id
      AND status = 'succeeded'
      AND platform_fee_cents > 0
      AND id != p_payment_id
  ) INTO v_has_prior_paid;
  
  RETURN NOT v_has_prior_paid;
END;
$$;

-- Only service role should call this
REVOKE EXECUTE ON FUNCTION public.check_first_qualifying_payment(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_first_qualifying_payment(uuid, uuid) FROM authenticated;

-- =====================================================
-- FUNCTION: get_invitation_status
-- =====================================================
-- Returns user's invitation status (who invited them, if anyone)
CREATE OR REPLACE FUNCTION public.get_invitation_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_invitation record;
  v_inviter_name text;
  v_award_granted boolean;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT * INTO v_invitation
  FROM invitations
  WHERE invited_id = v_user_id;
  
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'was_invited', false
    );
  END IF;
  
  SELECT COALESCE(display_name, full_name, 'A friend') INTO v_inviter_name
  FROM profiles
  WHERE id = v_invitation.inviter_id;
  
  SELECT EXISTS(SELECT 1 FROM invitation_awards WHERE invited_id = v_user_id) INTO v_award_granted;
  
  RETURN jsonb_build_object(
    'success', true,
    'was_invited', true,
    'inviter_name', v_inviter_name,
    'invited_at', v_invitation.created_at,
    'award_granted_to_inviter', v_award_granted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_status() TO authenticated;

-- =====================================================
-- FUNCTION: get_my_invitations
-- =====================================================
-- Returns list of users the current user has invited
CREATE OR REPLACE FUNCTION public.get_my_invitations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_invitations jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'invited_id', i.invited_id,
      'invited_name', COALESCE(p.display_name, p.full_name, 'User'),
      'invited_role', i.invited_role,
      'invited_at', i.created_at,
      'award_granted', EXISTS(SELECT 1 FROM invitation_awards ia WHERE ia.invited_id = i.invited_id)
    )
    ORDER BY i.created_at DESC
  ), '[]'::jsonb) INTO v_invitations
  FROM invitations i
  JOIN profiles p ON p.id = i.invited_id
  WHERE i.inviter_id = v_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'invitations', v_invitations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_invitations() TO authenticated;

-- =====================================================
-- GRANT SERVICE ROLE FULL ACCESS
-- =====================================================
-- Service role needs explicit grants to bypass RLS for these tables
GRANT ALL ON public.promo_credits TO service_role;
GRANT ALL ON public.invite_codes TO service_role;
GRANT ALL ON public.invitations TO service_role;
GRANT ALL ON public.invitation_awards TO service_role;
GRANT ALL ON public.payment_promo_applications TO service_role;
GRANT ALL ON public.promotions TO service_role;
GRANT ALL ON public.promotion_redemptions TO service_role;

COMMIT;