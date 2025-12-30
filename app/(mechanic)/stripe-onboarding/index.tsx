import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/ui/theme-context';
import { createCard } from '../../../src/ui/styles';
import {
  getMechanicStripeAccount,
  createStripeConnectAccountLink,
  isStripeAccountReady,
  getStripeAccountStatusMessage,
  type MechanicStripeAccount,
} from '../../../src/lib/stripe';
import { supabase } from '../../../src/lib/supabase';

export default function StripeOnboardingScreen() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [account, setAccount] = useState<MechanicStripeAccount | null>(null);

  useEffect(() => {
    loadAccount();
  }, []);

  const loadAccount = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(auth)/sign-in');
        return;
      }

      const accountData = await getMechanicStripeAccount(user.id);
      setAccount(accountData);
    } catch (error) {
      console.error('Error loading account:', error);
    } finally {
      setLoading(false);
    }
  };

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

      setTimeout(() => {
        loadAccount();
      }, 2000);
    } catch (error: any) {
      console.error('Error starting onboarding:', error);
      Alert.alert('Error', error.message || 'Failed to start onboarding');
    } finally {
      setProcessing(false);
    }
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
            backgroundColor: isReady ? colors.accent + '20' : colors.accent + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Ionicons
            name={isReady ? 'checkmark-circle' : 'card-outline'}
            size={40}
            color={isReady ? colors.accent : colors.accent}
          />
        </View>

        <Text style={[text.title, { textAlign: 'center', marginBottom: spacing.sm }]}>
          {isReady ? 'Payout Account Active' : 'Set Up Payouts'}
        </Text>

        <Text style={{ ...text.muted, textAlign: 'center' }}>
          {statusMessage}
        </Text>
      </View>

      {!isReady && (
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
            <Text style={[text.section, { marginBottom: spacing.md }]}>What you&apos;ll need</Text>

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

      {isReady && (
        <View style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
            <Text style={text.section}>Account Status</Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={text.muted}>Charges Enabled</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={account?.charges_enabled ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={account?.charges_enabled ? '#10B981' : '#EF4444'}
                />
                <Text style={text.body}>
                  {account?.charges_enabled ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={text.muted}>Payouts Enabled</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={account?.payouts_enabled ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={account?.payouts_enabled ? '#10B981' : '#EF4444'}
                />
                <Text style={text.body}>
                  {account?.payouts_enabled ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={text.muted}>Details Submitted</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={account?.details_submitted ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={account?.details_submitted ? '#10B981' : '#EF4444'}
                />
                <Text style={text.body}>
                  {account?.details_submitted ? 'Yes' : 'No'}
                </Text>
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
          marginBottom: spacing.xl,
        })}
      >
        {processing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
            {isReady ? 'Continue' : 'Start Setup'}
          </Text>
        )}
      </Pressable>

      {!isReady && (
        <Text style={{ ...text.muted, textAlign: 'center', fontSize: 12 }}>
          By continuing, you agree to Stripe&apos;s Terms of Service
        </Text>
      )}
    </ScrollView>
  );
}
