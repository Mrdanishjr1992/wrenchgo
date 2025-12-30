import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { canUserReviewJob, submitReview } from '@/src/lib/reviews';
import { supabase } from '@/src/lib/supabase';
import type { CreateReviewPayload } from '@/src/types/reviews';

export default function ReviewJobScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const tintColor = useThemeColor({}, 'tint');

  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [jobData, setJobData] = useState<{
    revieweeId: string;
    revieweeName: string;
    reviewerRole: 'customer' | 'mechanic';
    revieweeRole: 'customer' | 'mechanic';
  } | null>(null);

  useEffect(() => {
    checkReviewEligibility();
  }, [jobId]);

  const checkReviewEligibility = async () => {
    if (!jobId) return;

    setLoading(true);

    const { canReview: eligible, reason: errorReason } = await canUserReviewJob(jobId);
    setCanReview(eligible);
    setReason(errorReason || '');

    if (eligible) {
      await loadJobData();
    }

    setLoading(false);
  };

  const loadJobData = async () => {
    if (!jobId) return;

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        id,
        customer_id,
        accepted_mechanic_id,
        customer:profiles!jobs_customer_id_fkey (
          id,
          full_name,
          display_name
        ),
        mechanic:profiles!jobs_accepted_mechanic_id_fkey (
          id,
          full_name,
          display_name
        )
      `)
      .eq('id', jobId)
      .single();

    if (error || !job) {
      console.error('Error loading job:', error);
      return;
    }

    const userId = session.session.user.id;
    const isCustomer = job.customer_id === userId;

    setJobData({
      revieweeId: isCustomer ? job.accepted_mechanic_id : job.customer_id,
      revieweeName: isCustomer
        ? (job.mechanic?.display_name || job.mechanic?.full_name || 'Mechanic')
        : (job.customer?.display_name || job.customer?.full_name || 'Customer'),
      reviewerRole: isCustomer ? 'customer' : 'mechanic',
      revieweeRole: isCustomer ? 'mechanic' : 'customer',
    });
  };

  const handleSubmit = async (payload: CreateReviewPayload) => {
    const result = await submitReview(payload);
    
    if (result.success) {
      Alert.alert(
        'Success',
        'Your review has been submitted!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to submit review');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
      </View>
    );
  }

  if (!canReview || !jobData) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Leave Review',
            headerBackTitle: 'Back',
          }}
        />
        <View style={[styles.errorContainer, { backgroundColor }]}>
          <Text style={[styles.errorText, { color: textColor }]}>
            {reason || 'Unable to review this job'}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `Review ${jobData.revieweeName}`,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: textColor }]}>
            How was your experience?
          </Text>
          <Text style={[styles.headerSubtitle, { color: textColor }]}>
            Your feedback helps improve the WrenchGo community
          </Text>
        </View>

        <ReviewForm
          jobId={jobId!}
          revieweeId={jobData.revieweeId}
          reviewerRole={jobData.reviewerRole}
          revieweeRole={jobData.revieweeRole}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    padding: 16,
    paddingTop: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
});
