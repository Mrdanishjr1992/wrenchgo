import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  professionalism_rating: number | null;
  communication_rating: number | null;
  would_recommend: boolean | null;
  created_at: string;
  reviewer: {
    full_name: string;
  };
};

type ReviewListProps = {
  reviews: Review[];
  emptyMessage?: string;
};

export default function ReviewList({ reviews, emptyMessage = 'No reviews yet' }: ReviewListProps) {
  const { colors, text, spacing } = useTheme();

  const renderStars = (rating: number) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={16}
          color={star <= rating ? '#FFB800' : colors.border}
        />
      ))}
    </View>
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (reviews.length === 0) {
    return (
      <View style={{ padding: spacing.xl, alignItems: 'center' }}>
        <Ionicons name="chatbox-outline" size={48} color={colors.textSecondary} />
        <Text style={[text.base, { color: colors.textSecondary, marginTop: spacing.md }]}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }}>
      {reviews.map((review) => (
        <View
          key={review.id}
          style={{
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <View>
              <Text style={[text.base, { fontWeight: '600' }]}>{review.reviewer.full_name}</Text>
              <Text style={[text.xs, { color: colors.textSecondary, marginTop: 2 }]}>
                {formatDate(review.created_at)}
              </Text>
            </View>
            {renderStars(review.rating)}
          </View>

          {(review.professionalism_rating || review.communication_rating) && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm }}>
              {review.professionalism_rating && (
                <View style={{ flex: 1 }}>
                  <Text style={[text.xs, { color: colors.textSecondary, marginBottom: 2 }]}>
                    Professionalism
                  </Text>
                  {renderStars(review.professionalism_rating)}
                </View>
              )}
              {review.communication_rating && (
                <View style={{ flex: 1 }}>
                  <Text style={[text.xs, { color: colors.textSecondary, marginBottom: 2 }]}>
                    Communication
                  </Text>
                  {renderStars(review.communication_rating)}
                </View>
              )}
            </View>
          )}

          {review.would_recommend !== null && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                marginBottom: spacing.sm,
              }}
            >
              <Ionicons
                name={review.would_recommend ? 'thumbs-up' : 'thumbs-down'}
                size={14}
                color={review.would_recommend ? colors.success : colors.error}
              />
              <Text style={[text.xs, { color: colors.textSecondary }]}>
                {review.would_recommend ? 'Would recommend' : 'Would not recommend'}
              </Text>
            </View>
          )}

          {review.comment && (
            <Text style={[text.sm, { color: colors.text, lineHeight: 20 }]}>{review.comment}</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
