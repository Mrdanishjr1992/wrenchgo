import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import type { Review } from '../../src/types/trust-system';

interface ReviewCardProps {
  review: Review;
  showReviewer?: boolean;
  onReport?: (reviewId: string) => void;
}

export function ReviewCard({ review, showReviewer = true, onReport }: ReviewCardProps) {
  const { colors, text, spacing, radius } = useTheme();

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

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
      {showReviewer && review.reviewer && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          {review.reviewer.avatar_url ? (
            <Image
              source={{ uri: review.reviewer.avatar_url }}
              style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
            />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.accent + '22',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16 }}>
                {(review.reviewer.full_name || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={text.body}>{review.reviewer.full_name || 'User'}</Text>
            <Text style={{ ...text.muted, fontSize: 12 }}>{formatDate(review.created_at)}</Text>
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <StarDisplay rating={review.overall_rating} size={18} />
        <Text style={{ marginLeft: 8, fontWeight: '700', color: colors.textPrimary }}>
          {review.overall_rating.toFixed(1)}
        </Text>
      </View>

      {review.comment && (
        <Text style={{ ...text.body, marginBottom: spacing.sm }}>{review.comment}</Text>
      )}

      {review.would_recommend !== null && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
          }}
        >
          <Ionicons
            name={review.would_recommend ? 'thumbs-up' : 'thumbs-down'}
            size={14}
            color={review.would_recommend ? '#10b981' : '#ef4444'}
          />
          <Text style={{ ...text.muted, fontSize: 12 }}>
            {review.would_recommend ? 'Would recommend' : 'Would not recommend'}
          </Text>
        </View>
      )}

      {onReport && (
        <Pressable
          onPress={() => onReport(review.id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: spacing.sm,
            alignSelf: 'flex-end',
          }}
        >
          <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
          <Text style={{ ...text.muted, fontSize: 12 }}>Report</Text>
        </Pressable>
      )}
    </View>
  );
}

interface StarDisplayProps {
  rating: number;
  size?: number;
  showValue?: boolean;
}

export function StarDisplay({ rating, size = 16, showValue = false }: StarDisplayProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rating >= star;
        const half = !filled && rating >= star - 0.5;
        return (
          <Ionicons
            key={star}
            name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
            size={size}
            color={filled || half ? '#FFD700' : colors.textMuted}
          />
        );
      })}
      {showValue && (
        <Text style={{ marginLeft: 4, fontWeight: '600', color: colors.textPrimary, fontSize: size * 0.9 }}>
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
}

interface ReviewSummaryProps {
  totalReviews: number;
  avgRating: number;
  distribution?: {
    five: number;
    four: number;
    three: number;
    two: number;
    one: number;
  };
  wouldRecommendPercent?: number | null;
  compact?: boolean;
}

export function ReviewSummary({
  totalReviews,
  avgRating,
  distribution,
  wouldRecommendPercent,
  compact = false,
}: ReviewSummaryProps) {
  const { colors, text, spacing, radius } = useTheme();

  if (totalReviews === 0) {
    return (
      <View style={{ alignItems: 'center', padding: spacing.md }}>
        <Text style={text.muted}>No reviews yet</Text>
      </View>
    );
  }

  if (compact) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <StarDisplay rating={avgRating} size={16} />
        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{avgRating.toFixed(1)}</Text>
        <Text style={text.muted}>({totalReviews})</Text>
      </View>
    );
  }

  const maxCount = distribution
    ? Math.max(distribution.five, distribution.four, distribution.three, distribution.two, distribution.one, 1)
    : 1;

  const RatingBar = ({ stars, count }: { stars: number; count: number }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <Text style={{ ...text.muted, width: 14, textAlign: 'right' }}>{stars}</Text>
      <Ionicons name="star" size={12} color="#FFD700" />
      <View
        style={{
          flex: 1,
          height: 8,
          backgroundColor: colors.bg,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${(count / maxCount) * 100}%`,
            height: '100%',
            backgroundColor: '#FFD700',
            borderRadius: 4,
          }}
        />
      </View>
      <Text style={{ ...text.muted, width: 24 }}>{count}</Text>
    </View>
  );

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
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 40, fontWeight: '800', color: colors.textPrimary }}>
            {avgRating.toFixed(1)}
          </Text>
          <StarDisplay rating={avgRating} size={18} />
          <Text style={{ ...text.muted, marginTop: 4 }}>
            {totalReviews} review{totalReviews !== 1 ? 's' : ''}
          </Text>
        </View>

        {distribution && (
          <View style={{ flex: 1 }}>
            <RatingBar stars={5} count={distribution.five} />
            <RatingBar stars={4} count={distribution.four} />
            <RatingBar stars={3} count={distribution.three} />
            <RatingBar stars={2} count={distribution.two} />
            <RatingBar stars={1} count={distribution.one} />
          </View>
        )}
      </View>

      {wouldRecommendPercent !== null && wouldRecommendPercent !== undefined && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: spacing.md,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Ionicons name="thumbs-up" size={16} color="#10b981" />
          <Text style={{ ...text.body, color: '#10b981' }}>
            {wouldRecommendPercent.toFixed(0)}% would recommend
          </Text>
        </View>
      )}
    </View>
  );
}
