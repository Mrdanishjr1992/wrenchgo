import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { supabase } from '../../src/lib/supabase';
import { clearProfileCardCache } from '../../src/lib/profile-card';
import { ThemedText } from '../../src/ui/components/ThemedText';
import { ThemedCard } from '../../src/ui/components/ThemedCard';
import { ThemedInput } from '../../src/ui/components/ThemedInput';
import { AppButton } from '../../src/ui/components/AppButton';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  FadeInDown 
} from 'react-native-reanimated';

type ReviewFormProps = {
  jobId: string;
  revieweeId: string;
  revieweeName: string;
  reviewerRole: 'customer' | 'mechanic';
  onSubmitSuccess?: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function StarRating({ 
  rating, 
  onRate, 
  size = 36,
  interactive = true 
}: { 
  rating: number; 
  onRate?: (r: number) => void;
  size?: number;
  interactive?: boolean;
}) {
  const { colors, spacing } = useTheme();
  
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const scale = useSharedValue(1);
        
        const animatedStyle = useAnimatedStyle(() => ({
          transform: [{ scale: scale.value }],
        }));
        
        const handlePress = () => {
          if (!interactive || !onRate) return;
          scale.value = withSpring(1.3, { damping: 10 }, () => {
            scale.value = withSpring(1);
          });
          onRate(star);
        };
        
        return (
          <AnimatedPressable 
            key={star} 
            onPress={handlePress}
            disabled={!interactive}
            style={animatedStyle}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={size}
              color={star <= rating ? colors.warning : colors.border}
            />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

export default function ReviewForm({
  jobId,
  revieweeId,
  revieweeName,
  reviewerRole,
  onSubmitSuccess,
}: ReviewFormProps) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [rating, setRating] = useState(0);
  const [performanceRating, setPerformanceRating] = useState(0);
  const [timingRating, setTimingRating] = useState(0);
  const [costRating, setCostRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [punctualityRating, setPunctualityRating] = useState(0);
  const [paymentRating, setPaymentRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select an overall rating');
      return;
    }

    if (wouldRecommend === null) {
      Alert.alert('Recommendation Required', 'Please indicate if you would recommend');
      return;
    }

    setSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('submit_review', {
        p_job_id: jobId,
        p_reviewer_id: userData.user.id,
        p_reviewee_id: revieweeId,
        p_rating: rating,
        p_comment: comment.trim() || null,
        p_would_recommend: wouldRecommend,
        p_performance_rating: reviewerRole === 'customer' ? (performanceRating || null) : null,
        p_timing_rating: reviewerRole === 'customer' ? (timingRating || null) : null,
        p_cost_rating: reviewerRole === 'customer' ? (costRating || null) : null,
        p_communication_rating: reviewerRole === 'mechanic' ? (communicationRating || null) : null,
        p_punctuality_rating: reviewerRole === 'mechanic' ? (punctualityRating || null) : null,
        p_payment_rating: reviewerRole === 'mechanic' ? (paymentRating || null) : null,
      });

      if (error) throw error;

      const result = data as { published: boolean; blind_deadline: string };

      clearProfileCardCache(revieweeId);
      clearProfileCardCache(userData.user.id);

      setSubmitted(true);

      setTimeout(() => {
        Alert.alert(
          'Review Submitted',
          result.published
            ? 'Your review has been published.'
            : 'Your review will be published once the other party submits their review, or after 7 days.',
          [{ text: 'OK', onPress: () => { onSubmitSuccess?.(); router.back(); } }]
        );
      }, 500);
    } catch (err: any) {
      console.error('Review submission error:', err);
      Alert.alert('Error', err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingLabel = (r: number) => {
    if (r === 0) return 'Tap to rate';
    if (r === 1) return 'Poor';
    if (r === 2) return 'Fair';
    if (r === 3) return 'Good';
    if (r === 4) return 'Very Good';
    return 'Excellent';
  };

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={{ 
            width: 100, 
            height: 100, 
            borderRadius: 50, 
            backgroundColor: colors.successBg, 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: spacing.lg
          }}>
            <Ionicons name="checkmark" size={50} color={colors.success} />
          </View>
        </Animated.View>
        <ThemedText variant="h2" style={{ textAlign: 'center', marginBottom: spacing.sm }}>Thank You!</ThemedText>
        <ThemedText variant="body" color="muted" style={{ textAlign: 'center' }}>
          Your review helps build trust in the WrenchGo community
        </ThemedText>
      </View>
    );
  }

  const isValid = rating > 0 && wouldRecommend !== null;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <ThemedCard style={{ marginBottom: spacing.lg, alignItems: 'center' }}>
            <View style={{ 
              width: 64, 
              height: 64, 
              borderRadius: 32, 
              backgroundColor: colors.primaryBg, 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: spacing.md
            }}>
              <Ionicons name="person" size={28} color={colors.primary} />
            </View>
            <ThemedText variant="h3" style={{ marginBottom: spacing.xxs }}>
              Review {revieweeName}
            </ThemedText>
            <ThemedText variant="body" color="muted" style={{ textAlign: 'center' }}>
              Your honest feedback helps improve the WrenchGo community
            </ThemedText>
          </ThemedCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <ThemedCard style={{ marginBottom: spacing.lg }}>
            <ThemedText variant="label" style={{ marginBottom: spacing.sm }}>
              Overall Rating <ThemedText color="error">*</ThemedText>
            </ThemedText>
            <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
              <StarRating rating={rating} onRate={setRating} size={40} />
            </View>
            <ThemedText 
              variant="body" 
              color={rating > 0 ? 'primary' : 'muted'} 
              weight={rating > 0 ? 'semibold' : 'regular'}
              style={{ textAlign: 'center' }}
            >
              {getRatingLabel(rating)}
            </ThemedText>
          </ThemedCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <ThemedCard style={{ marginBottom: spacing.lg }}>
            <ThemedText variant="label" style={{ marginBottom: spacing.md }}>
              Detailed Ratings <ThemedText variant="caption" color="muted">(Optional)</ThemedText>
            </ThemedText>
            
            {reviewerRole === 'customer' ? (
              <>
                <View style={{ marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                    <ThemedText variant="body">Quality of Work</ThemedText>
                    <StarRating rating={performanceRating} onRate={setPerformanceRating} size={24} />
                  </View>
                </View>
                <View style={{ marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                    <ThemedText variant="body">Timeliness</ThemedText>
                    <StarRating rating={timingRating} onRate={setTimingRating} size={24} />
                  </View>
                </View>
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText variant="body">Value for Money</ThemedText>
                    <StarRating rating={costRating} onRate={setCostRating} size={24} />
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={{ marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                    <ThemedText variant="body">Communication</ThemedText>
                    <StarRating rating={communicationRating} onRate={setCommunicationRating} size={24} />
                  </View>
                </View>
                <View style={{ marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                    <ThemedText variant="body">Punctuality</ThemedText>
                    <StarRating rating={punctualityRating} onRate={setPunctualityRating} size={24} />
                  </View>
                </View>
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText variant="body">Payment Experience</ThemedText>
                    <StarRating rating={paymentRating} onRate={setPaymentRating} size={24} />
                  </View>
                </View>
              </>
            )}
          </ThemedCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(300)}>
          <ThemedCard style={{ marginBottom: spacing.lg }}>
            <ThemedText variant="label" style={{ marginBottom: spacing.sm }}>
              Would you recommend? <ThemedText color="error">*</ThemedText>
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Pressable
                onPress={() => setWouldRecommend(true)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: wouldRecommend === true ? colors.success : colors.border,
                  backgroundColor: wouldRecommend === true ? colors.successBg : 'transparent',
                }}
              >
                <Ionicons 
                  name={wouldRecommend === true ? "checkmark-circle" : "checkmark-circle-outline"} 
                  size={24} 
                  color={wouldRecommend === true ? colors.success : colors.textMuted} 
                />
                <ThemedText 
                  variant="body" 
                  weight={wouldRecommend === true ? 'semibold' : 'regular'}
                  color={wouldRecommend === true ? 'success' : 'secondary'}
                >
                  Yes
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setWouldRecommend(false)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: wouldRecommend === false ? colors.error : colors.border,
                  backgroundColor: wouldRecommend === false ? colors.errorBg : 'transparent',
                }}
              >
                <Ionicons 
                  name={wouldRecommend === false ? "close-circle" : "close-circle-outline"} 
                  size={24} 
                  color={wouldRecommend === false ? colors.error : colors.textMuted} 
                />
                <ThemedText 
                  variant="body" 
                  weight={wouldRecommend === false ? 'semibold' : 'regular'}
                  color={wouldRecommend === false ? 'error' : 'secondary'}
                >
                  No
                </ThemedText>
              </Pressable>
            </View>
          </ThemedCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(300)}>
          <ThemedCard style={{ marginBottom: spacing.lg }}>
            <ThemedText variant="label" style={{ marginBottom: spacing.sm }}>
              Written Feedback <ThemedText variant="caption" color="muted">(Optional)</ThemedText>
            </ThemedText>
            <ThemedInput
              value={comment}
              onChangeText={setComment}
              placeholder={
                reviewerRole === 'customer'
                  ? 'Share your experience with this mechanic...'
                  : 'Share your experience with this customer...'
              }
              multiline
              numberOfLines={4}
              maxLength={500}
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />
            <ThemedText variant="caption" color="muted" style={{ textAlign: 'right', marginTop: spacing.xs }}>
              {comment.length}/500
            </ThemedText>
          </ThemedCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(300)}>
          <AppButton
            label={submitting ? 'Submitting...' : 'Submit Review'}
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            disabled={!isValid || submitting}
            loading={submitting}
            style={{ marginBottom: spacing.md }}
          />
          
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: spacing.xs,
            backgroundColor: colors.surface2,
            padding: spacing.sm,
            borderRadius: radius.md
          }}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
            <ThemedText variant="caption" color="muted" style={{ textAlign: 'center' }}>
              Reviews are hidden until both parties submit, or after 7 days
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
