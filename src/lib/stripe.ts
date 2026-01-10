import { supabase } from './supabase';

export interface MechanicStripeAccount {
  id: string;
  mechanic_id: string;
  stripe_account_id: string;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
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
    account.onboarding_complete &&
    account.charges_enabled &&
    account.payouts_enabled
  );
}

export function getStripeAccountStatusMessage(account: MechanicStripeAccount | null): string {
  if (!account) {
    return 'Set up your payout account to start accepting paid jobs';
  }

  if (account.onboarding_complete && account.charges_enabled && account.payouts_enabled) {
    return 'Your payout account is active';
  }

  if (account.onboarding_complete && (!account.charges_enabled || !account.payouts_enabled)) {
    return 'Your account is being verified by Stripe. This usually takes a few minutes.';
  }

  return 'Complete your payout account setup to accept payments';
}

export function shouldShowStripeOnboarding(account: MechanicStripeAccount | null): boolean {
  if (!account) {
    return true;
  }

  return !account.charges_enabled || !account.payouts_enabled || !account.onboarding_complete;
}