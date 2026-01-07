import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import ReviewForm from "../../../components/reviews/ReviewForm";
import { getReviewPromptForJob, markReviewPromptCompleted } from "../../../src/lib/reviews";

export default function MechanicReviewScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { colors, text, spacing } = useTheme();

  const [loading, setLoading] = useState(true);
  const [revieweeId, setRevieweeId] = useState<string | null>(null);
  const [revieweeName, setRevieweeName] = useState<string>("Customer");
  const [promptId, setPromptId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    if (!jobId) return;

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) return;

      // Get review prompt
      const prompt = await getReviewPromptForJob(userData.user.id, jobId);
      if (prompt) {
        setPromptId(prompt.id);
        setRevieweeId(prompt.target_user_id);
        setRevieweeName(prompt.target_name);
      } else {
        // Fallback: get customer from job
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
    } catch (err) {
      console.error("Error loading review data:", err);
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
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!revieweeId || !jobId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: spacing.lg }}>
        <Text style={text.body}>Unable to load review form</Text>
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
