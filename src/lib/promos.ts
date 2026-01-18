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
    p_code: inviteCode,
  });
  if (error) {
    console.error('Error accepting invitation:', error);
    return { success: false, error: error.message };
  }
  return data;
}

export async function hasUsedReferral(): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_used_referral');
  if (error) {
    console.error('Error checking referral status:', error);
    return false;
  }
  return data === true;
}

export async function getPromoCreditsBalance(): Promise<PromoCreditsBalance | null> {
  const { data, error } = await supabase.rpc('get_user_promo_credits');
  if (error || !data?.success) {
    console.error('Error getting promo credits:', error || data?.error);
    return null;
  }
  return {
    feeless_credits: data.feeless_credits,
    feeless3_credits: data.feeless3_credits,
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
  if (balance.feeless3_credits > 0) {
    parts.push(`${balance.feeless3_credits} x $3 off`);
  }
  return parts.length > 0 ? parts.join(', ') : 'No credits';
}

export function getPromoDiscountDescription(creditType: 'FEELESS' | 'FEELESS3'): string {
  return creditType === 'FEELESS'
    ? 'Free platform fee (referral credit)'
    : '$3 off platform fee (referral credit)';
}

export async function applyPromoCredit(jobId: string): Promise<{
  success: boolean;
  has_credit?: boolean;
  credit_type?: string;
  discount_cents?: number;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('apply_promo_credit_to_job', {
    p_job_id: jobId,
  });
  if (error) {
    console.error('Error applying promo credit:', error);
    return { success: false, error: error.message };
  }
  return data;
}

export async function applyPromoToPayment(paymentId: string, platformFeeCents: number = 1500): Promise<{
  success: boolean;
  has_credit?: boolean;
  credit_type?: string;
  discount_cents?: number;
  fee_after_cents?: number;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('apply_promo_to_payment', {
    p_payment_id: paymentId,
    p_platform_fee_cents: platformFeeCents,
  });
  if (error) {
    console.error('Error applying promo to payment:', error);
    return { success: false, error: error.message };
  }
  return data;
}

export async function getJobPromoInfo(jobId: string): Promise<{
  success: boolean;
  has_promo?: boolean;
  discount_cents?: number;
  credit_type?: string;
  discount_description?: string;
  error?: string;
} | null> {
  const { data, error } = await supabase.rpc('get_job_promo_info', {
    p_job_id: jobId,
  });
  if (error) {
    console.error('Error getting job promo info:', error);
    return null;
  }
  return data;
}

export async function getPaymentPromoInfo(paymentId: string): Promise<{
  has_promo: boolean;
  credit_type?: string;
  fee_before_cents?: number;
  discount_cents?: number;
  fee_after_cents?: number;
  discount_description?: string;
} | null> {
  const { data, error } = await supabase.rpc('get_payment_promo_info', {
    p_payment_id: paymentId,
  });
  if (error) {
    console.error('Error getting payment promo info:', error);
    return null;
  }
  return data;
}

export async function retroactiveApplyPromo(jobId: string): Promise<{
  success: boolean;
  has_credit?: boolean;
  credit_type?: string;
  discount_cents?: number;
  fee_after_cents?: number;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('retroactive_apply_promo', {
    p_job_id: jobId,
  });
  if (error) {
    console.error('Error applying retroactive promo:', error);
    return { success: false, error: error.message };
  }
  return data;
}

export async function previewMechanicPromoDiscount(commissionCents: number): Promise<{
  success: boolean;
  has_discount: boolean;
  credit_type?: string;
  discount_cents?: number;
  commission_after_cents?: number;
  reason?: string;
} | null> {
  const { data, error } = await supabase.rpc('preview_mechanic_promo_discount', {
    p_commission_cents: commissionCents,
  });
  if (error) {
    console.error('Error previewing mechanic promo discount:', error);
    return null;
  }
  return data;
}

export async function getContractMechanicPromoInfo(contractId: string): Promise<{
  has_promo: boolean;
  credit_type?: string;
  commission_before_cents?: number;
  discount_cents?: number;
  commission_after_cents?: number;
  discount_description?: string;
} | null> {
  const { data, error } = await supabase.rpc('get_contract_mechanic_promo_info', {
    p_contract_id: contractId,
  });
  if (error) {
    console.error('Error getting contract mechanic promo info:', error);
    return null;
  }
  return data;
}

export function getMechanicPromoDiscountDescription(creditType: 'FEELESS' | 'FEELESS3'): string {
  return creditType === 'FEELESS'
    ? 'Free commission (referral credit)'
    : '$3 off commission (referral credit)';
}
