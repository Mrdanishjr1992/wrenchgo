import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { submitReview } from '../../src/lib/trust-system';
import type { SubmitReviewPayload } from '../../src/types/trust-system';

interface ReviewFormProps {
  jobId: string;
  revieweeId: string;
  revieweeName: string;
  revieweeAvatar?: string | null;
  revieweeRole: 'customer' | 'mechanic';
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReviewForm({
  jobId,
  revieweeId,
  revieweeName,
  revieweeRole,
  onSuccess,
  onCancel,
}: ReviewFormProps) {
  const { colors, text, spacing, radius } = useTheme();
  const [submitting, setSubmitting] = useState(false);

  const [overallRating, setOverallRating] = useState(0);
  const [professionalismRating, setProfessionalismRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [timingRating, setTimingRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');

  const canSubmit = overallRating > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const payload: SubmitReviewPayload = {
        job_id: jobId,
        reviewee_id: revieweeId,
        overall_rating: overallRating,
        professionalism_rating: professionalismRating > 0 ? professionalismRating : undefined,
        communication_rating: communicationRating > 0 ? communicationRating : undefined,
        timing_rating: timingRating > 0 ? timingRating : undefined,
        would_recommend: wouldRecommend ?? undefined,
        comment: comment.trim() || undefined,
      };

      const result = await submitReview(payload);

      if (result.success) {
        Alert.alert(
          'Review Submitted',
          result.is_visible
            ? 'Your review is now visible to both parties.'
            : 'Your review will be visible once the other party submits their review.',
          [{ text: 'OK', onPress: onSuccess }]
        );
      } else {
        Alert.alert('Unable to Submit', 'Please check your connection and try again.');
      }
    } catch (e: any) {
      Alert.alert('Unable to Submit', 'Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({
    value,
    onChange,
    size = 32,
  }: {
    value: number;
    onChange: (v: number) => void;
    size?: number;
  }) => (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange(star)}>
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={star <= value ? '#FFD700' : colors.textMuted}
          />
        </Pressable>
      ))}
    </View>
  );

  const RatingRow = ({
    label,
    value,
    onChange,
    optional = true,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    optional?: boolean;
  }) => (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={text.body}>{label}</Text>
        {optional && <Text style={{ ...text.muted, fontSize: 12 }}>Optional</Text>}
      </View>
      <StarRating value={value} onChange={onChange} size={28} />
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md }}
    >
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={text.title}>Leave a Review</Text>
        <Text style={{ ...text.muted, marginTop: 4 }}>
          How was your experience with {revieweeName}?
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.lg,
        }}
      >
        <Text style={{ ...text.section, marginBottom: spacing.sm }}>Overall Rating *</Text>
        <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
          <StarRating value={overallRating} onChange={setOverallRating} size={40} />
          {overallRating > 0 && (
            <Text style={{ ...text.body, marginTop: 8, color: colors.accent }}>
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][overallRating]}
            </Text>
          )}
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.lg,
        }}
      >
        <Text style={{ ...text.section, marginBottom: spacing.md }}>Detailed Ratings</Text>

        {revieweeRole === 'mechanic' ? (
          <>
            <RatingRow
              label="Professionalism"
              value={professionalismRating}
              onChange={setProfessionalismRating}
            />
            <RatingRow
              label="Communication"
              value={communicationRating}
              onChange={setCommunicationRating}
            />
            <RatingRow label="Timeliness" value={timingRating} onChange={setTimingRating} />
          </>
        ) : (
          <>
            <RatingRow
              label="Communication"
              value={communicationRating}
              onChange={setCommunicationRating}
            />
            <RatingRow label="Preparedness" value={timingRating} onChange={setTimingRating} />
          </>
        )}
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.lg,
        }}
      >
        <Text style={{ ...text.section, marginBottom: spacing.sm }}>Would you recommend?</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => setWouldRecommend(true)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: radius.md,
              backgroundColor: wouldRecommend === true ? '#10b98122' : colors.bg,
              borderWidth: 2,
              borderColor: wouldRecommend === true ? '#10b981' : colors.border,
            }}
          >
            <Ionicons
              name="thumbs-up"
              size={20}
              color={wouldRecommend === true ? '#10b981' : colors.textMuted}
            />
            <Text
              style={{
                fontWeight: '600',
                color: wouldRecommend === true ? '#10b981' : colors.textMuted,
              }}
            >
              Yes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setWouldRecommend(false)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: radius.md,
              backgroundColor: wouldRecommend === false ? '#ef444422' : colors.bg,
              borderWidth: 2,
              borderColor: wouldRecommend === false ? '#ef4444' : colors.border,
            }}
          >
            <Ionicons
              name="thumbs-down"
              size={20}
              color={wouldRecommend === false ? '#ef4444' : colors.textMuted}
            />
            <Text
              style={{
                fontWeight: '600',
                color: wouldRecommend === false ? '#ef4444' : colors.textMuted,
              }}
            >
              No
            </Text>
          </Pressable>
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.lg,
        }}
      >
        <Text style={{ ...text.section, marginBottom: spacing.sm }}>Written Review</Text>
        <Text style={{ ...text.muted, marginBottom: 8 }}>Optional - Share your experience</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder={
            revieweeRole === 'mechanic'
              ? 'Describe your experience with this mechanic...'
              : 'Describe your experience with this customer...'
          }
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          style={{
            ...text.body,
            backgroundColor: colors.bg,
            borderRadius: radius.md,
            padding: 12,
            minHeight: 100,
            textAlignVertical: 'top',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
      </View>

      <View
        style={{
          backgroundColor: `${colors.accent}15`,
          borderRadius: radius.md,
          padding: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="eye-off-outline" size={18} color={colors.accent} />
          <Text style={{ ...text.muted, flex: 1, color: colors.accent }}>
            Your review will remain hidden until the other party submits their review (max 14 days).
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {onCancel && (
          <Pressable
            onPress={onCancel}
            style={{
              flex: 1,
              paddingVertical: 16,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ ...text.body, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            flex: 1,
            paddingVertical: 16,
            borderRadius: radius.lg,
            backgroundColor: canSubmit ? colors.accent : colors.surface,
            alignItems: 'center',
            opacity: canSubmit && !submitting ? 1 : 0.5,
          }}
        >
          {submitting ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={{ fontWeight: '900', color: canSubmit ? '#000' : colors.textMuted }}>
              Submit Review
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

// =====================================================
// REVIEW MODAL WRAPPER
// =====================================================

interface ReviewModalProps extends ReviewFormProps {
  visible: boolean;
}

export function ReviewModal({ visible, onCancel, ...props }: ReviewModalProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ReviewForm {...props} onCancel={onCancel} />
      </View>
    </Modal>
  );
}
