import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { useTheme } from '../../../src/ui/theme-context';
import ReviewForm from '../../../components/reviews/ReviewForm';
import { ThemedText } from '../../../src/ui/components/ThemedText';
import { ThemedCard } from '../../../src/ui/components/ThemedCard';
import { Skeleton } from '../../../src/ui/components/Skeleton';
import { AppButton } from '../../../src/ui/components/AppButton';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SubmitReviewScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revieweeId, setRevieweeId] = useState<string | null>(null);
  const [revieweeName, setRevieweeName] = useState<string>('');
  const [reviewerRole, setReviewerRole] = useState<'customer' | 'mechanic'>('customer');

  useEffect(() => {
    loadReviewData();
  }, [jobId]);

  const loadReviewData = async () => {
    try {
      setError(null);
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
      setError(err.message || 'Failed to load review information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <ThemedCard style={{ marginBottom: spacing.lg, alignItems: 'center' }}>
          <Skeleton width={64} height={64} borderRadius={32} style={{ marginBottom: spacing.md }} />
          <Skeleton width={150} height={20} style={{ marginBottom: spacing.xs }} />
          <Skeleton width={200} height={14} />
        </ThemedCard>
        
        <ThemedCard style={{ marginBottom: spacing.lg }}>
          <Skeleton width={100} height={14} style={{ marginBottom: spacing.sm }} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width={40} height={40} borderRadius={20} />
            ))}
          </View>
        </ThemedCard>
        
        <ThemedCard style={{ marginBottom: spacing.lg }}>
          <Skeleton width={120} height={14} style={{ marginBottom: spacing.md }} />
          <Skeleton width="100%" height={50} style={{ marginBottom: spacing.sm }} />
          <Skeleton width="100%" height={50} style={{ marginBottom: spacing.sm }} />
          <Skeleton width="100%" height={50} />
        </ThemedCard>
      </View>
    );
  }

  if (error || !revieweeId) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: colors.bg, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: spacing.xl,
        paddingBottom: insets.bottom + spacing.xl
      }}>
        <View style={{ 
          width: 80, 
          height: 80, 
          borderRadius: 40, 
          backgroundColor: colors.errorBg, 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: spacing.lg
        }}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
        </View>
        <ThemedText variant="h3" style={{ marginBottom: spacing.sm, textAlign: 'center' }}>
          Unable to Load Review
        </ThemedText>
        <ThemedText variant="body" color="muted" style={{ textAlign: 'center', marginBottom: spacing.lg }}>
          {error || 'Could not find review information for this job'}
        </ThemedText>
        <AppButton 
          label="Go Back" 
          variant="secondary" 
          onPress={() => router.back()} 
        />
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
