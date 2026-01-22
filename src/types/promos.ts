export interface PromoCredit {
  id: string;
  user_id: string;
  credit_type: 'FEELESS' | 'FEELESS3';
  remaining_uses: number;
  source_invited_user_id: string | null;
  source_invitation_id: string | null;
  created_at: string;
}

export interface PromoCreditsBalance {
  feeless_credits: number;
  feeless3_credits: number;
  total_credits: number;
}

export interface PromoDiscountPreview {
  has_discount: boolean;
  credit_type?: 'FEELESS' | 'FEELESS3';
  discount_cents: number;
  fee_after_cents: number;
  reason?: string;
}

export interface PromoApplicationResult {
  applied: boolean;
  credit_type?: 'FEELESS' | 'FEELESS3';
  fee_before_cents?: number;
  discount_cents?: number;
  fee_after_cents?: number;
  application_id?: string;
  reason?: string;
}

export interface Invitation {
  id: string;
  inviter_id: string;
  invited_id: string;
  inviter_role: 'customer' | 'mechanic';
  invited_role: 'customer' | 'mechanic';
  created_at: string;
}

export interface InvitationStatus {
  was_invited: boolean;
  inviter_name?: string;
  invited_at?: string;
  award_granted_to_inviter?: boolean;
}

export interface MyInvitation {
  invited_id: string;
  invited_name: string;
  invited_role: 'customer' | 'mechanic';
  invited_at: string;
  award_granted: boolean;
}
