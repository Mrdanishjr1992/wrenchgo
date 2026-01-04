import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { AppButton } from "../../../src/ui/components/AppButton";

type Job = {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  status: string;
  vehicle_id: string | null;
  created_at: string;
  updated_at: string;
};

export default function JobDetail() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);

  const loadJob = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .eq("customer_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error loading job:", error);
        Alert.alert("Error", "Failed to load job details. Please try again.");
        return;
      }

      if (!data) {
        Alert.alert("Not Found", "Job not found or you don't have access.");
        router.back();
        return;
      }

      setJob(data);
    } catch (error: any) {
      console.error("Job load error:", error);
      Alert.alert("Error", error?.message ?? "Failed to load job.");
    } finally {
      setLoading(false);
    }
  }, [jobId, router]);

  useFocusEffect(
    useCallback(() => {
      loadJob();
    }, [loadJob])
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <Text style={text.title}>Job not found</Text>
        <AppButton title="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  const statusColor = 
    job.status === "completed" ? colors.success :
    job.status === "in_progress" ? colors.accent :
    job.status === "cancelled" ? colors.error :
    colors.textSecondary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[card, { padding: spacing.lg, marginBottom: spacing.lg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <Ionicons name="construct" size={32} color={colors.accent} />
            <Text style={[text.title, { marginLeft: spacing.md, flex: 1 }]}>{job.title}</Text>
          </View>

          <View style={{ 
            paddingHorizontal: spacing.md, 
            paddingVertical: spacing.sm, 
            backgroundColor: statusColor + "22",
            borderRadius: 8,
            marginBottom: spacing.md,
            alignSelf: "flex-start"
          }}>
            <Text style={[text.body, { color: statusColor, fontWeight: "600" }]}>
              {job.status.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>

          {job.description && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[text.muted, { marginBottom: spacing.xs }]}>Description:</Text>
              <Text style={text.body}>{job.description}</Text>
            </View>
          )}

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={text.muted}>Created:</Text>
              <Text style={text.body}>{new Date(job.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={text.muted}>Last Updated:</Text>
              <Text style={text.body}>{new Date(job.updated_at).toLocaleDateString()}</Text>
            </View>
          </View>
        </View>

        <AppButton
          title="View Messages"
          variant="primary"
          onPress={() => router.push(`/(customer)/messages/${job.id}`)}
          style={{ marginBottom: spacing.md }}
        />

        {job.status === "accepted" && (
          <AppButton
            title="Make Payment"
            variant="primary"
            onPress={() => router.push(`/(customer)/payment/${job.id}`)}
            style={{ marginBottom: spacing.md }}
          />
        )}

        <AppButton title="Go Back" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}
