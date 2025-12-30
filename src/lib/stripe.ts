import { supabase } from './supabase';

export interface MechanicStripeAccount {
  id: string;
  mechanic_id: string;
  stripe_account_id: string;
  status: 'not_started' | 'pending' | 'active' | 'restricted' | 'rejected';
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_url: string | null;
  onboarding_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMechanicStripeAccount(
  mechanicId: string
): Promise<MechanicStripeAccount | null> {
  const { data, error } = await supabase
    .from('mechanic_stripe_accounts')
    .select('*')
    .eq('mechanic_id', mechanicId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching mechanic Stripe account:', error);
    return null;
  }

  return data;
}

export async function createStripeConnectAccountLink(): Promise<{
  url: string;
  accountId: string;
  status: string;
}> {
  const { data, error } = await supabase.functions.invoke('stripe-connect-create-account-link', {
    body: {},
  });

  if (error) {
    throw new Error(error.message || 'Failed to create Stripe Connect account link');
  }

  return data;
}

export async function refreshStripeAccountStatus(mechanicId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('stripe-connect-refresh-status', {
    body: { mechanicId },
  });

  if (error) {
    throw new Error(error.message || 'Failed to refresh Stripe account status');
  }
}

export function isStripeAccountReady(account: MechanicStripeAccount | null): boolean {
  return (
    account !== null &&
    account.status === 'active' &&
    account.charges_enabled &&
    account.payouts_enabled &&
    account.details_submitted
  );
}

export function getStripeAccountStatusMessage(account: MechanicStripeAccount | null): string {
  if (!account) {
    return 'Set up your payout account to start accepting paid jobs';
  }

  if (account.status === 'active' && account.charges_enabled && account.payouts_enabled) {
    return 'Your payout account is active';
  }

  if (account.status === 'pending') {
    return 'Complete your payout account setup to accept payments';
  }

  if (account.status === 'restricted') {
    return 'Your payout account is restricted. Please contact support';
  }

  if (account.status === 'rejected') {
    return 'Your payout account application was rejected';
  }

  return 'Set up your payout account';
}

export function shouldShowStripeOnboarding(account: MechanicStripeAccount | null): boolean {
  if (!account) {
    return true;
  }

  return !account.charges_enabled || !account.payouts_enabled || !account.details_submitted;
}
