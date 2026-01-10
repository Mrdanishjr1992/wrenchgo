import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/ui/theme-context';
import { createCard } from '../../../src/ui/styles';
import {
  getMechanicStripeAccount,
  createStripeConnectAccountLink,
  isStripeAccountReady,
  getStripeAccountStatusMessage,
  refreshStripeAccountStatus,
  type MechanicStripeAccount,
} from '../../../src/lib/stripe';
import { supabase } from '../../../src/lib/supabase';

export default function StripeOnboardingScreen() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<MechanicStripeAccount | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadAccount = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(auth)/sign-in');
        return;
      }

      setUserId(user.id);

      try {
        await refreshStripeAccountStatus(user.id);
      } catch (e) {
        console.log('Refresh error (non-fatal):', e);
      }

      const accountData = await getMechanicStripeAccount(user.id);
      setAccount(accountData);
    } catch (error) {
      console.error('Error loading account:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadAccount(true);
      }
    }, [userId, loadAccount])
  );

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      if (event.url.includes('stripe-connect-return') || event.url.includes('stripe-connect-refresh')) {
        loadAccount(true);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url && (url.includes('stripe-connect-return') || url.includes('stripe-connect-refresh'))) {
        loadAccount(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadAccount]);

  const handleStartOnboarding = async () => {
    try {
      setProcessing(true);

      const { url } = await createStripeConnectAccountLink();

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open onboarding link');
      }
    } catch (error: any) {
      console.error('Error starting onboarding:', error);
      Alert.alert('Error', error.message || 'Failed to start onboarding');
    } finally {
      setProcessing(false);
    }
  };

  const handleRefresh = async () => {
    await loadAccount(true);
  };

  const handleContinue = () => {
    if (isStripeAccountReady(account)) {
      router.back();
    } else {
      handleStartOnboarding();
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ ...text.muted, marginTop: spacing.md }}>Loading account...</Text>
      </View>
    );
  }

  const isReady = isStripeAccountReady(account);
  const statusMessage = getStripeAccountStatusMessage(account);
  const isPending = account && !isReady;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md }}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg }}
      >
        <Ionicons name="chevron-back" size={20} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: '900' }}>Back</Text>
      </Pressable>

      <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: isReady ? '#10B981' + '20' : isPending ? '#F59E0B' + '20' : colors.accent + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Ionicons
            name={isReady ? 'checkmark-circle' : isPending ? 'time' : 'card-outline'}
            size={40}
            color={isReady ? '#10B981' : isPending ? '#F59E0B' : colors.accent}
          />
        </View>

        <Text style={[text.title, { textAlign: 'center', marginBottom: spacing.sm }]}>
          {isReady ? 'Payout Account Active' : isPending ? 'Setup In Progress' : 'Set Up Payouts'}
        </Text>

        <Text style={{ ...text.muted, textAlign: 'center' }}>
          {statusMessage}
        </Text>

        {refreshing && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm }}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={{ ...text.muted, fontSize: 12 }}>Refreshing status...</Text>
          </View>
        )}
      </View>

      {!isReady && !isPending && (
        <>
          <View style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}>
            <Text style={[text.section, { marginBottom: spacing.md }]}>Why do I need this?</Text>

            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Ionicons name="cash-outline" size={20} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.body, fontWeight: '700', marginBottom: 4 }}>
                    Get Paid Directly
                  </Text>
                  <Text style={text.muted}>
                    Receive payments directly to your bank account within 2-7 business days
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.body, fontWeight: '700', marginBottom: 4 }}>
                    Secure & Verified
                  </Text>
                  <Text style={text.muted}>
                    Powered by Stripe, the industry standard for secure payments
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Ionicons name="trending-up-outline" size={20} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.body, fontWeight: '700', marginBottom: 4 }}>
                    Accept Paid Jobs
                  </Text>
                  <Text style={text.muted}>
                    Required to accept quotes and start earning on WrenchGo
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}>
            <Text style={[text.section, { marginBottom: spacing.md }]}>What you'll need</Text>

            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.textMuted} />
                <Text style={text.body}>Social Security Number or EIN</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.textMuted} />
                <Text style={text.body}>Bank account information</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.textMuted} />
                <Text style={text.body}>Personal identification</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.textMuted} />
                <Text style={text.body}>Business address</Text>
              </View>
            </View>
          </View>

          <View
            style={{
              padding: spacing.md,
              borderRadius: 12,
              backgroundColor: colors.surface,
              marginBottom: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Ionicons name="time-outline" size={16} color={colors.textMuted} />
              <Text style={{ ...text.muted, fontSize: 12 }}>Takes about 5 minutes</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              <Text style={{ ...text.muted, fontSize: 12 }}>
                Your information is encrypted and secure
              </Text>
            </View>
          </View>
        </>
      )}

      {isPending && (
        <View style={[card, { padding: spacing.lg, marginBottom: spacing.md, backgroundColor: '#FEF3C7' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Ionicons name="information-circle" size={20} color="#D97706" />
            <Text style={{ ...text.body, fontWeight: '700', color: '#92400E' }}>Almost There!</Text>
          </View>
          <Text style={{ ...text.body, color: '#92400E', marginBottom: spacing.md }}>
            Your account setup is incomplete. Please continue with Stripe to finish setting up your payout account.
          </Text>
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#92400E' }}>Details Submitted</Text>
              <Ionicons
                name={account?.onboarding_complete ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={account?.onboarding_complete ? '#10B981' : '#EF4444'}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#92400E' }}>Charges Enabled</Text>
              <Ionicons
                name={account?.charges_enabled ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={account?.charges_enabled ? '#10B981' : '#EF4444'}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#92400E' }}>Payouts Enabled</Text>
              <Ionicons
                name={account?.payouts_enabled ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={account?.payouts_enabled ? '#10B981' : '#EF4444'}
              />
            </View>
          </View>
        </View>
      )}

      {isReady && (
        <View style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={text.section}>Account Status</Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={text.muted}>Charges Enabled</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={text.body}>Yes</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={text.muted}>Payouts Enabled</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={text.body}>Yes</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={text.muted}>Details Submitted</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={text.body}>Yes</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <Pressable
        onPress={handleContinue}
        disabled={processing}
        style={({ pressed }) => ({
          backgroundColor: colors.accent,
          paddingVertical: 16,
          borderRadius: 16,
          alignItems: 'center',
          opacity: processing ? 0.5 : pressed ? 0.8 : 1,
          marginBottom: spacing.sm,
        })}
      >
        {processing ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>
            {isReady ? 'Done' : isPending ? 'Continue Setup' : 'Start Setup'}
          </Text>
        )}
      </Pressable>

      {isPending && (
        <Pressable
          onPress={handleRefresh}
          disabled={refreshing}
          style={({ pressed }) => ({
            backgroundColor: colors.surface,
            paddingVertical: 14,
            borderRadius: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            opacity: refreshing ? 0.5 : pressed ? 0.8 : 1,
            marginBottom: spacing.md,
          })}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>
            Refresh Status
          </Text>
        </Pressable>
      )}

      {!isReady && !isPending && (
        <Text style={{ ...text.muted, textAlign: 'center', fontSize: 12, marginTop: spacing.sm }}>
          By continuing, you agree to Stripe's Terms of Service
        </Text>
      )}
    </ScrollView>
  );
}
