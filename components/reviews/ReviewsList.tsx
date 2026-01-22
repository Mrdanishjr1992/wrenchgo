import React from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/ui/theme-context';
import type { Review } from '@/src/lib/reviews';
import { ThemedText } from '@/src/ui/components/ThemedText';
import { ThemedCard } from '@/src/ui/components/ThemedCard';
import { ThemedBadge } from '@/src/ui/components/ThemedBadge';
import { Skeleton } from '@/src/ui/components/Skeleton';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
  const { spacing } = useTheme();

  const renderReview = ({ item, index }: { item: Review; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <ReviewCard
        review={item}
        onReport={onReportReview}
        revieweeRole={revieweeRole}
      />
    </Animated.View>
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
      contentContainerStyle={{ paddingHorizontal: spacing.md }}
      ListEmptyComponent={
        <EmptyReviewsState mechanicName={mechanicName} />
      }
      ListFooterComponent={loading ? <ReviewCardSkeleton /> : null}
    />
  );
}

function EmptyReviewsState({ mechanicName }: { mechanicName?: string }) {
  const { colors, spacing, radius } = useTheme();
  
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg }}>
      <View style={{ 
        width: 80, 
        height: 80, 
        borderRadius: 40, 
        backgroundColor: colors.primaryBg, 
        alignItems: 'center', 
        justifyContent: 'center',
        marginBottom: spacing.lg
      }}>
        <Ionicons name="star-outline" size={36} color={colors.primary} />
      </View>
      <ThemedText variant="title" style={{ marginBottom: spacing.xs, textAlign: 'center' }}>
        {mechanicName ? `${mechanicName} is new to WrenchGo` : 'New to WrenchGo'}
      </ThemedText>
      <ThemedText variant="body" color="muted" style={{ textAlign: 'center', marginBottom: spacing.lg }}>
        Reviews will appear after completed jobs
      </ThemedText>
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: spacing.xs,
        backgroundColor: colors.surface2,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full
      }}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <ThemedText variant="caption" color="muted">Be the first to leave a review</ThemedText>
      </View>
    </View>
  );
}

export function ReviewCardSkeleton() {
  const { spacing } = useTheme();
  
  return (
    <ThemedCard style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <View>
          <Skeleton width={120} height={16} style={{ marginBottom: spacing.xs }} />
          <Skeleton width={80} height={12} />
        </View>
        <Skeleton width={24} height={24} borderRadius={12} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width={16} height={16} borderRadius={8} />
        ))}
      </View>
      <Skeleton width="100%" height={40} />
    </ThemedCard>
  );
}

interface ReviewCardProps {
  review: Review;
  onReport?: (reviewId: string) => void;
  revieweeRole: 'mechanic' | 'customer';
}

function ReviewCard({ review, onReport, revieweeRole }: ReviewCardProps) {
  const { colors, spacing, radius } = useTheme();
  const reviewerName = review.reviewer?.full_name || review.reviewer_name || 'Anonymous';

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

  const renderStars = (rating: number) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={16}
          color={colors.warning}
        />
      ))}
    </View>
  );

  return (
    <ThemedCard style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              backgroundColor: colors.primaryBg, 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <ThemedText variant="body" color="primary" style={{ fontWeight: '600' }}>
                {reviewerName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View>
              <ThemedText variant="body" style={{ fontWeight: '600' }}>{reviewerName}</ThemedText>
              <ThemedText variant="caption" color="muted">{formatDate(review.created_at)}</ThemedText>
            </View>
          </View>
        </View>
        {onReport && (
          <Pressable 
            onPress={() => onReport(review.id)} 
            hitSlop={8}
            style={{ padding: spacing.xs }}
          >
            <Ionicons name="flag-outline" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        {renderStars(review.overall_rating)}
        <ThemedText variant="title">{review.overall_rating}.0</ThemedText>
      </View>

      <View style={{ 
        flexDirection: 'row', 
        backgroundColor: colors.surface2, 
        borderRadius: radius.md, 
        padding: spacing.sm,
        marginBottom: spacing.md
      }}>
        {revieweeRole === 'mechanic' ? (
          <>
            <CategoryRating icon="speedometer-outline" label="Quality" value={review.performance_rating} />
            <CategoryRating icon="time-outline" label="Timeliness" value={review.timing_rating} />
            <CategoryRating icon="cash-outline" label="Value" value={review.cost_rating} />
          </>
        ) : (
          <>
            <CategoryRating icon="chatbubble-outline" label="Communication" value={review.communication_rating} />
            <CategoryRating icon="time-outline" label="Punctuality" value={review.punctuality_rating} />
            <CategoryRating icon="card-outline" label="Payment" value={review.payment_rating} />
          </>
        )}
      </View>

      {review.comment && (
        <View style={{ 
          backgroundColor: colors.bg, 
          borderRadius: radius.md, 
          padding: spacing.sm,
          borderLeftWidth: 3,
          borderLeftColor: colors.primary
        }}>
          <ThemedText variant="body" style={{ fontStyle: 'italic' }}>
            "{review.comment}"
          </ThemedText>
        </View>
      )}
    </ThemedCard>
  );
}

interface CategoryRatingProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | null;
}

function CategoryRating({ icon, label, value }: CategoryRatingProps) {
  const { colors } = useTheme();
  const displayValue = value ?? 0;
  
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <ThemedText variant="caption" color="muted" style={{ marginTop: 2, marginBottom: 2 }}>{label}</ThemedText>
      <View style={{ flexDirection: 'row', gap: 1 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= displayValue ? 'star' : 'star-outline'}
            size={10}
            color={colors.warning}
          />
        ))}
      </View>
    </View>
  );
}

export default ReviewsList;