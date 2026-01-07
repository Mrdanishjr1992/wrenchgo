import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/ui/theme-context';
import { createCard } from '../../../src/ui/styles';
import {
  getPaymentByJobId,
  formatCurrency,
  getPaymentStatusColor,
  getPaymentStatusLabel,
  type Payment,
} from '../../../src/lib/payments';

export default function EarningsBreakdownScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string }>();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const insets = useSafeAreaInsets();

  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);

  useEffect(() => {
    loadPayment();
  }, [jobId]);

  const loadPayment = async () => {
    if (!jobId) {
      router.back();
      return;
    }

    try {
      setLoading(true);
      const paymentData = await getPaymentByJobId(jobId);
      setPayment(paymentData);
    } catch (error) {
      console.error('Error loading payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayment();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ ...text.muted, marginTop: spacing.md }}>Loading earnings...</Text>
      </View>
    );
  }

  if (!payment) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md, paddingTop: insets.top + spacing.md }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: '900' }}>Back</Text>
        </Pressable>

        <View style={[card, { padding: spacing.xl, alignItems: 'center', gap: spacing.md }]}>
          <Ionicons name="cash-outline" size={48} color={colors.textMuted} />
          <Text style={text.section}>No Payment Yet</Text>
          <Text style={{ ...text.muted, textAlign: 'center' }}>
            Payment information will appear here once the customer completes payment.
          </Text>
        </View>
      </View>
    );
  }

  const statusColor = getPaymentStatusColor(payment.status);
  const statusLabel = getPaymentStatusLabel(payment.status);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.md
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
      }
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg }}
      >
        <Ionicons name="chevron-back" size={20} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: '900' }}>Back</Text>
      </Pressable>

      <Text style={[text.title, { marginBottom: spacing.sm }]}>Earnings Breakdown</Text>
      <Text style={{ ...text.muted, marginBottom: spacing.lg }}>
        Your payout details for this job
      </Text>

      <View
        style={[
          card,
          {
            padding: spacing.lg,
            marginBottom: spacing.md,
            borderLeftWidth: 4,
            borderLeftColor: statusColor,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text style={text.section}>Payment Status</Text>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: statusColor + '20',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '900', color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {payment.paid_at && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={{ ...text.muted, fontSize: 12 }}>
              Paid on {new Date(payment.paid_at).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      <View style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}>
        <Text style={[text.section, { marginBottom: spacing.md }]}>Your Earnings</Text>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={text.body}>Job Amount</Text>
            <Text style={{ ...text.body, fontWeight: '700' }}>
              {formatCurrency(payment.quote_amount_cents)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={text.body}>Platform Commission</Text>
              <Pressable hitSlop={8}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={{ ...text.body, fontWeight: '700', color: colors.error }}>
              -{formatCurrency(payment.mechanic_platform_commission_cents)}
            </Text>
          </View>

          <View
            style={{
              padding: spacing.sm,
              borderRadius: 8,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ ...text.muted, fontSize: 12 }}>
              12% fee on labor only (parts excluded), capped at $50
            </Text>
          </View>

          {payment.mechanic_discount_cents > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ ...text.body, color: colors.success }}>Bonus/Credit</Text>
              <Text style={{ ...text.body, fontWeight: '700', color: colors.success }}>
                +{formatCurrency(payment.mechanic_discount_cents)}
              </Text>
            </View>
          )}

          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginVertical: spacing.sm,
            }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[text.section, { fontSize: 18 }]}>Net Payout</Text>
            <Text style={[text.section, { fontSize: 18, color: colors.success }]}>
              {formatCurrency(payment.mechanic_payout_cents)}
            </Text>
          </View>
        </View>
      </View>

      <View style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}>
        <Text style={[text.section, { marginBottom: spacing.md }]}>Payment Details</Text>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={text.muted}>Payment ID</Text>
            <Text style={{ ...text.body, fontSize: 12, fontFamily: 'monospace' }}>
              {payment.id.slice(0, 8)}...
            </Text>
          </View>

          {payment.stripe_payment_intent_id && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={text.muted}>Stripe Payment</Text>
              <Text style={{ ...text.body, fontSize: 12, fontFamily: 'monospace' }}>
                {payment.stripe_payment_intent_id.slice(0, 12)}...
              </Text>
            </View>
          )}

          {payment.payment_method_type && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={text.muted}>Payment Method</Text>
              <Text style={text.body}>{payment.payment_method_type}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={text.muted}>Currency</Text>
            <Text style={text.body}>{payment.currency.toUpperCase()}</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={text.muted}>Created</Text>
            <Text style={text.body}>
              {new Date(payment.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>

      {payment.status === 'paid' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: 12,
            backgroundColor: colors.success + '10',
            borderWidth: 1,
            borderColor: colors.success + '30',
            marginBottom: spacing.xl,
          }}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={{ ...text.body, flex: 1 }}>
            Funds will be transferred to your connected bank account within 2-7 business days
          </Text>
        </View>
      )}

      {payment.failure_reason && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: 12,
            backgroundColor: colors.error + '10',
            borderWidth: 1,
            borderColor: colors.error + '30',
            marginBottom: spacing.xl,
          }}
        >
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={{ ...text.body, flex: 1, color: colors.error }}>
            {payment.failure_reason}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
