import { supabase } from './supabase';
import type {
  PromoCreditsBalance,
  PromoDiscountPreview,
  InvitationStatus,
  MyInvitation,
} from '../types/promos';

export async function getOrCreateInviteCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_invite_code');
  if (error) {
    console.error('Error getting invite code:', error);
    return null;
  }
  return data;
}

export async function acceptInvitation(inviteCode: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('accept_invitation', {
    p_invite_code: inviteCode,
  });
  if (error) {
    console.error('Error accepting invitation:', error);
    return { success: false, error: error.message };
  }
  return data;
}

export async function getPromoCreditsBalance(): Promise<PromoCreditsBalance | null> {
  const { data, error } = await supabase.rpc('get_user_promo_credits');
  if (error || !data?.success) {
    console.error('Error getting promo credits:', error || data?.error);
    return null;
  }
  return {
    feeless_credits: data.feeless_credits,
    feeoff5_credits: data.feeoff5_credits,
    total_credits: data.total_credits,
  };
}

export async function previewPromoDiscount(platformFeeCents: number): Promise<PromoDiscountPreview | null> {
  const { data, error } = await supabase.rpc('preview_promo_discount', {
    p_platform_fee_cents: platformFeeCents,
  });
  if (error || !data?.success) {
    console.error('Error previewing promo discount:', error || data?.error);
    return null;
  }
  return {
    has_discount: data.has_discount,
    credit_type: data.credit_type,
    discount_cents: data.discount_cents,
    fee_after_cents: data.fee_after_cents,
    reason: data.reason,
  };
}

export async function getInvitationStatus(): Promise<InvitationStatus | null> {
  const { data, error } = await supabase.rpc('get_invitation_status');
  if (error || !data?.success) {
    console.error('Error getting invitation status:', error || data?.error);
    return null;
  }
  return {
    was_invited: data.was_invited,
    inviter_name: data.inviter_name,
    invited_at: data.invited_at,
    award_granted_to_inviter: data.award_granted_to_inviter,
  };
}

export async function getMyInvitations(): Promise<MyInvitation[]> {
  const { data, error } = await supabase.rpc('get_my_invitations');
  if (error || !data?.success) {
    console.error('Error getting my invitations:', error || data?.error);
    return [];
  }
  return data.invitations || [];
}

export function formatPromoCredits(balance: PromoCreditsBalance): string {
  const parts: string[] = [];
  if (balance.feeless_credits > 0) {
    parts.push(`${balance.feeless_credits} free fee${balance.feeless_credits > 1 ? 's' : ''}`);
  }
  if (balance.feeoff5_credits > 0) {
    parts.push(`${balance.feeoff5_credits} x $5 off`);
  }
  return parts.length > 0 ? parts.join(', ') : 'No credits';
}

export function getPromoDiscountDescription(creditType: 'FEELESS' | 'FEEOFF5'): string {
  return creditType === 'FEELESS' 
    ? 'Free platform fee (referral credit)' 
    : '$5 off platform fee (referral credit)';
}
