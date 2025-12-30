import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStripe, CardField } from '@stripe/stripe-react-native';
import { useTheme } from '../../../src/ui/theme-context';
import { createCard } from '../../../src/ui/styles';
import {
  createPaymentIntent,
  validatePromotion,
  formatCurrency,
  calculateCustomerBreakdown,
  type PaymentBreakdown,
  type ValidationResponse,
} from '../../../src/lib/payments';
import { supabase } from '../../../src/lib/supabase';

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; quoteId?: string }>();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const quoteId = Array.isArray(params.quoteId) ? params.quoteId[0] : params.quoteId;

  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);
  const { confirmPayment } = useStripe();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [job, setJob] = useState<any>(null);

  const [promotionCode, setPromotionCode] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoValidation, setPromoValidation] = useState<ValidationResponse | null>(null);

  const [breakdown, setBreakdown] = useState<PaymentBreakdown | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  const [cardComplete, setCardComplete] = useState(false);

  useEffect(() => {
    loadQuoteAndJob();
  }, [jobId, quoteId]);

  const loadQuoteAndJob = async () => {
    if (!jobId) {
      Alert.alert('Error', 'Missing job information');
      router.back();
      return;
    }

    try {
      setLoading(true);

      // Get the accepted quote for this job
      const { data: quoteData, error: quoteError } = await supabase
        .from('quote_requests')
        .select('*, jobs!inner(*)')
        .eq('job_id', jobId)
        .eq('status', 'accepted')
        .single();

      if (quoteError || !quoteData) {
        throw new Error('No accepted quote found for this job');
      }

      setQuote(quoteData);
      setJob(quoteData.jobs);

      // Use proposed_price_cents from quote_requests
      const quoteAmountCents = quoteData.proposed_price_cents || 0;
      const initialBreakdown = calculateCustomerBreakdown(quoteAmountCents);

      setBreakdown({
        quoteAmountCents: initialBreakdown.quoteAmount,
        customerPlatformFeeCents: initialBreakdown.platformFee,
        customerDiscountCents: initialBreakdown.discount,
        customerTotalCents: initialBreakdown.total,
        mechanicPlatformCommissionCents: 0,
        mechanicPayoutCents: 0,
        platformRevenueCents: 0,
      });
    } catch (error: any) {
      console.error('Error loading quote:', error);
      Alert.alert('Error', error.message || 'Failed to load quote');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleValidatePromotion = async () => {
    if (!promotionCode.trim() || !breakdown) return;

    try {
      setValidatingPromo(true);
      const validation = await validatePromotion(
        promotionCode.trim(),
        breakdown.quoteAmountCents
      );

      setPromoValidation(validation);

      if (validation.valid && validation.discountCents) {
        const newBreakdown = calculateCustomerBreakdown(
          breakdown.quoteAmountCents,
          validation.discountCents
        );

        setBreakdown({
          ...breakdown,
          customerDiscountCents: newBreakdown.discount,
          customerTotalCents: newBreakdown.total,
          promotionApplied: {
            code: validation.promotion!.code,
            type: validation.promotion!.type,
            discountCents: validation.discountCents,
          },
        });

        Alert.alert('Success', 'Promotion code applied!');
      } else {
        Alert.alert('Invalid Code', validation.reason || 'This promotion code is not valid');
      }
    } catch (error: any) {
      console.error('Error validating promotion:', error);
      Alert.alert('Error', 'Failed to validate promotion code');
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromotion = () => {
    if (!breakdown) return;

    const newBreakdown = calculateCustomerBreakdown(breakdown.quoteAmountCents, 0);

    setBreakdown({
      ...breakdown,
      customerDiscountCents: 0,
      customerTotalCents: newBreakdown.total,
      promotionApplied: undefined,
    });

    setPromotionCode('');
    setPromoValidation(null);
  };

  const handlePayNow = async () => {
    if (!jobId || !quote || !breakdown || !cardComplete) {
      Alert.alert('Error', 'Please complete all payment information');
      return;
    }

    try {
      setProcessing(true);

      const paymentData = await createPaymentIntent(
        jobId,
        quote.id,
        breakdown.promotionApplied?.code
      );

      setClientSecret(paymentData.clientSecret);
      setPaymentIntentId(paymentData.paymentIntentId);
      setBreakdown(paymentData.breakdown);

      const { error: confirmError } = await confirmPayment(paymentData.clientSecret, {
        paymentMethodType: 'Card',
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      Alert.alert(
        'Payment Successful!',
        'Your payment has been processed. The mechanic will start working on your vehicle soon.',
        [
          {
            text: 'View Job',
            onPress: () => router.replace(`/(customer)/job/${jobId}`),
          },
        ]
      );
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert('Payment Failed', error.message || 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ ...text.muted, marginTop: spacing.md }}>Loading payment details...</Text>
      </View>
    );
  }

  if (!breakdown || !quote) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
          <Text style={{ color: colors.accent, fontWeight: '900' }}>Back</Text>
        </Pressable>

        <Text style={[text.title, { marginBottom: spacing.sm }]}>Payment</Text>
        <Text style={{ ...text.muted, marginBottom: spacing.lg }}>
          Complete your payment to start the service
        </Text>

        <View style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}>
          <Text style={[text.section, { marginBottom: spacing.md }]}>Payment Breakdown</Text>

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={text.body}>Service Amount</Text>
              <Text style={{ ...text.body, fontWeight: '700' }}>
                {formatCurrency(breakdown.quoteAmountCents)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={text.body}>Platform Fee</Text>
              <Text style={{ ...text.body, fontWeight: '700' }}>
                {formatCurrency(breakdown.customerPlatformFeeCents)}
              </Text>
            </View>

            {breakdown.customerDiscountCents > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ ...text.body, color: colors.success }}>Discount</Text>
                  {breakdown.promotionApplied && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: colors.success + '20',
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '900', color: colors.success }}>
                        {breakdown.promotionApplied.code}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ ...text.body, fontWeight: '700', color: colors.success }}>
                  -{formatCurrency(breakdown.customerDiscountCents)}
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
              <Text style={[text.section, { fontSize: 18 }]}>Total</Text>
              <Text style={[text.section, { fontSize: 18, color: colors.accent }]}>
                {formatCurrency(breakdown.customerTotalCents)}
              </Text>
            </View>
          </View>
        </View>

        <View style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}>
          <Text style={[text.section, { marginBottom: spacing.md }]}>Promotion Code</Text>

          {breakdown.promotionApplied ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.md,
                borderRadius: 12,
                backgroundColor: colors.success + '10',
                borderWidth: 1,
                borderColor: colors.success + '30',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={{ ...text.body, fontWeight: '700' }}>
                  {breakdown.promotionApplied.code} applied
                </Text>
              </View>
              <Pressable onPress={handleRemovePromotion} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TextInput
                value={promotionCode}
                onChangeText={setPromotionCode}
                placeholder="Enter code"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                }}
              />
              <Pressable
                onPress={handleValidatePromotion}
                disabled={!promotionCode.trim() || validatingPromo}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.accent,
                  opacity: !promotionCode.trim() || validatingPromo ? 0.5 : pressed ? 0.8 : 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                {validatingPromo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '900' }}>Apply</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        <View style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}>
          <Text style={[text.section, { marginBottom: spacing.md }]}>Card Information</Text>

          <CardField
            postalCodeEnabled={true}
            placeholders={{
              number: '4242 4242 4242 4242',
            }}
            cardStyle={{
              backgroundColor: colors.surface,
              textColor: colors.textPrimary,
              placeholderColor: colors.textMuted,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            style={{
              width: '100%',
              height: 50,
              marginVertical: 8,
            }}
            onCardChange={(cardDetails) => {
              setCardComplete(cardDetails.complete);
            }}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: spacing.sm,
              padding: spacing.sm,
              borderRadius: 8,
              backgroundColor: colors.surface,
            }}
          >
            <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
            <Text style={{ ...text.muted, fontSize: 12 }}>
              Your payment information is secure and encrypted
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handlePayNow}
          disabled={!cardComplete || processing}
          style={({ pressed }) => ({
            backgroundColor: colors.accent,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
            opacity: !cardComplete || processing ? 0.5 : pressed ? 0.8 : 1,
            marginBottom: spacing.xl,
          })}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
              Pay {formatCurrency(breakdown.customerTotalCents)}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
