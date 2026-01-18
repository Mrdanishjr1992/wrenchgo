import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import ReviewForm from "../../../components/reviews/ReviewForm";
import { getReviewPromptForJob, markReviewPromptCompleted } from "../../../src/lib/reviews";
import { ThemedText } from "../../../src/ui/components/ThemedText";
import { ThemedCard } from "../../../src/ui/components/ThemedCard";
import { Skeleton } from "../../../src/ui/components/Skeleton";
import { AppButton } from "../../../src/ui/components/AppButton";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MechanicReviewScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revieweeId, setRevieweeId] = useState<string | null>(null);
  const [revieweeName, setRevieweeName] = useState<string>("Customer");
  const [promptId, setPromptId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    if (!jobId) return;

    setLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) throw new Error("Not authenticated");

      const prompt = await getReviewPromptForJob(userData.user.id, jobId);
      if (prompt) {
        setPromptId(prompt.id);
        setRevieweeId(prompt.target_user_id);
        setRevieweeName(prompt.target_name);
      } else {
        const { data: job } = await supabase
          .from("jobs")
          .select("customer_id")
          .eq("id", jobId)
          .single();

        if (job?.customer_id) {
          setRevieweeId(job.customer_id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", job.customer_id)
            .single();
          setRevieweeName(profile?.full_name || "Customer");
        }
      }
    } catch (err: any) {
      console.error("Error loading review data:", err);
      setError(err.message || "Failed to load review data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSuccess = async () => {
    if (promptId) {
      await markReviewPromptCompleted(promptId);
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

  if (error || !revieweeId || !jobId) {
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
      reviewerRole="mechanic"
      onSubmitSuccess={handleSubmitSuccess}
    />
  );
}
