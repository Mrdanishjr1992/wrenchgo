import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/ui/theme-context';
import type { Review } from '@/src/lib/reviews';

interface ReviewsListProps {
  reviews: Review[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  onReportReview?: (reviewId: string) => void;
  ListHeaderComponent?: React.ReactElement;
  mechanicName?: string;
  revieweeRole?: 'mechanic' | 'customer';
  scrollEnabled?: boolean;
}

export function ReviewsList({
  reviews,
  onLoadMore,
  hasMore = false,
  loading = false,
  onReportReview,
  ListHeaderComponent,
  mechanicName,
  revieweeRole = 'mechanic',
  scrollEnabled = true,
}: ReviewsListProps) {
  const { colors } = useTheme();

  const renderReview = ({ item }: { item: Review }) => (
    <ReviewCard
      review={item}
      colors={colors}
      onReport={onReportReview}
      revieweeRole={revieweeRole}
    />
  );

  return (
    <FlatList
      data={reviews}
      renderItem={renderReview}
      keyExtractor={(item) => item.id}
      onEndReached={hasMore && !loading ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeaderComponent}
      scrollEnabled={scrollEnabled}
      nestedScrollEnabled={!scrollEnabled}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="star-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {mechanicName ? `${mechanicName} is new to WrenchGo` : 'New to WrenchGo'}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Reviews will appear after completed jobs
          </Text>
          <View style={[styles.emptyHint, { backgroundColor: colors.textMuted + '08', borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
              Be the first to leave a review
            </Text>
          </View>
        </View>
      }
    />
  );
}

interface ReviewCardProps {
  review: Review;
  colors: any;
  onReport?: (reviewId: string) => void;
  revieweeRole: 'mechanic' | 'customer';
}

function ReviewCard({ review, colors, onReport, revieweeRole }: ReviewCardProps) {
  const reviewerName = review.reviewer?.full_name || review.reviewer_name || 'Anonymous';

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i < rating ? 'star' : 'star-outline'}
          size={16}
          color="#FFB800"
        />
      );
    }
    return stars;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <View style={[styles.reviewCard, {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      shadowColor: colors.textPrimary,
    }]}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <Text style={[styles.reviewerName, { color: colors.textPrimary }]}>{reviewerName}</Text>
          <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>
            {formatDate(review.created_at)}
          </Text>
        </View>
        {onReport && (
          <TouchableOpacity onPress={() => onReport(review.id)} style={styles.reportButton}>
            <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.overallRating}>
        <View style={styles.stars}>{renderStars(review.overall_rating)}</View>
        <Text style={[styles.ratingValue, { color: colors.textPrimary }]}>
          {review.overall_rating}.0
        </Text>
      </View>

      <View style={[styles.categoryRatings, { borderColor: colors.border }]}>
        {revieweeRole === 'mechanic' ? (
          <>
            <CategoryRating
              icon="speedometer-outline"
              label="Quality"
              value={review.performance_rating}
              iconColor={colors.textSecondary}
              textColor={colors.textPrimary}
            />
            <CategoryRating
              icon="time-outline"
              label="Timeliness"
              value={review.timing_rating}
              iconColor={colors.textSecondary}
              textColor={colors.textPrimary}
            />
            <CategoryRating
              icon="cash-outline"
              label="Value"
              value={review.cost_rating}
              iconColor={colors.textSecondary}
              textColor={colors.textPrimary}
            />
          </>
        ) : (
          <>
            <CategoryRating
              icon="chatbubble-outline"
              label="Communication"
              value={review.communication_rating}
              iconColor={colors.textSecondary}
              textColor={colors.textPrimary}
            />
            <CategoryRating
              icon="time-outline"
              label="Punctuality"
              value={review.punctuality_rating}
              iconColor={colors.textSecondary}
              textColor={colors.textPrimary}
            />
            <CategoryRating
              icon="card-outline"
              label="Payment"
              value={review.payment_rating}
              iconColor={colors.textSecondary}
              textColor={colors.textPrimary}
            />
          </>
        )}
      </View>

      {review.comment && (
        <Text style={[styles.comment, { color: colors.textPrimary }]}>{review.comment}</Text>
      )}
    </View>
  );
}

interface CategoryRatingProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | null;
  iconColor: string;
  textColor: string;
}

function CategoryRating({ icon, label, value, iconColor, textColor }: CategoryRatingProps) {
  const displayValue = value ?? 0;
  return (
    <View style={styles.categoryRating}>
      <Ionicons name={icon} size={14} color={iconColor} />
      <Text style={[styles.categoryLabel, { color: iconColor }]}>{label}</Text>
      <View style={styles.categoryStars}>
        {[...Array(5)].map((_, i) => (
          <Ionicons
            key={i}
            name={i < displayValue ? 'star' : 'star-outline'}
            size={10}
            color="#FFB800"
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reviewCard: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 12,
  },
  reportButton: {
    padding: 4,
  },
  overallRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  categoryRatings: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  categoryRating: {
    alignItems: 'center',
    flex: 1,
  },
  categoryLabel: {
    fontSize: 10,
    marginTop: 2,
    marginBottom: 2,
  },
  categoryStars: {
    flexDirection: 'row',
  },
  comment: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  emptyHintText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
