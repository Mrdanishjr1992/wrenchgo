import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../src/ui/theme-context';
import { supabase } from '../../../src/lib/supabase';
import { clearProfileCardCache } from '../../../src/lib/profile-card';
import { ThemedText } from '../../../src/ui/components/ThemedText';
import { ThemedCard } from '../../../src/ui/components/ThemedCard';
import { ThemedInput } from '../../../src/ui/components/ThemedInput';
import { AppButton } from '../../../src/ui/components/AppButton';
import { UserProfileCard } from '../../../components/profile/UserProfileCardQuotes';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function StarRating({
  rating,
  onRate,
  size = 32,
  label,
  icon,
}: {
  rating: number;
  onRate: (r: number) => void;
  size?: number;
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors, spacing } = useTheme();

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: 8 }}>
          {icon && <Ionicons name={icon} size={18} color={colors.textSecondary} />}
          <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>{label}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: label ? 'flex-start' : 'center' }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const scale = useSharedValue(1);

          const animatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: scale.value }],
          }));

          const handlePress = () => {
            scale.value = withSpring(1.3, { damping: 10 }, () => {
              scale.value = withSpring(1);
            });
            onRate(star);
          };

          return (
            <AnimatedPressable key={star} onPress={handlePress} style={animatedStyle}>
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={size}
                color={star <= rating ? '#FFD700' : colors.border}
              />
            </AnimatedPressable>
          );
        })}
        {rating > 0 && (
          <Text style={{ marginLeft: 8, color: colors.textSecondary, fontWeight: '600' }}>
            {rating}/5
          </Text>
        )}
      </View>
    </View>
  );
}

export default function MandatoryReviewScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const jobId = params.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [revieweeId, setRevieweeId] = useState<string | null>(null);
  const [revieweeName, setRevieweeName] = useState<string>('');
  const [reviewerRole, setReviewerRole] = useState<'customer' | 'mechanic'>('customer');
  const [jobTitle, setJobTitle] = useState<string>('');

  // Category ratings based on role
  // Customer reviewing mechanic: Quality (performance), Timeliness (timing), Value (cost)
  // Mechanic reviewing customer: Communication, Punctuality, Payment
  const [rating1, setRating1] = useState(0);
  const [rating2, setRating2] = useState(0);
  const [rating3, setRating3] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');

  const overallRating = rating1 > 0 && rating2 > 0 && rating3 > 0
    ? Math.round(((rating1 + rating2 + rating3) / 3) * 10) / 10
    : 0;

  const allRated = rating1 > 0 && rating2 > 0 && rating3 > 0 && wouldRecommend !== null;

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          'Review Required',
          'You must submit a review before continuing. This helps maintain trust in our community.',
          [{ text: 'OK', style: 'default' }]
        );
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  useEffect(() => {
    loadReviewData();
  }, [jobId]);

  const loadReviewData = async () => {
    try {
      setError(null);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('customer_id, title')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;

      setJobTitle(job.title || 'Job');
      const isCustomer = job.customer_id === userData.user.id;
      setReviewerRole(isCustomer ? 'customer' : 'mechanic');

      if (isCustomer) {
        const { data: contract, error: contractError } = await supabase
          .from('job_contracts')
          .select('mechanic_id, mechanic:profiles!job_contracts_mechanic_id_fkey(full_name)')
          .eq('job_id', jobId)
          .single();

        if (contractError) throw contractError;

        setRevieweeId(contract.mechanic_id);
        setRevieweeName((contract.mechanic as any)?.full_name || 'Mechanic');
      } else {
        const { data: jobData, error: jobDataError } = await supabase
          .from('jobs')
          .select('customer_id, customer:profiles!jobs_customer_id_fkey(full_name)')
          .eq('id', jobId)
          .single();

        if (jobDataError) throw jobDataError;

        setRevieweeId(jobData.customer_id);
        setRevieweeName((jobData.customer as any)?.full_name || 'Customer');
      }
    } catch (err: any) {
      console.error('Load review data error:', err);
      setError(err.message || 'Failed to load review information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!allRated) {
      Alert.alert('All Fields Required', 'Please rate all categories and select whether you would recommend');
      return;
    }

    if (!revieweeId) {
      Alert.alert('Error', 'Could not identify the other party');
      return;
    }

    setSubmitting(true);

    try {
      const { submitReview } = await import('../../../src/lib/trust-system');

      // Build payload based on reviewer role
      const payload: any = {
        job_id: jobId!,
        reviewee_id: revieweeId,
        overall_rating: overallRating,
        comment: comment.trim() || undefined,
        would_recommend: wouldRecommend,
      };

      if (reviewerRole === 'customer') {
        // Customer reviewing mechanic: Quality, Timeliness, Value
        payload.performance_rating = rating1;
        payload.timing_rating = rating2;
        payload.cost_rating = rating3;
      } else {
        // Mechanic reviewing customer: Communication, Punctuality, Payment
        payload.communication_rating = rating1;
        payload.punctuality_rating = rating2;
        payload.payment_rating = rating3;
      }

      const result = await submitReview(payload);

      if (!result.success) {
        if (result.error?.includes('duplicate') || result.error?.includes('23505')) {
          setSubmitted(true);
          setTimeout(() => {
            router.replace('/');
          }, 1500);
          return;
        }
        throw new Error(result.error || 'Failed to submit review');
      }

      if (revieweeId) {
        clearProfileCardCache(revieweeId);
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          clearProfileCardCache(userData.user.id);
        }
      }

      setSubmitted(true);

      setTimeout(() => {
        router.replace('/');
      }, 2000);
    } catch (err: any) {
      console.error('Submit review error:', err);
      if (err.message?.includes('duplicate') || err.code === '23505') {
        setSubmitted(true);
        setTimeout(() => {
          router.replace('/');
        }, 1500);
      } else {
        Alert.alert('Error', err.message || 'Failed to submit review. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: insets.top,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
        <ThemedText variant="body" style={{ marginTop: spacing.md }}>
          Loading...
        </ThemedText>
      </View>
    );
  }

  if (error || !revieweeId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.xl,
          paddingTop: insets.top,
        }}
      >
        <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
        <ThemedText variant="h3" style={{ marginTop: spacing.md, textAlign: 'center' }}>
          Unable to Load Review
        </ThemedText>
        <ThemedText variant="body" color="muted" style={{ textAlign: 'center', marginTop: spacing.sm }}>
          {error || 'Could not find review information'}
        </ThemedText>
        <AppButton
          title="Retry"
          variant="primary"
          onPress={loadReviewData}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  if (submitted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.xl,
          paddingTop: insets.top,
        }}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: `${colors.success}20`,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          </View>
        </Animated.View>
        <ThemedText variant="h2" style={{ textAlign: 'center' }}>
          Thank You!
        </ThemedText>
        <ThemedText variant="body" color="muted" style={{ textAlign: 'center', marginTop: spacing.sm }}>
          Your review has been submitted successfully.
        </ThemedText>
      </View>
    );
  }

  // Category labels based on role
  const categories = reviewerRole === 'customer'
    ? [
        { label: 'Quality', icon: 'speedometer-outline' as const },
        { label: 'Timeliness', icon: 'time-outline' as const },
        { label: 'Value', icon: 'cash-outline' as const },
      ]
    : [
        { label: 'Communication', icon: 'chatbubble-outline' as const },
        { label: 'Punctuality', icon: 'time-outline' as const },
        { label: 'Payment', icon: 'card-outline' as const },
      ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View
          style={{
            padding: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="star" size={24} color="#FFD700" />
            <ThemedText variant="h3">Review Required</ThemedText>
          </View>
          <ThemedText variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
            Required to continue - rate all categories below
          </ThemedText>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {revieweeId && (
            <View style={{ marginBottom: spacing.lg }}>
              <ThemedText variant="caption" color="muted" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
                {jobTitle}
              </ThemedText>
              <UserProfileCard
                userId={revieweeId}
                variant="full"
                context="review"
              />
            </View>
          )}

          <ThemedCard style={{ padding: spacing.lg, marginBottom: spacing.lg }}>
            <ThemedText variant="body" style={{ fontWeight: '600', marginBottom: spacing.lg, textAlign: 'center' }}>
              Rate your experience
            </ThemedText>

            <StarRating
              rating={rating1}
              onRate={setRating1}
              label={categories[0].label}
              icon={categories[0].icon}
            />
            <StarRating
              rating={rating2}
              onRate={setRating2}
              label={categories[1].label}
              icon={categories[1].icon}
            />
            <StarRating
              rating={rating3}
              onRate={setRating3}
              label={categories[2].label}
              icon={categories[2].icon}
            />

            {allRated && (
              <View
                style={{
                  marginTop: spacing.md,
                  paddingTop: spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>Overall:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 18 }}>
                    {overallRating.toFixed(1)}
                  </Text>
                </View>
              </View>
            )}
          </ThemedCard>

          <ThemedCard style={{ padding: spacing.lg, marginBottom: spacing.lg }}>
            <ThemedText variant="body" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
              Comments (Optional)
            </ThemedText>
            <ThemedInput
              placeholder="Share your experience..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />
          </ThemedCard>

          <ThemedCard style={{ padding: spacing.lg, marginBottom: spacing.lg }}>
            <ThemedText variant="body" style={{ fontWeight: '600', marginBottom: spacing.md, textAlign: 'center' }}>
              Would you recommend {revieweeName}?
            </ThemedText>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}>
              <Pressable
                onPress={() => setWouldRecommend(true)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: wouldRecommend === true ? '#10b981' : colors.border,
                  backgroundColor: wouldRecommend === true ? '#10b98115' : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Ionicons
                  name="thumbs-up"
                  size={24}
                  color={wouldRecommend === true ? '#10b981' : colors.textMuted}
                />
                <Text style={{
                  fontWeight: '600',
                  color: wouldRecommend === true ? '#10b981' : colors.textSecondary,
                }}>
                  Yes
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setWouldRecommend(false)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: wouldRecommend === false ? '#ef4444' : colors.border,
                  backgroundColor: wouldRecommend === false ? '#ef444415' : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Ionicons
                  name="thumbs-down"
                  size={24}
                  color={wouldRecommend === false ? '#ef4444' : colors.textMuted}
                />
                <Text style={{
                  fontWeight: '600',
                  color: wouldRecommend === false ? '#ef4444' : colors.textSecondary,
                }}>
                  No
                </Text>
              </Pressable>
            </View>
          </ThemedCard>

          <View
            style={{
              backgroundColor: `${colors.warning}15`,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: spacing.sm,
            }}
          >
            <Ionicons name="information-circle" size={20} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="caption" style={{ color: colors.warning, fontWeight: '600' }}>
                Why is this required?
              </ThemedText>
              <ThemedText variant="caption" color="muted" style={{ marginTop: 2 }}>
                Reviews help maintain trust and quality in our community. Your feedback helps others make informed decisions.
              </ThemedText>
            </View>
          </View>

          <AppButton
            title={submitting ? 'Submitting...' : 'Submit Review'}
            variant="primary"
            onPress={handleSubmit}
            disabled={!allRated || submitting}
            loading={submitting}
            style={{ marginBottom: spacing.xl }}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
