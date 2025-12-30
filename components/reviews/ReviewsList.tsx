import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Review } from '@/src/types/reviews';

interface ReviewsListProps {
  reviews: Review[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  onReportReview?: (reviewId: string) => void;
}

export function ReviewsList({
  reviews,
  onLoadMore,
  hasMore = false,
  loading = false,
  onReportReview,
}: ReviewsListProps) {
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const backgroundColor = useThemeColor({}, 'background');

  const renderReview = ({ item }: { item: Review }) => (
    <ReviewCard
      review={item}
      textColor={textColor}
      iconColor={iconColor}
      backgroundColor={backgroundColor}
      onReport={onReportReview}
    />
  );

  return (
    <FlatList
      data={reviews}
      renderItem={renderReview}
      keyExtractor={(item) => item.id}
      onEndReached={hasMore && !loading ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color={iconColor} />
          <Text style={[styles.emptyText, { color: iconColor }]}>No reviews yet</Text>
        </View>
      }
    />
  );
}

interface ReviewCardProps {
  review: Review;
  textColor: string;
  iconColor: string;
  backgroundColor: string;
  onReport?: (reviewId: string) => void;
}

function ReviewCard({ review, textColor, iconColor, backgroundColor, onReport }: ReviewCardProps) {
  const reviewerName = review.reviewer?.display_name || review.reviewer?.full_name || 'Anonymous';

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
    <View style={[styles.reviewCard, { backgroundColor }]}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <Text style={[styles.reviewerName, { color: textColor }]}>{reviewerName}</Text>
          <Text style={[styles.reviewDate, { color: iconColor }]}>
            {formatDate(review.created_at)}
          </Text>
        </View>
        {onReport && (
          <TouchableOpacity onPress={() => onReport(review.id)} style={styles.reportButton}>
            <Ionicons name="flag-outline" size={20} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.overallRating}>
        <View style={styles.stars}>{renderStars(review.overall_rating)}</View>
        <Text style={[styles.ratingValue, { color: textColor }]}>
          {review.overall_rating}.0
        </Text>
      </View>

      <View style={styles.categoryRatings}>
        <CategoryRating
          icon="speedometer-outline"
          label="Performance"
          value={review.performance_rating}
          iconColor={iconColor}
          textColor={textColor}
        />
        <CategoryRating
          icon="time-outline"
          label="Timing"
          value={review.timing_rating}
          iconColor={iconColor}
          textColor={textColor}
        />
        <CategoryRating
          icon="cash-outline"
          label="Cost"
          value={review.cost_rating}
          iconColor={iconColor}
          textColor={textColor}
        />
      </View>

      {review.comment && (
        <Text style={[styles.comment, { color: textColor }]}>{review.comment}</Text>
      )}
    </View>
  );
}

interface CategoryRatingProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  iconColor: string;
  textColor: string;
}

function CategoryRating({ icon, label, value, iconColor, textColor }: CategoryRatingProps) {
  return (
    <View style={styles.categoryRating}>
      <Ionicons name={icon} size={14} color={iconColor} />
      <Text style={[styles.categoryLabel, { color: iconColor }]}>{label}</Text>
      <View style={styles.categoryStars}>
        {[...Array(5)].map((_, i) => (
          <Ionicons
            key={i}
            name={i < value ? 'star' : 'star-outline'}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
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
    borderColor: '#E0E0E0',
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
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});
