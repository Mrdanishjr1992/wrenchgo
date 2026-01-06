import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { supabase } from '../../src/lib/supabase';

interface BlindReviewProps {
  jobId: string;
  contractId: string;
  role: 'customer' | 'mechanic';
  otherPartyId: string;
  onSuccess?: () => void;
}

type RatingCategory = 'overall' | 'performance' | 'timing' | 'cost';

interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  overall_rating: number;
  performance_rating: number | null;
  timing_rating: number | null;
  cost_rating: number | null;
  comment: string | null;
  is_visible: boolean;
  created_at: string;
}

export function BlindReviewForm({ jobId, contractId, role, otherPartyId, onSuccess }: BlindReviewProps) {
  const { colors, spacing } = useTheme();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [otherSubmitted, setOtherSubmitted] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [otherReview, setOtherReview] = useState<Review | null>(null);

  const [overall, setOverall] = useState(0);
  const [performance, setPerformance] = useState(0);
  const [timing, setTiming] = useState(0);
  const [cost, setCost] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    checkExistingReviews();
  }, [jobId]);

  const checkExistingReviews = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      // Check if I've submitted
      const { data: myData } = await supabase
        .from('reviews')
        .select('*')
        .eq('job_id', jobId)
        .eq('reviewer_id', userId)
        .maybeSingle();

      if (myData) {
        setHasSubmitted(true);
        setMyReview(myData as Review);
      }

      // Check if other party submitted
      const { data: otherData } = await supabase
        .from('reviews')
        .select('*')
        .eq('job_id', jobId)
        .eq('reviewer_id', otherPartyId)
        .maybeSingle();

      if (otherData) {
        setOtherSubmitted(true);
        if ((otherData as Review).is_visible) {
          setOtherReview(otherData as Review);
        }
      }
    } catch (e: any) {
      console.error('Check reviews error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (overall === 0) {
      Alert.alert('Rating Required', 'Please provide an overall rating');
      return;
    }

    Alert.alert(
      'Submit Review?',
      'Your review will be hidden until the other party also submits their review.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              const { data: userData } = await supabase.auth.getUser();
              const userId = userData.user?.id;
              if (!userId) throw new Error('Not authenticated');

              const { error } = await supabase.from('reviews').insert({
                job_id: jobId,
                reviewer_id: userId,
                reviewee_id: otherPartyId,
                overall_rating: overall,
                performance_rating: performance || null,
                timing_rating: timing || null,
                cost_rating: cost || null,
                comment: comment.trim() || null,
                is_visible: false,
              });

              if (error) throw error;

              setHasSubmitted(true);
              await checkExistingReviews();
              onSuccess?.();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to submit review');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const StarRating = ({
    value,
    onChange,
    label,
    required,
  }: {
    value: number;
    onChange: (v: number) => void;
    label: string;
    required?: boolean;
  }) => (
    <View style={styles.ratingRow}>
      <Text style={[styles.ratingLabel, { color: colors.textPrimary }]}>
        {label}
        {required && <Text style={{ color: colors.accent }}> *</Text>}
      </Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onChange(star)} hitSlop={8}>
            <Ionicons
              name={star <= value ? 'star' : 'star-outline'}
              size={28}
              color={star <= value ? '#FBBF24' : colors.textMuted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Both submitted - show reviews
  if (hasSubmitted && otherSubmitted && myReview?.is_visible) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Reviews Revealed!</Text>
        </View>

        {/* My Review */}
        <View style={[styles.reviewCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={[styles.reviewCardTitle, { color: colors.textMuted }]}>Your Review</Text>
          <View style={styles.ratingDisplay}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= (myReview?.overall_rating ?? 0) ? 'star' : 'star-outline'}
                size={20}
                color={s <= (myReview?.overall_rating ?? 0) ? '#FBBF24' : colors.textMuted}
              />
            ))}
          </View>
          {myReview?.comment && (
            <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{myReview.comment}</Text>
          )}
        </View>

        {/* Their Review */}
        <View style={[styles.reviewCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={[styles.reviewCardTitle, { color: colors.textMuted }]}>
            {role === 'customer' ? "Mechanic's Review" : "Customer's Review"}
          </Text>
          <View style={styles.ratingDisplay}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= (otherReview?.overall_rating ?? 0) ? 'star' : 'star-outline'}
                size={20}
                color={s <= (otherReview?.overall_rating ?? 0) ? '#FBBF24' : colors.textMuted}
              />
            ))}
          </View>
          {otherReview?.comment && (
            <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{otherReview.comment}</Text>
          )}
        </View>
      </View>
    );
  }

  // Already submitted, waiting
  if (hasSubmitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={styles.waitingState}>
          <Ionicons name="hourglass" size={40} color={colors.accent} />
          <Text style={[styles.waitingTitle, { color: colors.textPrimary }]}>Review Submitted!</Text>
          <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
            Waiting for {role === 'customer' ? 'mechanic' : 'customer'} to submit their review.
            Reviews will be revealed once both are submitted.
          </Text>
        </View>
      </View>
    );
  }

  // Review form
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Ionicons name="star" size={24} color="#FBBF24" />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Rate Your {role === 'customer' ? 'Mechanic' : 'Customer'}
        </Text>
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        <StarRating value={overall} onChange={setOverall} label="Overall Experience" required />
        <StarRating value={performance} onChange={setPerformance} label="Quality of Work" />
        <StarRating value={timing} onChange={setTiming} label="Punctuality" />
        {role === 'customer' && (
          <StarRating value={cost} onChange={setCost} label="Value for Money" />
        )}

        <View style={styles.commentSection}>
          <Text style={[styles.commentLabel, { color: colors.textPrimary }]}>Comments (optional)</Text>
          <TextInput
            style={[
              styles.commentInput,
              { backgroundColor: colors.bg, borderColor: colors.border, color: colors.textPrimary },
            ]}
            value={comment}
            onChangeText={setComment}
            placeholder="Share your experience..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={[styles.infoBox, { backgroundColor: `${colors.accent}10` }]}>
          <Ionicons name="eye-off" size={20} color={colors.accent} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Your review will remain hidden until the other party also submits their review. This ensures honest feedback.
          </Text>
        </View>
      </ScrollView>

      <Pressable
        style={[styles.submitButton, { backgroundColor: colors.accent }]}
        onPress={handleSubmit}
        disabled={submitting || overall === 0}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Review</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  form: {
    padding: 16,
    maxHeight: 400,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  ratingLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
  },
  commentSection: {
    marginTop: 16,
  },
  commentLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    alignItems: 'flex-start',
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  waitingState: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  waitingText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  reviewCard: {
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  reviewCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  ratingDisplay: {
    flexDirection: 'row',
    gap: 4,
  },
  reviewComment: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

export default BlindReviewForm;
