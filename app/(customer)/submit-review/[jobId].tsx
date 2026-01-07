import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { useTheme } from '../../../src/ui/theme-context';
import ReviewForm from '../../../components/reviews/ReviewForm';

export default function SubmitReviewScreen() {
  const { colors, text, spacing } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [loading, setLoading] = useState(true);
  const [revieweeId, setRevieweeId] = useState<string | null>(null);
  const [revieweeName, setRevieweeName] = useState<string>('');
  const [reviewerRole, setReviewerRole] = useState<'customer' | 'mechanic'>('customer');

  useEffect(() => {
    loadReviewData();
  }, [jobId]);

  const loadReviewData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('customer_id')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;

      const isCustomer = job.customer_id === userData.user.id;
      setReviewerRole(isCustomer ? 'customer' : 'mechanic');

      if (isCustomer) {
        const { data: contract, error: contractError } = await supabase
          .from('job_contracts')
          .select('mechanic_id, mechanic:profiles!job_contracts_mechanic_id_fkey(full_name)')
          .eq('job_id', jobId)
          .single();

        if (contractError) throw contractError;

        setRevieweeId(contract.mechanic_id);
        setRevieweeName((contract.mechanic as any)?.full_name || 'Mechanic');
      } else {
        const { data: jobData, error: jobDataError } = await supabase
          .from('jobs')
          .select('customer_id, customer:profiles!jobs_customer_id_fkey(full_name)')
          .eq('id', jobId)
          .single();

        if (jobDataError) throw jobDataError;

        setRevieweeId(jobData.customer_id);
        setRevieweeName((jobData.customer as any)?.full_name || 'Customer');
      }
    } catch (err: any) {
      console.error('Load review data error:', err);
      Alert.alert('Error', 'Failed to load review information');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!revieweeId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.lg }}>
        <Text style={[text.base, { color: colors.textSecondary }]}>Unable to load review information</Text>
      </View>
    );
  }

  return (
    <ReviewForm
      jobId={jobId}
      revieweeId={revieweeId}
      revieweeName={revieweeName}
      reviewerRole={reviewerRole}
      onSubmitSuccess={() => {
        router.back();
      }}
    />
  );
}
