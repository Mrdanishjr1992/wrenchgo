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
  const [reviewerRole, setReviewerRole] = useState<'customer' | 'mechanic'>('mechanic');

  useEffect(() => {
    loadReviewData();
  }, [jobId]);

  const loadReviewData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: contract, error: contractError } = await supabase
        .from('job_contracts')
        .select('mechanic_id, job_id, job:jobs!job_contracts_job_id_fkey(customer_id, customer:profiles!jobs_customer_id_fkey(full_name))')
        .eq('job_id', jobId)
        .single();

      if (contractError) throw contractError;

      const isMechanic = contract.mechanic_id === userData.user.id;
      setReviewerRole(isMechanic ? 'mechanic' : 'customer');

      if (isMechanic) {
        const job = contract.job as any;
        setRevieweeId(job.customer_id);
        setRevieweeName(job.customer?.full_name || 'Customer');
      } else {
        router.replace(`/(customer)/submit-review/${jobId}`);
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
