import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { UserProfileCard } from "../../../components/profile/UserProfileCardQuotes";
import { ProfileCardModal } from "../../../components/profile/ProfileCardModal";
import { getDisplayTitle, formatAddressWithoutStreet } from "../../../src/lib/format-symptom";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type QuoteType = "diagnostic_only" | "range" | "fixed";

type Job = {
  id: string;
  title: string;
  description: string | null;
  customer_id: string;
  location_address: string | null;
  preferred_time: string | null;
  vehicle: {
    year: number;
    make: string;
    model: string;
    color: string | null;
    license_plate: string | null;
  } | null;
};

const DRIVE_FEE = 50;
const PLATFORM_FEE = 15;
const DIAGNOSTIC_FEE = 80;

const HOURLY_RATE_OPTIONS = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200];
const HOURS_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

export default function QuoteComposer() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [quoteType, setQuoteType] = useState<QuoteType | null>(null);
  const [showGuidance, setShowGuidance] = useState(true);
  const [showJobSummary, setShowJobSummary] = useState(false);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);

  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null);
  const [hoursLow, setHoursLow] = useState<number | null>(null);
  const [hoursHigh, setHoursHigh] = useState<number | null>(null);
  const [includeDiagnosticFee, setIncludeDiagnosticFee] = useState(false);
  const [includeDriveFee, setIncludeDriveFee] = useState(true);

  const [arrivalDate, setArrivalDate] = useState<Date>(new Date());
  const [arrivalTime, setArrivalTime] = useState<Date>(new Date());
  const [message, setMessage] = useState("");

  const [showRatePicker, setShowRatePicker] = useState(false);
  const [showHoursPicker, setShowHoursPicker] = useState(false);
  const [showHoursLowPicker, setShowHoursLowPicker] = useState(false);
  const [showHoursHighPicker, setShowHoursHighPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadJob();
  }, [params.id]);

  const loadJob = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          `
          id,
          title,
          description,
          customer_id,
          location_address,
          preferred_time,
          vehicle:vehicles(year, make, model, color, license_plate)
        `
        )
        .eq("id", params.id)
        .single();

      if (error) throw error;

      let vehicleData = Array.isArray(data.vehicle) ? data.vehicle[0] : data.vehicle;

      // If no vehicle from relation, try to parse from description JSON
      if (!vehicleData && data.description?.startsWith("{")) {
        try {
          const parsed = JSON.parse(data.description);
          if (parsed.vehicle) {
            vehicleData = {
              year: parsed.vehicle.year || 0,
              make: parsed.vehicle.make || "",
              model: parsed.vehicle.model || "",
              color: null,
              license_plate: null,
            };
          }
        } catch {}
      }

      const jobData = {
        ...data,
        vehicle: vehicleData
      };

      setJob(jobData);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load job");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const quoteTypes: {
    type: QuoteType;
    icon: string;
    title: string;
    description: string;
  }[] = [
    {
      type: "diagnostic_only",
      icon: "🔍",
      title: "Diagnostic Only",
      description: "Charge for diagnostic inspection, then quote repair separately",
    },
    {
      type: "range",
      icon: "📊",
      title: "Range Quote",
      description: "Price range based on possible causes (e.g. $200-$400)",
    },
    {
      type: "fixed",
      icon: "✓",
      title: "Fixed Price",
      description: "Confident diagnosis with exact price quote",
    },
  ];

  const calculateTotal = () => {
    if (!hourlyRate) return 0;

    let laborSubtotal = 0;

    if (quoteType === "range" && hoursLow && hoursHigh) {
      const lowLabor = hourlyRate * hoursLow;
      const highLabor = hourlyRate * hoursHigh;
      laborSubtotal = (lowLabor + highLabor) / 2;
    } else if (estimatedHours) {
      laborSubtotal = hourlyRate * estimatedHours;
    }

    let total = laborSubtotal + PLATFORM_FEE;
    if (includeDriveFee) total += DRIVE_FEE;
    if (includeDiagnosticFee) total += DIAGNOSTIC_FEE;

    return total;
  };

  const calculateTotalLow = () => {
    if (!hourlyRate || !hoursLow) return 0;
    let total = hourlyRate * hoursLow + PLATFORM_FEE;
    if (includeDriveFee) total += DRIVE_FEE;
    if (includeDiagnosticFee) total += DIAGNOSTIC_FEE;
    return total;
  };

  const calculateTotalHigh = () => {
    if (!hourlyRate || !hoursHigh) return 0;
    let total = hourlyRate * hoursHigh + PLATFORM_FEE;
    if (includeDriveFee) total += DRIVE_FEE;
    if (includeDiagnosticFee) total += DIAGNOSTIC_FEE;
    return total;
  };

  const canContinue = () => {
    if (!quoteType) return false;

    if (quoteType === "diagnostic_only" || quoteType === "fixed") {
      return hourlyRate !== null && estimatedHours !== null;
    }

    if (quoteType === "range") {
      return (
        hourlyRate !== null &&
        hoursLow !== null &&
        hoursHigh !== null &&
        hoursLow <= hoursHigh
      );
    }

    return false;
  };

  const handleContinue = () => {
    if (!canContinue()) return;

    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const queryParams = new URLSearchParams({
      jobId: params.id,
      quoteType: quoteType!,
      hourlyRate: hourlyRate?.toString() || "",
      estimatedHours: estimatedHours?.toString() || "",
      hoursLow: hoursLow?.toString() || "",
      hoursHigh: hoursHigh?.toString() || "",
      includeDiagnosticFee: includeDiagnosticFee.toString(),
      includeDriveFee: includeDriveFee.toString(),
      arrivalDate: formatDate(arrivalDate),
      arrivalTime: formatTime(arrivalTime),
      durationMinutes:
        quoteType === "range" && hoursLow && hoursHigh
          ? ((hoursLow + hoursHigh) / 2 * 60).toString()
          : estimatedHours
          ? (estimatedHours * 60).toString()
          : "",
      message: message || "",
    });

    router.push(`/(mechanic)/quote-review?${queryParams.toString()}` as any);
  };

  const getGuidanceForQuoteType = () => {
    if (!quoteType) return null;

    const guidance: Record<
      QuoteType,
      { tips: string[]; risks: string[] }
    > = {
      diagnostic_only: {
        tips: [
          "Customer pays for inspection time",
          "Quote repair separately after diagnosing",
          "Good when diagnosis is unclear",
        ],
        risks: [],
      },
      range: {
        tips: [
          "Works well when 2-3 causes are likely",
          "Customer knows worst-case upfront",
          "You can land anywhere in range",
        ],
        risks: [],
      },
      fixed: {
        tips: [
          "Customer appreciates certainty",
          "Shows confidence in your diagnosis",
          "Faster acceptance rate",
        ],
        risks: ["Ensure you account for complications"],
      },
    };

    return guidance[quoteType];
  };

  const renderPickerModal = (
    visible: boolean,
    onClose: () => void,
    options: number[],
    onSelect: (value: number) => void,
    title: string,
    formatValue: (val: number) => string
  ) => (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Pressable
          style={[
            card,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              padding: spacing.lg,
              maxHeight: "60%",
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ ...text.body, fontWeight: "700", fontSize: 18 }}>
              {title}
            </Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 300 }}>
            {options.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
                style={({ pressed }) => ({
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? colors.accent + "20" : "transparent",
                  marginBottom: spacing.xs,
                })}
              >
                <Text style={{ ...text.body, fontSize: 16 }}>
                  {formatValue(option)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "Compose Quote",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerBackVisible: true,
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/(mechanic)/(tabs)/leads" as any)}
              style={{ marginRight: 4 }}
            >
              <Text style={{ ...text.body, fontSize: 15, color: colors.textPrimary }}>
                Close
              </Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ paddingTop: spacing.md, paddingHorizontal: spacing.md, paddingBottom: Math.max(insets.bottom, spacing.md), gap: spacing.md }}>
        <Pressable
          onPress={() => setShowJobSummary(true)}
          style={[
            card,
            {
              padding: spacing.md,
              margin: spacing.sm,
              backgroundColor: colors.accent,
              borderColor: colors.black
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <Text style={{ fontSize: 24 }}>🚗</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ ...text.section, fontSize: 15, color: colors.surface, fontWeight: "700" }}>
                {job.vehicle
                  ? `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`
                  : "No vehicle info"}
              </Text>
              {job.vehicle?.color && (
                <Text style={{ ...text.muted, fontSize: 12, color: colors.surface + "CC" }}>
                  {job.vehicle.color}{job.vehicle.license_plate ? ` • ${job.vehicle.license_plate}` : ""}
                </Text>
              )}
              <View style={{ marginTop: spacing.xs, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 14 }}>🔧</Text>
                <Text style={{ ...text.body, fontSize: 13, color: colors.surface }}>
                  {getDisplayTitle(job.title)}
                </Text>
              </View>
              {job.description && !job.description.startsWith("{") && (
                <Text numberOfLines={2} style={{ ...text.muted, fontSize: 12, color: colors.surface + "BB", marginTop: 4 }}>
                  {job.description}
                </Text>
              )}
              {(job.location_address || job.preferred_time) && (
                <View style={{ marginTop: spacing.xs, gap: 2 }}>
                  {job.location_address && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="location-outline" size={12} color={colors.surface + "AA"} />
                      <Text numberOfLines={1} style={{ ...text.muted, fontSize: 11, color: colors.surface + "AA" }}>
                        {formatAddressWithoutStreet(job.location_address)}
                      </Text>
                    </View>
                  )}
                  {job.preferred_time && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="time-outline" size={12} color={colors.surface + "AA"} />
                      <Text style={{ ...text.muted, fontSize: 11, color: colors.surface + "AA" }}>
                        Preferred: {job.preferred_time}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.surface + "80"} />
          </View>
        </Pressable>

        {job.customer_id && (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>Customer</Text>
            <UserProfileCard
              userId={job.customer_id}
              variant="mini"
              context="quote_compose"
              onPressViewProfile={() => setShowCustomerProfile(true)}
            />
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>Quote Type</Text>
          <Text style={{ ...text.muted, fontSize: 13 }}>Select the approach that fits this job</Text>

          {quoteTypes.map((qt) => (
            <Pressable
              key={qt.type}
              onPress={() => setQuoteType(qt.type)}
              style={[
                card,
                {
                  padding: spacing.md,
                  borderWidth: 2,
                  borderColor: quoteType === qt.type ? colors.black : "transparent",
                  backgroundColor: quoteType === qt.type ? colors.accent : colors.surface,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
                <Text style={{ ...text.section, fontSize: 28 }}>{qt.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.body, fontWeight: "700", fontSize: 15, marginBottom: 4 }}>
                    {qt.title}
                  </Text>
                  <Text style={{ ...text.section, fontSize: 13 }}>{qt.description}</Text>
                </View>
                {quoteType === qt.type && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.surface} />
                )}
              </View>
            </Pressable>
          ))}
        </View>

        {quoteType && (
          <>
            <View style={{ gap: spacing.sm }}>
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>Hourly Pricing</Text>

              <View>
                <Text style={{ ...text.muted, fontSize: 13, marginBottom: 6 }}>Hourly rate</Text>
                <Pressable
                  onPress={() => setShowRatePicker(true)}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    backgroundColor: colors.surface,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "700",
                      color: hourlyRate ? colors.textPrimary : colors.textMuted,
                    }}
                  >
                    {hourlyRate ? `$${hourlyRate}/hr` : "Select rate"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                </Pressable>
              </View>

              {quoteType === "range" ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...text.muted, fontSize: 13, marginBottom: 6 }}>Hours (low)</Text>
                    <Pressable
                      onPress={() => setShowHoursLowPicker(true)}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        padding: spacing.md,
                        backgroundColor: colors.surface,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: hoursLow ? colors.textPrimary : colors.textMuted,
                        }}
                      >
                        {hoursLow ? `${hoursLow} hrs` : "Select"}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...text.muted, fontSize: 13, marginBottom: 6 }}>Hours (high)</Text>
                    <Pressable
                      onPress={() => setShowHoursHighPicker(true)}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        padding: spacing.md,
                        backgroundColor: colors.surface,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: hoursHigh ? colors.textPrimary : colors.textMuted,
                        }}
                      >
                        {hoursHigh ? `${hoursHigh} hrs` : "Select"}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={{ ...text.muted, fontSize: 13, marginBottom: 6 }}>Estimated hours</Text>
                  <Pressable
                    onPress={() => setShowHoursPicker(true)}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      backgroundColor: colors.surface,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: estimatedHours ? colors.textPrimary : colors.textMuted,
                      }}
                    >
                      {estimatedHours ? `${estimatedHours} hrs` : "Select hours"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}

              <Pressable
                onPress={() => setIncludeDiagnosticFee(!includeDiagnosticFee)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: includeDiagnosticFee ? colors.accent : colors.border,
                    backgroundColor: includeDiagnosticFee ? colors.accent : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {includeDiagnosticFee && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                    Include diagnostic fee
                  </Text>
                  <Text style={{ ...text.muted, fontSize: 12 }}>
                    Add ${DIAGNOSTIC_FEE} diagnostic fee to quote
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setIncludeDriveFee(!includeDriveFee)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: includeDriveFee ? colors.accent : colors.border,
                    backgroundColor: includeDriveFee ? colors.accent : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {includeDriveFee && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                    Include drive fee
                  </Text>
                  <Text style={{ ...text.muted, fontSize: 12 }}>
                    Add ${DRIVE_FEE} drive fee (travel to customer location)
                  </Text>
                </View>
              </Pressable>
            </View>

            {((quoteType === "range" && hourlyRate && hoursLow && hoursHigh) ||
              ((quoteType === "diagnostic_only" || quoteType === "fixed") &&
                hourlyRate &&
                estimatedHours)) && (
              <View style={[card, { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface }]}>
                <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>Pricing Breakdown</Text>

                <View style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ ...text.body, fontSize: 14 }}>Hourly rate</Text>
                    <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                      ${hourlyRate}/hr
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ ...text.body, fontSize: 14 }}>Estimated hours</Text>
                    <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                      {quoteType === "range"
                        ? `${hoursLow} - ${hoursHigh} hrs`
                        : `${estimatedHours} hrs`}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ ...text.body, fontSize: 14 }}>Labor subtotal</Text>
                    <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                      {quoteType === "range"
                        ? `$${(hourlyRate! * (hoursLow ?? 0)).toFixed(0)} - $${(hourlyRate! * (hoursHigh ?? 0)).toFixed(0)}`
                        : `$${(hourlyRate! * (estimatedHours ?? 0)).toFixed(0)}`}
                    </Text>
                  </View>

                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.border,
                      marginVertical: spacing.xs,
                    }}
                  />

                  {includeDriveFee && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ ...text.body, fontSize: 14 }}>Drive fee (travel to you)</Text>
                      <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                        ${DRIVE_FEE}
                      </Text>
                    </View>
                  )}

                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ ...text.body, fontSize: 14 }}>Platform fee (booking)</Text>
                    <Text style={{ ...text.body, fontSize: 14, fontWeight: "600" }}>
                      ${PLATFORM_FEE}
                    </Text>
                  </View>

                  {includeDiagnosticFee && (
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
                      marginVertical: spacing.xs,
                    }}
                  />

                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ ...text.body, fontSize: 16, fontWeight: "700" }}>Total</Text>
                    <Text style={{ ...text.body, fontSize: 20, fontWeight: "900", color: colors.accent }}>
                      {quoteType === "range"
                        ? `$${calculateTotalLow().toFixed(0)} - $${calculateTotalHigh().toFixed(0)}`
                        : `$${calculateTotal().toFixed(0)}`}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {quoteType && (
          <>
            <View style={{ gap: spacing.sm }}>
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>Time Estimate</Text>

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.muted, fontSize: 13, marginBottom: 6 }}>Arrival date</Text>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      backgroundColor: colors.surface,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ fontSize: 15, color: colors.textPrimary }}>
                      {arrivalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.muted, fontSize: 13, marginBottom: 6 }}>Arrival time</Text>
                  <Pressable
                    onPress={() => setShowTimePicker(true)}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      backgroundColor: colors.surface,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ fontSize: 15, color: colors.textPrimary }}>
                      {arrivalTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                    <Ionicons name="time-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={arrivalDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (selectedDate) setArrivalDate(selectedDate);
                  }}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={arrivalTime}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minuteInterval={15}
                  onChange={(event, selectedTime) => {
                    setShowTimePicker(Platform.OS === "ios");
                    if (selectedTime) setArrivalTime(selectedTime);
                  }}
                />
              )}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>
                Message to Customer (optional)
              </Text>
              <Text style={{ ...text.muted, fontSize: 13 }}>
                Brief note about your approach or what to expect
              </Text>
              <TextInput
                placeholder="Brief note about your approach..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={300}
                value={message}
                onChangeText={setMessage}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  fontSize: 15,
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
              />
              <Text style={{ ...text.muted, fontSize: 12, textAlign: "right" }}>
                {message.length}/300
              </Text>
            </View>

            {showGuidance && getGuidanceForQuoteType() && (
              <View
                style={[
                  card,
                  {
                    padding: spacing.md,
                    backgroundColor: colors.accent + "10",
                    borderLeftWidth: 4,
                    borderLeftColor: colors.accent,
                  },
                ]}
              >
                <Pressable
                  onPress={() => setShowGuidance(false)}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ ...text.body, fontWeight: "700", fontSize: 14, color: colors.accent }}>
                    💡 Quote Strategy Tips
                  </Text>
                  <Ionicons name="close" size={20} color={colors.accent} />
                </Pressable>

                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  {getGuidanceForQuoteType()!.tips.map((tip, i) => (
                    <Text key={i} style={{ ...text.body, fontSize: 13, lineHeight: 18 }}>
                      • {tip}
                    </Text>
                  ))}
                  {getGuidanceForQuoteType()!.risks.length > 0 && (
                    <View style={{ marginTop: spacing.xs }}>
                      <Text
                        style={{ ...text.body, fontWeight: "700", fontSize: 13, marginBottom: 4 }}
                      >
                        ⚠️ Consider:
                      </Text>
                      {getGuidanceForQuoteType()!.risks.map((risk, i) => (
                        <Text key={i} style={{ ...text.muted, fontSize: 13, lineHeight: 18 }}>
                          • {risk}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}

        <Pressable
          onPress={handleContinue}
          disabled={!canContinue()}
          style={({ pressed }) => ({
            backgroundColor: colors.accent,
            paddingVertical: 16,
            borderRadius: radius.lg,
            alignItems: "center",
            opacity: !canContinue() ? 0.4 : pressed ? 0.85 : 1,
            marginTop: spacing.md,
          })}
        >
          <Text style={{ fontWeight: "900", fontSize: 16, color: "#000", letterSpacing: 0.5 }}>
            Review Quote
          </Text>
        </Pressable>
      </ScrollView>

      {renderPickerModal(
        showRatePicker,
        () => setShowRatePicker(false),
        HOURLY_RATE_OPTIONS,
        setHourlyRate,
        "Select Hourly Rate",
        (val) => `$${val}/hr`
      )}

      {renderPickerModal(
        showHoursPicker,
        () => setShowHoursPicker(false),
        HOURS_OPTIONS,
        setEstimatedHours,
        "Select Estimated Hours",
        (val) => `${val} hours`
      )}

      {renderPickerModal(
        showHoursLowPicker,
        () => setShowHoursLowPicker(false),
        HOURS_OPTIONS,
        setHoursLow,
        "Select Low Hours Estimate",
        (val) => `${val} hours`
      )}

      {renderPickerModal(
        showHoursHighPicker,
        () => setShowHoursHighPicker(false),
        HOURS_OPTIONS,
        setHoursHigh,
        "Select High Hours Estimate",
        (val) => `${val} hours`
      )}

      {job?.customer_id && (
        <ProfileCardModal
          visible={showCustomerProfile}
          userId={job.customer_id}
          onClose={() => setShowCustomerProfile(false)}
          title="Customer Profile"
          showReviewsButton={false}
        />
      )}
    </KeyboardAvoidingView>
  );
}
