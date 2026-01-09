import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';

export type PaymentStatus = 'none' | 'pending' | 'active' | 'failed' | 'loading';

export type PaymentStatusState = {
  status: PaymentStatus;
  isReady: boolean;
  isLoading: boolean;
  lastChecked: number | null;
  error: string | null;
};

const CACHE_TTL_MS = 30000;

export function usePaymentStatus() {
  const [state, setState] = useState<PaymentStatusState>({
    status: 'loading',
    isReady: false,
    isLoading: true,
    lastChecked: null,
    error: null,
  });
  const [userId, setUserId] = useState<string | null>(null);
  const isMounted = useRef(true);

  const checkStatus = useCallback(async (force = false) => {
    if (!force && state.lastChecked && Date.now() - state.lastChecked < CACHE_TTL_MS) {
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (isMounted.current) {
          setState({
            status: 'none',
            isReady: false,
            isLoading: false,
            lastChecked: Date.now(),
            error: null,
          });
        }
        return;
      }

      setUserId(session.user.id);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('payment_method_status')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      const status = (profile?.payment_method_status as PaymentStatus) || 'none';

      if (isMounted.current) {
        setState({
          status,
          isReady: status === 'active',
          isLoading: false,
          lastChecked: Date.now(),
          error: null,
        });
      }
    } catch (e: any) {
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: e?.message || 'Failed to check payment status',
        }));
      }
    }
  }, [state.lastChecked]);

  useEffect(() => {
    isMounted.current = true;
    checkStatus(true);
    return () => { isMounted.current = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkStatus(true);
    }, [checkStatus])
  );

  const refresh = useCallback(() => checkStatus(true), [checkStatus]);

  return {
    ...state,
    userId,
    refresh,
  };
}

export type PayoutStatus = 'not_started' | 'pending' | 'active' | 'restricted' | 'rejected' | 'loading';

export type PayoutStatusState = {
  status: PayoutStatus;
  isReady: boolean;
  isLoading: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  lastChecked: number | null;
  error: string | null;
};

export function usePayoutStatus() {
  const [state, setState] = useState<PayoutStatusState>({
    status: 'loading',
    isReady: false,
    isLoading: true,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    lastChecked: null,
    error: null,
  });
  const [userId, setUserId] = useState<string | null>(null);
  const isMounted = useRef(true);

  const checkStatus = useCallback(async (force = false) => {
    if (!force && state.lastChecked && Date.now() - state.lastChecked < CACHE_TTL_MS) {
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (isMounted.current) {
          setState({
            status: 'not_started',
            isReady: false,
            isLoading: false,
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: false,
            lastChecked: Date.now(),
            error: null,
          });
        }
        return;
      }

      setUserId(user.id);

      const { data: stripeAccount, error } = await supabase
        .from('mechanic_stripe_accounts')
        .select('onboarding_complete, charges_enabled, payouts_enabled')
        .eq('mechanic_id', user.id)
        .maybeSingle();

      if (error) throw error;

      const chargesEnabled = stripeAccount?.charges_enabled ?? false;
      const payoutsEnabled = stripeAccount?.payouts_enabled ?? false;
      const detailsSubmitted = stripeAccount?.onboarding_complete ?? false;
      const status: PayoutStatus = detailsSubmitted && chargesEnabled && payoutsEnabled ? 'active' : (stripeAccount ? 'pending' : 'not_started');
      const isReady = chargesEnabled && payoutsEnabled && detailsSubmitted;

      if (isMounted.current) {
        setState({
          status,
          isReady,
          isLoading: false,
          chargesEnabled,
          payoutsEnabled,
          detailsSubmitted,
          lastChecked: Date.now(),
          error: null,
        });
      }
    } catch (e: any) {
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: e?.message || 'Failed to check payout status',
        }));
      }
    }
  }, [state.lastChecked]);

  useEffect(() => {
    isMounted.current = true;
    checkStatus(true);
    return () => { isMounted.current = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkStatus(true);
    }, [checkStatus])
  );

  const refresh = useCallback(() => checkStatus(true), [checkStatus]);

  return {
    ...state,
    userId,
    refresh,
  };
}

export function usePaymentGate() {
  const paymentStatus = usePaymentStatus();

  const requirePayment = useCallback((
    action: () => void | Promise<void>,
    options?: {
      returnTo?: string;
      role?: 'customer' | 'mechanic';
    }
  ) => {
    if (paymentStatus.isReady) {
      action();
      return;
    }

    if (paymentStatus.isLoading) {
      return;
    }

    const role = options?.role || 'customer';
    const setupRoute = role === 'mechanic'
      ? '/(mechanic)/stripe-onboarding'
      : '/(customer)/payment-setup';

    Alert.alert(
      'Payment Method Required',
      "To use this feature, please add a payment method to your account.",
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Add Payment Method',
          style: 'default',
          onPress: () => {
            const params = options?.returnTo
              ? `?returnTo=${encodeURIComponent(options.returnTo)}`
              : '';
            router.push(`${setupRoute}${params}` as any);
          },
        },
      ]
    );
  }, [paymentStatus.isReady, paymentStatus.isLoading]);

  const showPaymentRequiredModal = useCallback((
    options?: {
      returnTo?: string;
      role?: 'customer' | 'mechanic';
    }
  ) => {
    const role = options?.role || 'customer';
    const setupRoute = role === 'mechanic'
      ? '/(mechanic)/stripe-onboarding'
      : '/(customer)/payment-setup';

    Alert.alert(
      'Payment Method Required',
      "To use this feature, please add a payment method to your account.",
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Add Payment Method',
          style: 'default',
          onPress: () => {
            const params = options?.returnTo
              ? `?returnTo=${encodeURIComponent(options.returnTo)}`
              : '';
            router.push(`${setupRoute}${params}` as any);
          },
        },
      ]
    );
  }, []);

  return {
    paymentStatus: paymentStatus.status,
    isPaymentReady: paymentStatus.isReady,
    isLoading: paymentStatus.isLoading,
    userId: paymentStatus.userId,
    requirePayment,
    showPaymentRequiredModal,
    refreshPaymentStatus: paymentStatus.refresh,
  };
}

export function usePayoutGate() {
  const payoutStatus = usePayoutStatus();

  const requirePayout = useCallback((
    action: () => void | Promise<void>,
    options?: { returnTo?: string }
  ) => {
    if (payoutStatus.isReady) {
      action();
      return;
    }

    if (payoutStatus.isLoading) {
      return;
    }

    Alert.alert(
      'Payout Setup Required',
      "To accept jobs and receive payments, please set up your payout account.",
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Set Up Payout',
          style: 'default',
          onPress: () => {
            const params = options?.returnTo
              ? `?returnTo=${encodeURIComponent(options.returnTo)}`
              : '';
            router.push(`/(mechanic)/stripe-onboarding${params}` as any);
          },
        },
      ]
    );
  }, [payoutStatus.isReady, payoutStatus.isLoading]);

  return {
    payoutStatus: payoutStatus.status,
    isPayoutReady: payoutStatus.isReady,
    isLoading: payoutStatus.isLoading,
    chargesEnabled: payoutStatus.chargesEnabled,
    payoutsEnabled: payoutStatus.payoutsEnabled,
    detailsSubmitted: payoutStatus.detailsSubmitted,
    userId: payoutStatus.userId,
    requirePayout,
    refreshPayoutStatus: payoutStatus.refresh,
  };
}

export async function assertPaymentReady(userId: string): Promise<{ success: boolean; code?: string; message?: string }> {
  const { data, error } = await supabase.rpc('assert_payment_ready', { p_user_id: userId });
  
  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message };
  }
  
  return data as { success: boolean; code?: string; message?: string };
}

export async function assertPayoutReady(userId: string): Promise<{ success: boolean; code?: string; message?: string }> {
  const { data: stripeAccount, error } = await supabase
    .from('mechanic_stripe_accounts')
    .select('status, charges_enabled, payouts_enabled, details_submitted')
    .eq('mechanic_id', userId)
    .maybeSingle();

  if (error) {
    return { success: false, code: 'DB_ERROR', message: error.message };
  }

  if (!stripeAccount) {
    return { success: false, code: 'PAYOUT_NOT_SETUP', message: 'Payout account not set up' };
  }

  if (stripeAccount.status !== 'active' || !stripeAccount.charges_enabled || !stripeAccount.payouts_enabled) {
    return { success: false, code: 'PAYOUT_INCOMPLETE', message: 'Payout account setup incomplete' };
  }

  return { success: true };
}
