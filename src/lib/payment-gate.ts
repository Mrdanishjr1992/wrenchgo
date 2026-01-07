import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';

export type PaymentStatus = 'none' | 'pending' | 'active' | 'failed' | 'loading';

export function usePaymentGate() {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('loading');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  const checkPaymentStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPaymentStatus('none');
        return;
      }

      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_method_status')
        .eq('id', session.user.id)
        .single();

      setPaymentStatus((profile?.payment_method_status as PaymentStatus) || 'none');
    } catch (e) {
      console.error('Error checking payment status:', e);
      setPaymentStatus('none');
    }
  }, []);

  const requirePayment = useCallback((
    action: () => void | Promise<void>,
    options?: {
      returnTo?: string;
      role?: 'customer' | 'mechanic';
    }
  ) => {
    if (paymentStatus === 'active') {
      action();
      return;
    }

    const role = options?.role || 'customer';
    const setupRoute = role === 'mechanic'
      ? '/(mechanic)/payment-setup'
      : '/(customer)/payment-setup';

    Alert.alert(
      'Payment Method Required',
      "To use this feature, please add a payment method to your account.\n\nYou're welcome to continue browsing WrenchGo, but requesting services or accepting jobs requires a saved payment method.",
      [
        {
          text: 'Not Now',
          style: 'cancel'
        },
        {
          text: 'Learn more about WrenchGo',
          onPress: () => router.push('/app-info'),
        },
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
  }, [paymentStatus]);

  const showPaymentRequiredModal = useCallback((
    options?: {
      returnTo?: string;
      role?: 'customer' | 'mechanic';
    }
  ) => {
    const role = options?.role || 'customer';
    const setupRoute = role === 'mechanic'
      ? '/(mechanic)/payment-setup'
      : '/(customer)/payment-setup';

    Alert.alert(
      'Payment Method Required',
      "To use this feature, please add a payment method to your account.\n\nYou're welcome to continue browsing WrenchGo, but requesting services or accepting jobs requires a saved payment method.",
      [
        {
          text: 'Not Now',
          style: 'cancel'
        },
        {
          text: 'Learn more about WrenchGo',
          onPress: () => router.push('/app-info'),
        },
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

  const isPaymentReady = paymentStatus === 'active';
  const isLoading = paymentStatus === 'loading';

  return {
    paymentStatus,
    isPaymentReady,
    isLoading,
    userId,
    requirePayment,
    showPaymentRequiredModal,
    refreshPaymentStatus: checkPaymentStatus,
  };
}

export async function assertPaymentReady(userId: string): Promise<{ success: boolean; code?: string; message?: string }> {
  const { data, error } = await supabase.rpc('assert_payment_ready', { p_user_id: userId });
  
  if (error) {
    return { success: false, code: 'RPC_ERROR', message: error.message };
  }
  
  return data as { success: boolean; code?: string; message?: string };
}