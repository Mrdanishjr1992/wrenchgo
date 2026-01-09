-- Update invitation rewards:
-- Invite customer: 1 job fee waived (FEELESS)
-- Invite mechanic: 3 job fees waived (FEELESS)

CREATE OR REPLACE FUNCTION public.award_invitation_credits(
  p_invited_id uuid,
  p_payment_id uuid DEFAULT NULL,
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
  v_credit_type text;
  v_credit_uses int;
  v_credit_id uuid;
BEGIN
  SELECT * INTO v_invitation
  FROM invitations
  WHERE invited_id = p_invited_id;
  
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No invitation found for user');
  END IF;
  
  -- Determine award based on invited_role
  -- Invite CUSTOMER -> 1 FEELESS credit (1 job fee waived)
  -- Invite MECHANIC -> 3 FEELESS credits (3 job fees waived)
  IF v_invitation.invited_role = 'customer' THEN
    v_award_type := 'FEELESS_1';
    v_credit_type := 'FEELESS';
    v_credit_uses := 1;
  ELSE -- mechanic
    v_award_type := 'FEELESS_3';
    v_credit_type := 'FEELESS';
    v_credit_uses := 3;
  END IF;
  
  -- Try to insert award (unique constraint prevents duplicates)
  BEGIN
    INSERT INTO invitation_awards (inviter_id, invited_id, award_type, payment_id, stripe_event_id)
    VALUES (v_invitation.inviter_id, p_invited_id, v_award_type, p_payment_id, p_stripe_event_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Award already granted for this invited user');
  END;
  
  -- Create promo credit for inviter
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