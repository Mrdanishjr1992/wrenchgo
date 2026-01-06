import { useState, useEffect, useMemo } from "react";
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
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { createCard } from "../../src/ui/styles";
import React from "react";

type QuoteType = "diagnostic_only" | "range" | "fixed" | "inspection_required";

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
const PLATFORM_FEE = 15;
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
    arrivalDate: string;
    arrivalTime: string;
    durationMinutes: string;
    message: string;
  }>();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

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
      inspection_required: "Inspection Required",
    };
    return labels[type];
  };

  const calculatePricing = () => {
    const hourlyRate = parseFloat(params.hourlyRate || "0");
    const includeDiagnostic = params.includeDiagnosticFee === "true";

    if (params.quoteType === "range") {
      const hoursLow = params.hoursLow === "TBD" ? null : parseFloat(params.hoursLow || "0");
      const hoursHigh = params.hoursHigh === "TBD" ? null : parseFloat(params.hoursHigh || "0");

      if (!hoursLow || !hoursHigh) {
        return {
          isTBD: true,
          laborLow: 0,
          laborHigh: 0,
          fees: DRIVE_FEE + PLATFORM_FEE + (includeDiagnostic ? DIAGNOSTIC_FEE : 0),
          totalLow: 0,
          totalHigh: 0,
        };
      }

      const laborLow = hourlyRate * hoursLow;
      const laborHigh = hourlyRate * hoursHigh;
      const fees = DRIVE_FEE + PLATFORM_FEE + (includeDiagnostic ? DIAGNOSTIC_FEE : 0);

      return {
        isTBD: false,
        laborLow,
        laborHigh,
        fees,
        totalLow: laborLow + fees,
        totalHigh: laborHigh + fees,
      };
    }

    const estimatedHours = params.estimatedHours === "TBD" ? null : parseFloat(params.estimatedHours || "0");

    if (!estimatedHours) {
      return {
        isTBD: true,
        labor: 0,
        fees: DRIVE_FEE + PLATFORM_FEE + (includeDiagnostic ? DIAGNOSTIC_FEE : 0),
        total: 0,
      };
    }

    const labor = hourlyRate * estimatedHours;
    const fees = DRIVE_FEE + PLATFORM_FEE + (includeDiagnostic ? DIAGNOSTIC_FEE : 0);

    return {
      isTBD: false,
      labor,
      fees,
      total: labor + fees,
    };
  };

  const pricing = calculatePricing();
  const includeDiagnostic = params.includeDiagnosticFee === "true";

  const getExpectationText = () => {
    if (params.quoteType === "diagnostic_only") {
      return `$${DIAGNOSTIC_FEE} diagnostic + travel/platform fees, repair quoted separately`;
    }
    if (params.quoteType === "range") {
      return "Final total will fall within the stated range";
    }
    if (params.quoteType === "fixed") {
      return "Total includes labor estimate + fees";
    }
    if (params.quoteType === "inspection_required") {
      return "Inspection before confirming total";
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
    if (params.quoteType === "inspection_required") {
      return "Vehicle inspection before repair quote";
    }
    return "";
  };

  const handleSendQuote = async () => {
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

      let priceCents = null;
      let notesText = params.message || null;

      if (params.quoteType === "range" && !pricing.isTBD) {
        const priceLowCents = Math.round(pricing.totalLow! * 100);
        const priceHighCents = Math.round(pricing.totalHigh! * 100);
        priceCents = Math.round((priceLowCents + priceHighCents) / 2);
        notesText = `Range: $${(priceLowCents / 100).toFixed(0)} - $${(priceHighCents / 100).toFixed(0)}${notesText ? '\n\n' + notesText : ''}`;
      } else if (!pricing.isTBD && pricing.total !== undefined) {
        priceCents = Math.round(pricing.total * 100);
      }

      const estimatedHours = params.durationMinutes ? parseInt(params.durationMinutes) / 60 : null;

      const { error } = await supabase.from("quotes").insert({
        job_id: params.jobId,
        mechanic_id: userData.user.id,
        price_cents: priceCents,
        estimated_hours: estimatedHours,
        notes: notesText,
        status: "pending",
      });

      if (error) throw error;

      // Update job status to "quoted" so customer sees the update
      await supabase
        .from("jobs")
        .update({ status: "quoted", updated_at: new Date().toISOString() })
        .eq("id", params.jobId)
        .eq("status", "searching"); // Only update if still searching

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
    if (params.quoteType === "inspection_required") {
      return (
        <View>
          <Text style={{ ...text.muted, fontSize: 13 }}>Pricing</Text>
          <Text style={{ ...text.body, fontSize: 20, fontWeight: "700", marginTop: 2 }}>
            To be determined after inspection
          </Text>
        </View>
      );
    }

    if (pricing.isTBD) {
      return (
        <View>
          <Text style={{ ...text.muted, fontSize: 13 }}>Pricing</Text>
          <Text style={{ ...text.body, fontSize: 20, fontWeight: "700", marginTop: 2 }}>
            TBD
          </Text>
          <Text style={{ ...text.muted, fontSize: 12, marginTop: 4 }}>
            Hours to be determined
          </Text>
        </View>
      );
    }

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

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...text.body, fontSize: 14 }}>Drive fee</Text>
            <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
              ${DRIVE_FEE}
            </Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...text.body, fontSize: 14 }}>Platform fee</Text>
            <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
              ${PLATFORM_FEE}
            </Text>
          </View>

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
    if (params.quoteType === "inspection_required" || pricing.isTBD) {
      return "TBD";
    }

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
                {vehicleText} • {job.title}
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

            {!pricing.isTBD && params.quoteType !== "inspection_required" && (
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
            disabled={submitting}
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
            disabled={submitting}
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
