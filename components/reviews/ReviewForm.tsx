import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { supabase } from '../../src/lib/supabase';

type ReviewFormProps = {
  jobId: string;
  revieweeId: string;
  revieweeName: string;
  reviewerRole: 'customer' | 'mechanic';
  onSubmitSuccess?: () => void;
};

export default function ReviewForm({
  jobId,
  revieweeId,
  revieweeName,
  reviewerRole,
  onSubmitSuccess,
}: ReviewFormProps) {
  const { colors, text, spacing } = useTheme();
  const router = useRouter();

  const [rating, setRating] = useState(0);
  const [professionalismRating, setProfessionalismRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select an overall rating');
      return;
    }

    if (wouldRecommend === null) {
      Alert.alert('Recommendation Required', 'Please indicate if you would recommend');
      return;
    }

    setSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('submit_review', {
        p_job_id: jobId,
        p_reviewer_id: userData.user.id,
        p_reviewee_id: revieweeId,
        p_rating: rating,
        p_comment: comment.trim() || null,
        p_professionalism_rating: professionalismRating || null,
        p_communication_rating: communicationRating || null,
        p_would_recommend: wouldRecommend,
      });

      if (error) throw error;

      const result = data as { published: boolean; blind_deadline: string };

      Alert.alert(
        'Review Submitted',
        result.published
          ? 'Your review has been published.'
          : 'Your review will be published once the other party submits their review, or after 7 days.',
        [
          {
            text: 'OK',
            onPress: () => {
              onSubmitSuccess?.();
              router.back();
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Review submission error:', err);
      Alert.alert('Error', err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (
    currentRating: number,
    onPress: (rating: number) => void,
    label: string
  ) => (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[text.muted, { marginBottom: spacing.xs }]}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onPress(star)}>
            <Ionicons
              name={star <= currentRating ? 'star' : 'star-outline'}
              size={32}
              color={star <= currentRating ? '#FFB800' : colors.border}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <Text style={[text.title, { marginBottom: spacing.xs }]}>
        Review {revieweeName}
      </Text>
      <Text style={[text.muted, { marginBottom: spacing.xl }]}>
        Your honest feedback helps improve the WrenchGo community
      </Text>

      {renderStars(rating, setRating, 'Overall Rating *')}

      {renderStars(
        professionalismRating,
        setProfessionalismRating,
        'Professionalism (Optional)'
      )}

      {renderStars(
        communicationRating,
        setCommunicationRating,
        'Communication (Optional)'
      )}

      <View style={{ marginBottom: spacing.md }}>
        <Text style={[text.muted, { marginBottom: spacing.xs }]}>
          Would you recommend? *
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Pressable
            onPress={() => setWouldRecommend(true)}
            style={{
              flex: 1,
              padding: spacing.md,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: wouldRecommend === true ? colors.primary : colors.border,
              backgroundColor: wouldRecommend === true ? colors.primary + '10' : 'transparent',
            }}
          >
            <Text
              style={[
                text.body,
                {
                  textAlign: 'center',
                  fontWeight: wouldRecommend === true ? '600' : '400',
                  color: wouldRecommend === true ? colors.primary : colors.text,
                },
              ]}
            >
              Yes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setWouldRecommend(false)}
            style={{
              flex: 1,
              padding: spacing.md,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: wouldRecommend === false ? colors.error : colors.border,
              backgroundColor: wouldRecommend === false ? colors.error + '10' : 'transparent',
            }}
          >
            <Text
              style={[
                text.body,
                {
                  textAlign: 'center',
                  fontWeight: wouldRecommend === false ? '600' : '400',
                  color: wouldRecommend === false ? colors.error : colors.text,
                },
              ]}
            >
              No
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ marginBottom: spacing.xl }}>
        <Text style={[text.muted, { marginBottom: spacing.xs }]}>
          Written Feedback (Optional)
        </Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder={
            reviewerRole === 'customer'
              ? 'Share your experience with this mechanic...'
              : 'Share your experience with this customer...'
          }
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={4}
          style={[
            text.body,
            {
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: spacing.md,
              minHeight: 100,
              textAlignVertical: 'top',
              color: colors.text,
            },
          ]}
        />
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={submitting || rating === 0 || wouldRecommend === null}
        style={{
          backgroundColor:
            submitting || rating === 0 || wouldRecommend === null
              ? colors.border
              : colors.primary,
          padding: spacing.md,
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[text.button, { color: '#fff' }]}>Submit Review</Text>
        )}
      </Pressable>

      <Text
        style={[
          text.muted,
          { fontSize: 11, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        Reviews are hidden until both parties submit, or after 7 days
      </Text>
    </ScrollView>
  );
}
