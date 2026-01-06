import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { getReviewStatus } from '../../src/lib/trust-system';
import { ReviewModal } from './ReviewForm';
import type { ReviewStatusResponse } from '../../src/types/trust-system';

interface ReviewPromptSectionProps {
  jobId: string;
  jobStatus: string;
  otherPartyId: string;
  otherPartyName: string;
  otherPartyRole: 'customer' | 'mechanic';
  onReviewSubmitted?: () => void;
}

export function ReviewPromptSection({
  jobId,
  jobStatus,
  otherPartyId,
  otherPartyName,
  otherPartyRole,
  onReviewSubmitted,
}: ReviewPromptSectionProps) {
  const { colors, text, spacing, radius } = useTheme();
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    if (jobStatus === 'completed') {
      loadReviewStatus();
    } else {
      setLoading(false);
    }
  }, [jobId, jobStatus]);

  const loadReviewStatus = async () => {
    setLoading(true);
    const status = await getReviewStatus(jobId);
    setReviewStatus(status);
    setLoading(false);
  };

  if (jobStatus !== 'completed') {
    return null;
  }

  if (loading) {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!reviewStatus) {
    return null;
  }

  if (reviewStatus.has_reviewed && reviewStatus.other_review_visible) {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
          <Ionicons name="star" size={20} color="#FFD700" />
          <Text style={text.section}>Reviews Exchanged</Text>
        </View>

        <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm }}>
          <Text style={{ ...text.muted, fontSize: 12, marginBottom: 4 }}>Your review:</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= (reviewStatus.my_review?.overall_rating ?? 0) ? 'star' : 'star-outline'}
                size={16}
                color="#FFD700"
              />
            ))}
          </View>
          {reviewStatus.my_review?.comment && (
            <Text style={{ ...text.body, marginTop: 6, fontStyle: 'italic' }}>
              "{reviewStatus.my_review.comment}"
            </Text>
          )}
        </View>

        <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.sm }}>
          <Text style={{ ...text.muted, fontSize: 12, marginBottom: 4 }}>Their review:</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= (reviewStatus.other_review?.overall_rating ?? 0) ? 'star' : 'star-outline'}
                size={16}
                color="#FFD700"
              />
            ))}
          </View>
          {reviewStatus.other_review?.comment && (
            <Text style={{ ...text.body, marginTop: 6, fontStyle: 'italic' }}>
              "{reviewStatus.other_review.comment}"
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (reviewStatus.has_reviewed) {
    return (
      <View
        style={{
          backgroundColor: `${colors.accent}15`,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: `${colors.accent}40`,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="eye-off-outline" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...text.body, fontWeight: '600', color: colors.accent }}>
              Review Submitted
            </Text>
            <Text style={{ ...text.muted, fontSize: 13, marginTop: 2 }}>
              Your review will be visible once {otherPartyName} submits their review.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={star <= (reviewStatus.my_review?.overall_rating ?? 0) ? 'star' : 'star-outline'}
              size={18}
              color="#FFD700"
            />
          ))}
          <Text style={{ ...text.muted, marginLeft: 6 }}>Your rating</Text>
        </View>
      </View>
    );
  }

  if (reviewStatus.can_review) {
    return (
      <>
        <Pressable
          onPress={() => setShowReviewModal(true)}
          style={{
            backgroundColor: `#FFD70022`,
            borderRadius: radius.lg,
            padding: spacing.md,
            borderWidth: 2,
            borderColor: '#FFD700',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#FFD700',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="star" size={24} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...text.section, color: colors.textPrimary }}>Leave a Review</Text>
              <Text style={{ ...text.muted, marginTop: 2 }}>
                How was your experience with {otherPartyName}?
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>

          {reviewStatus.other_has_reviewed && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: spacing.sm,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: '#FFD70040',
              }}
            >
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600' }}>
                {otherPartyName} has already reviewed you
              </Text>
            </View>
          )}
        </Pressable>

        <ReviewModal
          visible={showReviewModal}
          jobId={jobId}
          revieweeId={otherPartyId}
          revieweeName={otherPartyName}
          revieweeRole={otherPartyRole}
          onSuccess={() => {
            setShowReviewModal(false);
            loadReviewStatus();
            onReviewSubmitted?.();
          }}
          onCancel={() => setShowReviewModal(false)}
        />
      </>
    );
  }

  return null;
}
