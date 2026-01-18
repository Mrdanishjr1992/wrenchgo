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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
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
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const breakdownRotation = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${breakdownRotation.value}deg` }],
  }));

  useEffect(() => {
    loadJob();
  }, [params.jobId]);

  useEffect(() => {
    breakdownRotation.value = withTiming(showBreakdown ? 180 : 0, { duration: 200 });
  }, [showBreakdown]);

  const loadJob = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(`id, title, vehicle:vehicles(year, make, model)`)
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

  const getQuoteTypeIcon = (type: QuoteType): keyof typeof Ionicons.glyphMap => {
    const icons: Record<QuoteType, keyof typeof Ionicons.glyphMap> = {
      diagnostic_only: "search",
      range: "swap-horizontal",
      fixed: "checkmark-circle",
    };
    return icons[type];
  };

  const calculatePricing = () => {
    const hourlyRate = parseFloat(params.hourlyRate || "0");
    const includeDiagnostic = params.includeDiagnosticFee === "true";
    const includeDrive = params.includeDriveFee !== "false";

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
        if (result?.code === 'NOT_VERIFIED') {
          Alert.alert(
            "Verification Required",
            result?.message || "Your account must be verified to submit quotes.",
            [
              { text: "OK", onPress: () => router.push("/(mechanic)/(tabs)/profile") },
            ]
          );
          return;
        }
        if (result?.code === 'PROBATION_QUOTE_LIMIT') {
          const maxAmount = result?.max_quote_cents ? `$${(result.max_quote_cents / 100).toFixed(0)}` : '$250';
          Alert.alert(
            "Quote Limit Exceeded",
            `As a new mechanic, your maximum quote is ${maxAmount}. Build your reputation to unlock higher limits.`,
            [{ text: "OK" }]
          );
          return;
        }
        if (result?.code === 'PROBATION_CATEGORY_BLOCKED') {
          Alert.alert(
            "Category Restricted",
            "This job category is restricted for new mechanics. Complete more jobs to unlock all categories.",
            [{ text: "OK" }]
          );
          return;
        }
        throw new Error(result?.message || 'Failed to submit quote');
      }

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

      const { error: updateError } = await supabase
        .from("jobs")
        .update({ status: "quoted", updated_at: new Date().toISOString() })
        .eq("id", params.jobId)
        .in("status", ["searching", "draft"]);

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

  const getTotalDisplay = () => {
    if (params.quoteType === "range") {
      return `$${pricing.totalLow!.toFixed(0)} - $${pricing.totalHigh!.toFixed(0)}`;
    }
    return `$${pricing.total!.toFixed(0)}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={[colors.accent, colors.accent + "DD"]}
        style={{ paddingTop: insets.top, paddingBottom: spacing.lg }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Pressable
            onPress={() => router.back()}
            style={{ padding: spacing.xs, marginRight: spacing.sm }}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 20, fontWeight: "800", color: "#000" }}>
            Review Quote
          </Text>
          <Pressable
            onPress={() => router.push("/(mechanic)/jobs" as any)}
            style={{ padding: spacing.xs }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#000" }}>Close</Text>
          </Pressable>
        </View>

        <View style={{ alignItems: "center", marginTop: spacing.md }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#000", opacity: 0.7 }}>
            Total Quote
          </Text>
          <Text style={{ fontSize: 42, fontWeight: "900", color: "#000", marginTop: 4 }}>
            {getTotalDisplay()}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs }}>
            <Ionicons name={getQuoteTypeIcon(params.quoteType)} size={16} color="#000" />
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#000", opacity: 0.8 }}>
              {getQuoteTypeLabel(params.quoteType)}
            </Text>
          </View>
        </View>
      </LinearGradient>

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
          <Text style={{ fontSize: 13, color: "#D97706", fontWeight: "700" }}>Set Up →</Text>
        </Pressable>
      )}

      {payoutStatus.isLoading && (
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={{ fontSize: 14, color: colors.textMuted }}>Checking payout status...</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[card, { padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent + "20", alignItems: "center", justifyContent: "center", marginRight: spacing.sm }}>
              <Ionicons name="car" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>{vehicleText}</Text>
              <Text style={{ ...text.muted, fontSize: 13 }}>{getDisplayTitle(job.title)}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => setShowBreakdown(!showBreakdown)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <Text style={{ ...text.body, fontWeight: "600", fontSize: 14 }}>Price Breakdown</Text>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </Animated.View>
          </Pressable>

          {showBreakdown && (
            <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...text.muted, fontSize: 14 }}>Hourly rate</Text>
                <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>${params.hourlyRate}/hr</Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...text.muted, fontSize: 14 }}>Estimated hours</Text>
                <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                  {params.quoteType === "range" ? `${params.hoursLow} - ${params.hoursHigh} hrs` : `${params.estimatedHours} hrs`}
                </Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...text.muted, fontSize: 14 }}>Labor subtotal</Text>
                <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                  {params.quoteType === "range" ? `$${pricing.laborLow!.toFixed(0)} - $${pricing.laborHigh!.toFixed(0)}` : `$${pricing.labor!.toFixed(0)}`}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />

              {includeDrive && (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ ...text.muted, fontSize: 14 }}>Drive fee</Text>
                  <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>${DRIVE_FEE}</Text>
                </View>
              )}

              {includeDiagnostic && (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ ...text.muted, fontSize: 14 }}>Diagnostic fee</Text>
                  <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>${DIAGNOSTIC_FEE}</Text>
                </View>
              )}

              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...text.body, fontSize: 16, fontWeight: "700" }}>Total</Text>
                <Text style={{ ...text.body, fontSize: 18, fontWeight: "900", color: colors.accent }}>
                  {getTotalDisplay()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {(params.arrivalDate || params.arrivalTime || params.durationMinutes) && (
          <View style={[card, { padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface }]}>
            <Text style={{ ...text.body, fontWeight: "700", fontSize: 16, marginBottom: spacing.sm }}>
              Schedule
            </Text>
            <View style={{ gap: spacing.sm }}>
              {(params.arrivalDate || params.arrivalTime) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent + "15", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="calendar" size={16} color={colors.accent} />
                  </View>
                  <View>
                    <Text style={{ ...text.muted, fontSize: 12 }}>Arrival</Text>
                    <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                      {params.arrivalDate} {params.arrivalTime}
                    </Text>
                  </View>
                </View>
              )}
              {params.durationMinutes && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent + "15", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="time" size={16} color={colors.accent} />
                  </View>
                  <View>
                    <Text style={{ ...text.muted, fontSize: 12 }}>Duration</Text>
                    <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                      {Math.round(parseInt(params.durationMinutes) / 60)} hours
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {params.message && (
          <View style={[card, { padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
              <Ionicons name="chatbubble" size={18} color={colors.accent} />
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>Your Note</Text>
            </View>
            <Text style={{ ...text.body, fontSize: 14, lineHeight: 22, fontStyle: "italic", color: colors.textMuted }}>
              "{params.message}"
            </Text>
          </View>
        )}

        <View style={[card, { padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent + "15", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="eye" size={18} color={colors.accent} />
            </View>
            <View>
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>Customer Preview</Text>
              <Text style={{ ...text.muted, fontSize: 12 }}>How your quote will appear</Text>
            </View>
          </View>

          <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.body, fontWeight: "800", fontSize: 28, color: colors.accent }}>
                  {getTotalDisplay()}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Ionicons name={getQuoteTypeIcon(params.quoteType)} size={14} color={colors.textMuted} />
                  <Text style={{ ...text.muted, fontSize: 13 }}>
                    {getQuoteTypeLabel(params.quoteType)}
                  </Text>
                </View>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: "#10B981" + "20" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}>NEW QUOTE</Text>
              </View>
            </View>

            <View style={{ backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.xs }}>
              <Text style={{ ...text.muted, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>INCLUDES</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {params.quoteType !== "diagnostic_only" && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Ionicons name="construct" size={12} color={colors.textMuted} />
                    <Text style={{ ...text.muted, fontSize: 12 }}>Labor</Text>
                  </View>
                )}
                {includeDrive && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Ionicons name="car" size={12} color={colors.textMuted} />
                    <Text style={{ ...text.muted, fontSize: 12 }}>Drive fee</Text>
                  </View>
                )}
                {includeDiagnostic && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Ionicons name="search" size={12} color={colors.textMuted} />
                    <Text style={{ ...text.muted, fontSize: 12 }}>Diagnostic</Text>
                  </View>
                )}
              </View>
            </View>

            {(params.arrivalDate || params.arrivalTime) && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={{ ...text.muted, fontSize: 12 }}>
                  Available {params.arrivalDate} {params.arrivalTime && `at ${params.arrivalTime}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[card, { padding: spacing.lg, backgroundColor: colors.surface, marginBottom: spacing.md }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#3B82F6" + "15", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="clipboard-outline" size={18} color="#3B82F6" />
            </View>
            <View>
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>Quote Summary</Text>
              <Text style={{ ...text.muted, fontSize: 12 }}>Review before sending</Text>
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.sm }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent + "15", alignItems: "center", justifyContent: "center", marginRight: spacing.sm }}>
                <Ionicons name="pricetag" size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.muted, fontSize: 11, fontWeight: "600" }}>PRICE INCLUDES</Text>
                <Text style={{ ...text.body, fontSize: 14, marginTop: 2 }}>{getExpectationText()}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.sm }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#10B981" + "15", alignItems: "center", justifyContent: "center", marginRight: spacing.sm }}>
                <Ionicons name="person" size={16} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.muted, fontSize: 11, fontWeight: "600" }}>CUSTOMER EXPECTS</Text>
                <Text style={{ ...text.body, fontSize: 14, marginTop: 2 }}>{getCustomerExpectation()}</Text>
              </View>
            </View>

            {params.quoteType === "diagnostic_only" && (
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.sm }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#F59E0B" + "15", alignItems: "center", justifyContent: "center", marginRight: spacing.sm }}>
                  <Ionicons name="refresh" size={16} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.muted, fontSize: 11, fontWeight: "600" }}>IF JOB CHANGES</Text>
                  <Text style={{ ...text.body, fontSize: 14, marginTop: 2 }}>You can update the quote after diagnosing</Text>
                </View>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={{ ...text.muted, fontSize: 13, flex: 1 }}>
              Customer can accept other quotes while you're en route
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
      }}>
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ ...text.muted, fontSize: 13 }}>Quote Total</Text>
            <Text style={{ ...text.body, fontSize: 22, fontWeight: "900", color: colors.accent }}>
              {getTotalDisplay()}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md }}>
          <Pressable
            onPress={() => router.back()}
            disabled={submitting}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: colors.bg,
              paddingVertical: 16,
              borderRadius: radius.lg,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="pencil" size={16} color={colors.textPrimary} />
            <Text style={{ fontWeight: "700", fontSize: 15, color: colors.textPrimary }}>Edit Quote</Text>
          </Pressable>

          <Pressable
            onPress={handleSendQuote}
            disabled={submitting || !payoutStatus.isReady}
            style={({ pressed }) => ({
              flex: 1.5,
              backgroundColor: colors.accent,
              paddingVertical: 16,
              borderRadius: radius.lg,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              opacity: submitting || !payoutStatus.isReady ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#000" />
                <Text style={{ fontWeight: "900", fontSize: 16, color: "#000" }}>Send Quote</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
