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
  status: string;
};

type Quote = {
  id: string;
  job_id: string;
  mechanic_id: string;
  price_cents: number;
  status: string;
  accepted_at: string | null;
};

export default function JobPayment() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [processing, setProcessing] = useState(false);

  const loadPaymentInfo = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id, customer_id, title, status")
        .eq("id", jobId)
        .eq("customer_id", userId)
        .maybeSingle();

      if (jobError || !jobData) {
        console.error("Error loading job:", jobError);
        Alert.alert("Error", "Failed to load job details.");
        router.back();
        return;
      }

      setJob(jobData);

      const { data: quoteData, error: quoteError } = await supabase
        .from("quote_requests")
        .select("id, job_id, mechanic_id, price_cents, status, accepted_at")
        .eq("job_id", jobId)
        .eq("status", "accepted")
        .maybeSingle();

      if (quoteError) {
        console.error("Error loading quote:", quoteError);
      }

      setQuote(quoteData);
    } catch (error: any) {
      console.error("Payment info load error:", error);
      Alert.alert("Error", error?.message ?? "Failed to load payment information.");
    } finally {
      setLoading(false);
    }
  }, [jobId, router]);

  useFocusEffect(
    useCallback(() => {
      loadPaymentInfo();
    }, [loadPaymentInfo])
  );

  const handlePayment = useCallback(async () => {
    if (!quote) return;

    Alert.alert(
      "Payment Coming Soon",
      "Payment processing will be integrated in a future update. For now, please coordinate payment directly with your mechanic.",
      [{ text: "OK" }]
    );
  }, [quote]);

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

  if (!quote) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <View style={[card, { padding: spacing.lg, alignItems: "center" }]}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[text.title, { marginTop: spacing.md, textAlign: "center" }]}>No Accepted Quote</Text>
          <Text style={[text.body, { marginTop: spacing.sm, textAlign: "center" }]}>
            You need to accept a quote before making a payment.
          </Text>
        </View>
        <AppButton title="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  const priceInDollars = (quote.price_cents / 100).toFixed(2);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[card, { padding: spacing.lg, marginBottom: spacing.lg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <Ionicons name="card" size={32} color={colors.accent} />
            <Text style={[text.title, { marginLeft: spacing.md }]}>Payment</Text>
          </View>

          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[text.muted, { marginBottom: spacing.xs }]}>Job:</Text>
            <Text style={text.body}>{job.title}</Text>
          </View>

          <View style={{ 
            padding: spacing.lg, 
            backgroundColor: colors.accent + "11",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.accent + "33",
            marginBottom: spacing.lg
          }}>
            <Text style={[text.muted, { marginBottom: spacing.xs }]}>Amount Due:</Text>
            <Text style={[text.title, { fontSize: 32, color: colors.accent }]}>${priceInDollars}</Text>
          </View>

          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={text.muted}>Quote Status:</Text>
              <Text style={[text.body, { color: colors.success }]}>Accepted</Text>
            </View>
            {quote.accepted_at && (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={text.muted}>Accepted On:</Text>
                <Text style={text.body}>{new Date(quote.accepted_at).toLocaleDateString()}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={[card, { padding: spacing.lg, marginBottom: spacing.lg, backgroundColor: colors.accent + "11" }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Ionicons name="information-circle" size={24} color={colors.accent} style={{ marginRight: spacing.sm }} />
            <Text style={[text.body, { flex: 1 }]}>
              Payment processing is coming soon. For now, please coordinate payment directly with your mechanic through the messaging system.
            </Text>
          </View>
        </View>

        <AppButton
          title="Process Payment (Coming Soon)"
          variant="primary"
          onPress={handlePayment}
          disabled={processing}
          style={{ marginBottom: spacing.md }}
        />

        <AppButton title="Go Back" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}
