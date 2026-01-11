-- MIGRATION 0078: Fix Referral System - Immediate Rewards
-- 
-- Flow:
-- 1. User1 shares their referral code with User2
-- 2. User2 enters the code (can only do this ONCE ever)
-- 3. User1 gets rewarded IMMEDIATELY (1 credit for customer, 3 for mechanic)
-- 4. User2 can now share their own code with others

BEGIN;

-- Drop and recreate accept_invitation to grant rewards immediately
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
  v_already_used_code boolean;
  v_invitation_id uuid;
  v_credit_uses int;
  v_credit_id uuid;
BEGIN
  v_invited_id := auth.uid();
  
  IF v_invited_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check if this user has EVER used a referral code before
  SELECT EXISTS(SELECT 1 FROM invitations WHERE invited_id = v_invited_id) INTO v_already_used_code;
  IF v_already_used_code THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used a referral code');
  END IF;
  
  -- Get invite code details
  SELECT ic.id, ic.inviter_id INTO v_invite_code_id, v_inviter_id
  FROM invite_codes ic
  WHERE ic.code = upper(trim(p_invite_code))
    AND (ic.expires_at IS NULL OR ic.expires_at > now())
    AND (ic.max_uses IS NULL OR ic.current_uses < ic.max_uses);
  
  IF v_inviter_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired referral code');
  END IF;
  
  -- No self-invites
  IF v_inviter_id = v_invited_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;
  
  -- Get roles
  SELECT role INTO v_inviter_role FROM profiles WHERE id = v_inviter_id;
  SELECT role INTO v_invited_role FROM profiles WHERE id = v_invited_id;
  
  IF v_inviter_role IS NULL OR v_invited_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profiles not found');
  END IF;
  
  -- Create invitation record (this also prevents future code usage due to unique constraint)
  INSERT INTO invitations (inviter_id, invited_id, inviter_role, invited_role, invite_code_id)
  VALUES (v_inviter_id, v_invited_id, v_inviter_role, v_invited_role, v_invite_code_id)
  RETURNING id INTO v_invitation_id;
  
  -- Increment invite code usage
  UPDATE invite_codes SET current_uses = current_uses + 1 WHERE id = v_invite_code_id;
  
  -- IMMEDIATELY grant reward to inviter
  -- Customer invitee = 1 FEELESS credit
  -- Mechanic invitee = 3 FEELESS credits
  IF v_invited_role = 'customer' THEN
    v_credit_uses := 1;
  ELSE
    v_credit_uses := 3;
  END IF;
  
  -- Create promo credit for the INVITER (the person who shared the code)
  INSERT INTO promo_credits (user_id, credit_type, remaining_uses, source_invited_user_id, source_invitation_id)
  VALUES (v_inviter_id, 'FEELESS', v_credit_uses, v_invited_id, v_invitation_id)
  RETURNING id INTO v_credit_id;
  
  -- Record the award for audit
  INSERT INTO invitation_awards (inviter_id, invited_id, award_type, created_at)
  VALUES (v_inviter_id, v_invited_id, 
          CASE WHEN v_invited_role = 'customer' THEN 'FEELESS_1' ELSE 'FEELESS_3' END,
          now())
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true, 
    'inviter_id', v_inviter_id,
    'credits_awarded', v_credit_uses,
    'message', 'Referral code applied! The person who invited you has been rewarded.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- Ensure invitation_awards table exists with proper structure
CREATE TABLE IF NOT EXISTS public.invitation_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  award_type text NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  stripe_event_id text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add unique constraint on invited_id if not exists (one award per invited user)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invitation_awards_invited_id_key'
  ) THEN
    ALTER TABLE public.invitation_awards ADD CONSTRAINT invitation_awards_invited_id_key UNIQUE (invited_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- RLS for invitation_awards
ALTER TABLE public.invitation_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitation_awards_select ON public.invitation_awards;
CREATE POLICY invitation_awards_select ON public.invitation_awards
  FOR SELECT USING (inviter_id = auth.uid() OR invited_id = auth.uid());

COMMIT;
