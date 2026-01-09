import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { createCard } from "../../src/ui/styles";
import { getDisplayTitle } from "../../src/lib/format-symptom";
import { usePayoutStatus } from "../../src/lib/payment-gate";
import React from "react";

type QuoteType = "diagnostic_only" | "range" | "fixed";

type Job = {
  id: string;
  title: string;
  vehicle: {
    year: number;
    make: string;
    model: string;
  } | null;
};

const DRIVE_FEE = 50;
const DIAGNOSTIC_FEE = 80;

export default function QuoteReview() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    jobId: string;
    quoteType: QuoteType;
    hourlyRate: string;
    estimatedHours: string;
    hoursLow: string;
    hoursHigh: string;
    includeDiagnosticFee: string;
    includeDriveFee: string;
    arrivalDate: string;
    arrivalTime: string;
    durationMinutes: string;
    message: string;
  }>();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const payoutStatus = usePayoutStatus();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    loadJob();
  }, [params.jobId]);

  const loadJob = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          `
          id,
          title,
          vehicle:vehicles(year, make, model)
        `
        )
        .eq("id", params.jobId)
        .single();

      if (error) throw error;

      const jobData = {
        ...data,
        vehicle: Array.isArray(data.vehicle) ? data.vehicle[0] : data.vehicle
      };

      setJob(jobData);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load job");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getQuoteTypeLabel = (type: QuoteType) => {
    const labels: Record<QuoteType, string> = {
      diagnostic_only: "Diagnostic Only",
      range: "Range Quote",
      fixed: "Fixed Price",
    };
    return labels[type];
  };

  const calculatePricing = () => {
    const hourlyRate = parseFloat(params.hourlyRate || "0");
    const includeDiagnostic = params.includeDiagnosticFee === "true";
    const includeDrive = params.includeDriveFee !== "false"; // default true

    const baseFees = (includeDrive ? DRIVE_FEE : 0) + (includeDiagnostic ? DIAGNOSTIC_FEE : 0);

    if (params.quoteType === "range") {
      const hoursLow = parseFloat(params.hoursLow || "0");
      const hoursHigh = parseFloat(params.hoursHigh || "0");

      const laborLow = hourlyRate * hoursLow;
      const laborHigh = hourlyRate * hoursHigh;

      return {
        isTBD: false,
        laborLow,
        laborHigh,
        fees: baseFees,
        totalLow: laborLow + baseFees,
        totalHigh: laborHigh + baseFees,
        includeDrive,
        includeDiagnostic,
      };
    }

    const estimatedHours = parseFloat(params.estimatedHours || "0");
    const labor = hourlyRate * estimatedHours;

    return {
      isTBD: false,
      labor,
      fees: baseFees,
      total: labor + baseFees,
      includeDrive,
      includeDiagnostic,
    };
  };

  const pricing = calculatePricing();
  const includeDiagnostic = params.includeDiagnosticFee === "true";
  const includeDrive = params.includeDriveFee !== "false";

  const getExpectationText = () => {
    if (params.quoteType === "diagnostic_only") {
      return `$${DIAGNOSTIC_FEE} diagnostic fee, repair quoted separately`;
    }
    if (params.quoteType === "range") {
      return "Final total will fall within the stated range";
    }
    if (params.quoteType === "fixed") {
      return "Total includes labor estimate + fees";
    }
    return "";
  };

  const getCustomerExpectation = () => {
    if (params.quoteType === "diagnostic_only") {
      return "Inspection and diagnosis, not full repair";
    }
    if (params.quoteType === "range") {
      return "Repair with final price in stated range";
    }
    if (params.quoteType === "fixed") {
      return "Complete repair at quoted price";
    }
    return "";
  };

  const handleSendQuote = async () => {
    if (!payoutStatus.isReady) {
      Alert.alert(
        "Payout Setup Required",
        "Please set up your payout account before sending quotes.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Set Up Payout",
            onPress: () => router.push("/(mechanic)/stripe-onboarding")
          },
        ]
      );
      return;
    }

    try {
      setSubmitting(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        Alert.alert("Error", "Not signed in");
        return;
      }

      const arrivalTimeStr =
        params.arrivalDate && params.arrivalTime
          ? `${params.arrivalDate} ${params.arrivalTime}`
          : null;

      let priceCents: number;
      let notesText = params.message || null;

      if (params.quoteType === "range") {
        const priceLowCents = Math.round(pricing.totalLow! * 100);
        const priceHighCents = Math.round(pricing.totalHigh! * 100);
        priceCents = Math.round((priceLowCents + priceHighCents) / 2);
        notesText = `Range: $${(priceLowCents / 100).toFixed(0)} - $${(priceHighCents / 100).toFixed(0)}${notesText ? '\n\n' + notesText : ''}`;
      } else {
        priceCents = Math.round(pricing.total! * 100);
      }

      // Add fee breakdown to notes (only mechanic-related fees, not platform fee)
      const feeBreakdown = [];
      if (includeDrive) feeBreakdown.push(`Drive fee: $${DRIVE_FEE}`);
      if (includeDiagnostic) feeBreakdown.push(`Diagnostic fee: $${DIAGNOSTIC_FEE}`);

      if (feeBreakdown.length > 0) {
        notesText = (notesText ? notesText + '\n\n' : '') + 'Fees included:\n' + feeBreakdown.join('\n');
      }

      const estimatedHours = params.durationMinutes ? parseInt(params.durationMinutes) / 60 : null;

      const { data: result, error } = await supabase.rpc('submit_quote_with_payment_check', {
        p_job_id: params.jobId,
        p_price_cents: priceCents,
        p_estimated_hours: estimatedHours,
        p_notes: notesText,
      });

      if (error) throw error;

      if (!result?.success) {
        // For mechanics, any payment-related error means payout not set up
        if (result?.code === 'PAYMENT_METHOD_REQUIRED' || result?.code === 'PAYOUT_NOT_SETUP') {
          Alert.alert(
            "Payout Setup Required",
            "Please set up your payout account before sending quotes.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Set Up Payout", onPress: () => router.push("/(mechanic)/stripe-onboarding") },
            ]
          );
          return;
        }
        throw new Error(result?.message || 'Failed to submit quote');
      }

      // Get customer_id from job to send notification
      const { data: jobData } = await supabase
        .from("jobs")
        .select("customer_id, title")
        .eq("id", params.jobId)
        .single();

      if (jobData?.customer_id) {
        const { notifyUser } = await import("../../src/lib/notify");
        await notifyUser({
          userId: jobData.customer_id,
          title: "New Quote Received",
          body: `You received a quote for ${getDisplayTitle(jobData.title) || "your job"}: $${(priceCents / 100).toFixed(0)}`,
          type: "quote_received",
          entityType: "job",
          entityId: params.jobId,
        });
      }

      // Update job status to "quoted" - handle any prior status except accepted/completed/cancelled
      const { error: updateError } = await supabase
        .from("jobs")
        .update({ status: "quoted", updated_at: new Date().toISOString() })
        .eq("id", params.jobId)
        .in("status", ["searching", "draft"]); // Only update from initial states

      // Log but don't fail if update didn't affect rows (job may already be quoted)
      if (updateError) {
        console.warn("Job status update warning:", updateError.message);
      }

      router.replace(`/(mechanic)/quote-sent/${params.jobId}` as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to send quote");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={text.body}>Job not found</Text>
      </View>
    );
  }

  const vehicleText = job.vehicle
    ? `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`
    : "Vehicle";

  const renderPricingBreakdown = () => {
    return (
      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...text.muted, fontSize: 13 }}>Pricing Breakdown</Text>

        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...text.body, fontSize: 14 }}>Hourly rate</Text>
            <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
              ${params.hourlyRate}/hr
            </Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...text.body, fontSize: 14 }}>Estimated hours</Text>
            <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
              {params.quoteType === "range"
                ? `${params.hoursLow} - ${params.hoursHigh} hrs`
                : `${params.estimatedHours} hrs`}
            </Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...text.body, fontSize: 14 }}>Labor subtotal</Text>
            <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
              {params.quoteType === "range"
                ? `$${pricing.laborLow!.toFixed(0)} - $${pricing.laborHigh!.toFixed(0)}`
                : `$${pricing.labor!.toFixed(0)}`}
            </Text>
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginVertical: 4,
            }}
          />

          {includeDrive && (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ ...text.body, fontSize: 14 }}>Drive fee</Text>
              <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                ${DRIVE_FEE}
              </Text>
            </View>
          )}

          {includeDiagnostic && (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ ...text.body, fontSize: 14 }}>Diagnostic fee</Text>
              <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                ${DIAGNOSTIC_FEE}
              </Text>
            </View>
          )}

          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginVertical: 4,
            }}
          />

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...text.body, fontSize: 16, fontWeight: "700" }}>Total</Text>
            <Text style={{ ...text.body, fontSize: 20, fontWeight: "900", color: colors.accent }}>
              {params.quoteType === "range"
                ? `$${pricing.totalLow!.toFixed(0)} - $${pricing.totalHigh!.toFixed(0)}`
                : `$${pricing.total!.toFixed(0)}`}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const getTotalDisplay = () => {
    if (params.quoteType === "range") {
      return `$${pricing.totalLow!.toFixed(0)} - $${pricing.totalHigh!.toFixed(0)}`;
    }

    return `$${pricing.total!.toFixed(0)}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: "Review Quote",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerBackVisible: true,
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/(mechanic)/jobs" as any)}
              style={{ marginRight: 4 }}
            >
              <Text style={{ ...text.body, fontSize: 15, color: colors.textPrimary }}>
                Close
              </Text>
            </Pressable>
          ),
        }}
      />

      {!payoutStatus.isLoading && !payoutStatus.isReady && (
        <Pressable
          onPress={() => router.push("/(mechanic)/stripe-onboarding")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#FEF3C7",
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
          }}
        >
          <Ionicons name="warning" size={20} color="#D97706" />
          <Text style={{ flex: 1, fontSize: 14, color: "#92400E", fontWeight: "600" }}>
            Set up your payout account to send quotes
          </Text>
          <Text style={{ fontSize: 13, color: "#D97706", fontWeight: "700" }}>
            Set Up →
          </Text>
        </Pressable>
      )}

      {payoutStatus.isLoading && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
          }}
        >
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            Checking payout status...
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <View style={[
          card, 
          { padding: spacing.lg,
             gap: spacing.md,
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.black, }]}>
          <Text style={{ ...text.body, fontWeight: "700", fontSize: 18 }}>Your Quote Summary</Text>

          <View style={{ gap: spacing.sm }}>
            <View>
              <Text style={{ ...text.muted, fontSize: 13 }}>Vehicle</Text>
              <Text style={{ ...text.body, fontSize: 15, marginTop: 2 }}>
                {vehicleText} • {getDisplayTitle(job.title)}
              </Text>
            </View>

            <View>
              <Text style={{ ...text.muted, fontSize: 13 }}>Quote type</Text>
              <Text style={{ ...text.body, fontSize: 15, marginTop: 2 }}>
                {getQuoteTypeLabel(params.quoteType)}
              </Text>
            </View>

            {renderPricingBreakdown()}

            {(params.arrivalDate || params.arrivalTime) && (
              <View>
                <Text style={{ ...text.muted, fontSize: 13 }}>Arrival</Text>
                <Text style={{ ...text.body, fontSize: 15, marginTop: 2 }}>
                  {params.arrivalDate} {params.arrivalTime}
                </Text>
              </View>
            )}

            {params.durationMinutes && (
              <View>
                <Text style={{ ...text.muted, fontSize: 13 }}>Duration</Text>
                <Text style={{ ...text.body, fontSize: 15, marginTop: 2 }}>
                  {Math.round(parseInt(params.durationMinutes) / 60)} hours
                </Text>
              </View>
            )}

            {params.message && (
              <View>
                <Text style={{ ...text.muted, fontSize: 13 }}>Your note</Text>
                <Text style={{ ...text.body, fontSize: 15, marginTop: 2, lineHeight: 22 }}>
                  &ldquo;{params.message}&rdquo;
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[card, { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface, borderColor: colors.black }]}> 
          <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>What the Customer Will See</Text>

          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.black,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.body, fontWeight: "700", fontSize: 18 }}>
                  {getTotalDisplay()}
                </Text>
                <Text style={{ ...text.section, fontSize: 13, marginTop: 2 }}>
                  {getQuoteTypeLabel(params.quoteType)}
                </Text>
                <Text style={{ ...text.section, fontSize: 12, marginTop: 4 }}>
                  Includes: labor + fees
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.sm,
                  backgroundColor: colors.accent + "20",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.accent}}>NEW</Text>
              </View>
            </View>

            {(
              <Pressable
                onPress={() => setShowBreakdown(!showBreakdown)}
                style={{
                  marginTop: spacing.sm,
                  paddingTop: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ ...text.muted, fontSize: 12, fontWeight: "600" }}>
                    {showBreakdown ? "Hide" : "See"} breakdown
                  </Text>
                  <Ionicons
                    name={showBreakdown ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={colors.textMuted}
                  />
                </View>
              </Pressable>
            )}

            {showBreakdown && !pricing.isTBD && (
              <View style={{ marginTop: spacing.sm, gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ ...text.muted, fontSize: 12 }}>Labor</Text>
                  <Text style={{ ...text.muted, fontSize: 12 }}>
                    {params.quoteType === "range"
                      ? `$${pricing.laborLow!.toFixed(0)} - $${pricing.laborHigh!.toFixed(0)}`
                      : `$${pricing.labor!.toFixed(0)}`}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ ...text.muted, fontSize: 12 }}>Fees</Text>
                  <Text style={{ ...text.muted, fontSize: 12 }}>${pricing.fees.toFixed(0)}</Text>
                </View>
              </View>
            )}

            {(params.arrivalDate || params.arrivalTime) && (
              <Text style={{ ...text.muted, fontSize: 13, marginTop: spacing.xs }}>
                Arrival: {params.arrivalDate} {params.arrivalTime}
              </Text>
            )}

            {params.message && (
              <Text style={{ ...text.body, fontSize: 14, marginTop: spacing.sm, lineHeight: 20 }}>
                {params.message}
              </Text>
            )}
          </View>
        </View>

        <View style={[card, { padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surface, borderColor: colors.black, borderWidth: 1 }]}> 
          <Text style={{ ...text.body, fontWeight: "700", fontSize: 14 }}>Before You Send</Text>

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent} style={{ marginTop: 2 }} />
            <Text style={{ ...text.body, fontSize: 13, flex: 1 }}>
              <Text style={{ fontWeight: "700" }}>Price includes:</Text> {getExpectationText()}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent} style={{ marginTop: 2 }} />
            <Text style={{ ...text.body, fontSize: 13, flex: 1 }}>
              <Text style={{ fontWeight: "700" }}>Customer expects:</Text> {getCustomerExpectation()}
            </Text>
          </View>

          {params.quoteType === "diagnostic_only" && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.accent} style={{ marginTop: 2 }} />
              <Text style={{ ...text.body, fontSize: 13, flex: 1 }}>
                <Text style={{ fontWeight: "700" }}>If job changes:</Text> You can update the quote after
                diagnosing
              </Text>
            </View>
          )}

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.xs,
              marginTop: spacing.xs,
              paddingTop: spacing.xs,
              borderTopWidth: 1,
              borderTopColor: colors.accent + "30",
            }}
          >
            <Ionicons
              name="information-circle"
              size={18}
              color={colors.textMuted}
              style={{ marginTop: 2 }}
            />
            <Text style={{ ...text.muted, fontSize: 12, flex: 1 }}>
              Customer can accept other quotes while you&apos;re en route
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Pressable
            onPress={handleSendQuote}
            disabled={submitting || !payoutStatus.isReady}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              paddingVertical: 18,
              borderRadius: radius.lg,
              alignItems: "center",
              opacity: submitting ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ fontWeight: "900", fontSize: 17, color: "#000", letterSpacing: 0.5 }}>
                Send Quote
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={submitting || !payoutStatus.isReady}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              paddingVertical: 14,
              borderRadius: radius.lg,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontWeight: "700", fontSize: 15, color: colors.textPrimary }}>Edit Quote</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
