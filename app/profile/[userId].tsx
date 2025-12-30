import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { UserProfileCard } from '@/components/profile/UserProfileCard';
import { ReviewsList } from '@/components/reviews/ReviewsList';
import { getPublicProfile, getUserReviews, reportReview } from '@/src/lib/reviews';
import type { PublicProfile, Review } from '@/src/types/reviews';

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [sortBy, setSortBy] = useState<'created_at' | 'overall_rating'>('created_at');

  useEffect(() => {
    loadProfile();
  }, [userId]);

  useEffect(() => {
    loadReviews(true);
  }, [userId, sortBy]);

  const loadProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const data = await getPublicProfile(userId);
    setProfile(data);
    setLoading(false);
  };

  const loadReviews = async (reset = false) => {
    if (!userId) return;
    setReviewsLoading(true);
    const offset = reset ? 0 : page * 10;
    const { reviews: newReviews, total } = await getUserReviews(userId, {
      limit: 10,
      offset,
      sortBy,
      sortOrder: 'desc',
    });
    
    if (reset) {
      setReviews(newReviews);
      setPage(0);
    } else {
      setReviews([...reviews, ...newReviews]);
    }
    setTotalReviews(total);
    setReviewsLoading(false);
  };

  const handleLoadMore = () => {
    if (!reviewsLoading && reviews.length < totalReviews) {
      setPage(page + 1);
      loadReviews(false);
    }
  };

  const handleReportReview = async (reviewId: string) => {
    Alert.alert(
      'Report Review',
      'Why are you reporting this review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Spam',
          onPress: () => submitReport(reviewId, 'spam'),
        },
        {
          text: 'Inappropriate',
          onPress: () => submitReport(reviewId, 'inappropriate'),
        },
        {
          text: 'Fake',
          onPress: () => submitReport(reviewId, 'fake'),
        },
        {
          text: 'Other',
          onPress: () => submitReport(reviewId, 'other'),
        },
      ]
    );
  };

  const submitReport = async (reviewId: string, reason: any) => {
    const result = await reportReview({ review_id: reviewId, reason });
    if (result.success) {
      Alert.alert('Success', 'Review reported. We will review it shortly.');
    } else {
      Alert.alert('Error', result.error || 'Failed to report review');
    }
  };

  const toggleSort = () => {
    setSortBy(sortBy === 'created_at' ? 'overall_rating' : 'created_at');
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.errorContainer, { backgroundColor }]}>
        <Ionicons name="person-outline" size={64} color={iconColor} />
        <Text style={[styles.errorText, { color: textColor }]}>Profile not found</Text>
      </View>
    );
  }

  const displayName = profile.display_name || profile.full_name;

  return (
    <>
      <Stack.Screen
        options={{
          title: displayName,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor }]}>
        <UserProfileCard profile={profile} />

        {profile.role === 'mechanic' && profile.service_area && (
          <View style={[styles.infoCard, { backgroundColor }]}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color={tintColor} />
              <Text style={[styles.infoLabel, { color: textColor }]}>Service Area</Text>
            </View>
            <Text style={[styles.infoValue, { color: iconColor }]}>
              {profile.service_area}
            </Text>
            {profile.radius_miles && (
              <Text style={[styles.infoSubtext, { color: iconColor }]}>
                Within {profile.radius_miles} miles
              </Text>
            )}
          </View>
        )}

        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeader}>
            <Text style={[styles.reviewsTitle, { color: textColor }]}>
              Reviews ({totalReviews})
            </Text>
            <TouchableOpacity onPress={toggleSort} style={styles.sortButton}>
              <Ionicons
                name={sortBy === 'created_at' ? 'time-outline' : 'star-outline'}
                size={20}
                color={tintColor}
              />
              <Text style={[styles.sortText, { color: tintColor }]}>
                {sortBy === 'created_at' ? 'Recent' : 'Rating'}
              </Text>
            </TouchableOpacity>
          </View>

          <ReviewsList
            reviews={reviews}
            onLoadMore={handleLoadMore}
            hasMore={reviews.length < totalReviews}
            loading={reviewsLoading}
            onReportReview={handleReportReview}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoValue: {
    fontSize: 16,
    marginLeft: 28,
  },
  infoSubtext: {
    fontSize: 14,
    marginLeft: 28,
    marginTop: 4,
  },
  reviewsSection: {
    marginTop: 16,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewsTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
