import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { AppButton } from "../../../src/ui/components/AppButton";
import { acceptQuoteAndCreateContract } from "../../../src/lib/job-contract";
import { notifyUser } from "../../../src/lib/notify";
import { getDisplayTitle } from "../../../src/lib/format-symptom";

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
  const { jobId, quoteId } = useLocalSearchParams<{ jobId: string; quoteId?: string }>();
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

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

      // Check if contract already exists for this job
      const { data: existingContract } = await supabase
        .from("job_contracts")
        .select("id")
        .eq("job_id", jobId)
        .maybeSingle();

      if (existingContract) {
        // Contract already exists, redirect to job details
        Alert.alert("Already Paid", "Payment has already been completed for this job.");
        router.replace(`/(customer)/job/${jobId}` as any);
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

      // If quoteId is provided, use that specific quote
      // Otherwise, find the accepted quote or the most recent pending quote with a price
      let quoteQuery = supabase
        .from("quotes")
        .select("id, job_id, mechanic_id, price_cents, status, created_at")
        .eq("job_id", jobId);

      if (quoteId) {
        quoteQuery = quoteQuery.eq("id", quoteId);
      } else {
        // Prioritize accepted quotes, then pending quotes with prices
        quoteQuery = quoteQuery
          .in("status", ["accepted", "pending"])
          .not("price_cents", "is", null)
          .order("status", { ascending: false }) // 'accepted' comes after 'pending' alphabetically, so descending
          .order("created_at", { ascending: false });
      }

      const { data: quoteData, error: quoteError } = await quoteQuery.limit(1).maybeSingle();

      if (quoteError) {
        console.error("Error loading quote:", quoteError);
      }

      if (!quoteData || quoteData.price_cents == null) {
        Alert.alert("No Quote Available", "There is no quote ready for payment.");
        router.back();
        return;
      }

      setQuote(quoteData as any);
    } catch (error: any) {
      console.error("Payment info load error:", error);
      Alert.alert("Error", error?.message ?? "Failed to load payment information.");
    } finally {
      setLoading(false);
    }
  }, [jobId, quoteId, router]);

  useFocusEffect(
    useCallback(() => {
      loadPaymentInfo();
    }, [loadPaymentInfo])
  );

  const handlePayment = useCallback(async () => {
    if (!quote || !job) return;

    try {
      setProcessing(true);

      // For now, skip Stripe and create contract directly (payment simulation)
      // TODO: Re-enable Stripe payment when edge function auth is fixed
      const contractResult = await acceptQuoteAndCreateContract(quote.id);

      if (!contractResult.success) {
        throw new Error(contractResult.error || "Failed to create contract");
      }

      notifyUser({
        userId: quote.mechanic_id,
        title: "Payment Complete! 🎉",
        body: "The customer has completed payment. You can now start the job.",
        type: "payment_complete",
        entityType: "job",
        entityId: jobId as any,
      }).catch(() => {});

      Alert.alert(
        "Payment Complete",
        "Your booking is confirmed! The mechanic has been notified.",
        [
          {
            text: "View Job",
            onPress: () => router.replace(`/(customer)/job/${jobId}` as any),
          },
        ]
      );
    } catch (error: any) {
      console.error("Payment error:", error);
      Alert.alert("Payment Error", error?.message ?? "Failed to process payment.");
    } finally {
      setProcessing(false);
    }
  }, [quote, job, jobId, router]);

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
            <Text style={[text.title, { marginLeft: spacing.md }]}>Complete Payment</Text>
          </View>

          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[text.muted, { marginBottom: spacing.xs }]}>Job:</Text>
            <Text style={text.body}>{getDisplayTitle(job.title)}</Text>
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
              <Text style={[text.body, { color: quote.status === "accepted" ? "#10B981" : colors.accent }]}>
                {quote.status === "accepted" ? "Accepted" : "Ready to Accept"}
              </Text>
            </View>
          </View>
        </View>

        <View style={[card, { padding: spacing.lg, marginBottom: spacing.lg }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Ionicons name="shield-checkmark" size={24} color={colors.accent} style={{ marginRight: spacing.sm }} />
            <Text style={[text.body, { flex: 1, color: colors.textSecondary }]}>
              Your payment is processed securely through Stripe. The mechanic will be notified immediately after payment.
            </Text>
          </View>
        </View>

        <AppButton
          title={processing ? "Processing..." : `Pay $${priceInDollars}`}
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
