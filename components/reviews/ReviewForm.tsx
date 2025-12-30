import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { CreateReviewPayload } from '@/src/types/reviews';

interface ReviewFormProps {
  jobId: string;
  revieweeId: string;
  reviewerRole: 'customer' | 'mechanic';
  revieweeRole: 'customer' | 'mechanic';
  onSubmit: (payload: CreateReviewPayload) => Promise<void>;
  onCancel?: () => void;
}

export function ReviewForm({
  jobId,
  revieweeId,
  reviewerRole,
  revieweeRole,
  onSubmit,
  onCancel,
}: ReviewFormProps) {
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  const [overallRating, setOverallRating] = useState(0);
  const [performanceRating, setPerformanceRating] = useState(0);
  const [timingRating, setTimingRating] = useState(0);
  const [costRating, setCostRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (overallRating === 0) {
      Alert.alert('Rating Required', 'Please provide an overall rating');
      return;
    }
    if (performanceRating === 0 || timingRating === 0 || costRating === 0) {
      Alert.alert('All Ratings Required', 'Please rate all categories');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        job_id: jobId,
        reviewee_id: revieweeId,
        reviewer_role: reviewerRole,
        reviewee_role: revieweeRole,
        overall_rating: overallRating,
        performance_rating: performanceRating,
        timing_rating: timingRating,
        cost_rating: costRating,
        comment: comment.trim() || undefined,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid =
    overallRating > 0 &&
    performanceRating > 0 &&
    timingRating > 0 &&
    costRating > 0;

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Overall Rating</Text>
        <StarSelector
          rating={overallRating}
          onRatingChange={setOverallRating}
          size={32}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Performance</Text>
        <Text style={[styles.sectionDescription, { color: iconColor }]}>
          Quality of work and professionalism
        </Text>
        <StarSelector
          rating={performanceRating}
          onRatingChange={setPerformanceRating}
          size={24}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Timing</Text>
        <Text style={[styles.sectionDescription, { color: iconColor }]}>
          Punctuality and time management
        </Text>
        <StarSelector
          rating={timingRating}
          onRatingChange={setTimingRating}
          size={24}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Cost</Text>
        <Text style={[styles.sectionDescription, { color: iconColor }]}>
          Value for money and pricing fairness
        </Text>
        <StarSelector
          rating={costRating}
          onRatingChange={setCostRating}
          size={24}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Your Review (Optional)
        </Text>
        <TextInput
          style={[
            styles.commentInput,
            { color: textColor, borderColor: iconColor },
          ]}
          placeholder="Share your experience..."
          placeholderTextColor={iconColor}
          multiline
          numberOfLines={6}
          value={comment}
          onChangeText={setComment}
          maxLength={1000}
        />
        <Text style={[styles.characterCount, { color: iconColor }]}>
          {comment.length}/1000
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        {onCancel && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={submitting}
          >
            <Text style={[styles.buttonText, { color: iconColor }]}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.button,
            styles.submitButton,
            { backgroundColor: tintColor },
            (!isValid || submitting) && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

interface StarSelectorProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  size?: number;
}

function StarSelector({ rating, onRatingChange, size = 24 }: StarSelectorProps) {
  return (
    <View style={styles.starSelector}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onRatingChange(star)}
          style={styles.starButton}
        >
          <Ionicons
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color="#FFB800"
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  starSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 120,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  submitButton: {
    flex: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
