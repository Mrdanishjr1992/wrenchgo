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
  StyleSheet,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { UserProfileCard } from "../../../components/profile/UserProfileCardQuotes";
import { ProfileCardModal } from "../../../components/profile/ProfileCardModal";
import { getDisplayTitle, formatAddressWithoutStreet } from "../../../src/lib/format-symptom";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

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
  const [jobExpanded, setJobExpanded] = useState(false);
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

  const expandRotation = useSharedValue(0);
  const expandHeight = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expandRotation.value}deg` }],
  }));

  useEffect(() => {
    loadJob();
  }, [params.id]);

  useEffect(() => {
    expandRotation.value = withTiming(jobExpanded ? 180 : 0, { duration: 200 });
  }, [jobExpanded]);

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
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
  }[] = [
    {
      type: "diagnostic_only",
      icon: "search",
      title: "Diagnostic Only",
      description: "Charge for inspection, quote repair separately",
    },
    {
      type: "range",
      icon: "analytics",
      title: "Range Quote",
      description: "Price range based on possible causes",
    },
    {
      type: "fixed",
      icon: "checkmark-circle",
      title: "Fixed Price",
      description: "Confident diagnosis with exact price",
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

    let total = laborSubtotal;
    if (includeDriveFee) total += DRIVE_FEE;
    if (includeDiagnosticFee) total += DIAGNOSTIC_FEE;

    return total;
  };

  const calculateTotalLow = () => {
    if (!hourlyRate || !hoursLow) return 0;
    let total = hourlyRate * hoursLow;
    if (includeDriveFee) total += DRIVE_FEE;
    if (includeDiagnosticFee) total += DIAGNOSTIC_FEE;
    return total;
  };

  const calculateTotalHigh = () => {
    if (!hourlyRate || !hoursHigh) return 0;
    let total = hourlyRate * hoursHigh;
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
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
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
                style={({ pressed }) => [
                  styles.pickerOption,
                  {
                    backgroundColor: pressed ? colors.accent + "20" : "transparent",
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Text style={[styles.pickerOptionText, { color: colors.textPrimary }]}>
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
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[text.body, { color: colors.textMuted }]}>Job not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={[colors.accent, colors.accent + "28"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="document-text" size={22} color={colors.textPrimary} />
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Compose Quote</Text>
          </View>
          <Pressable onPress={() => router.push("/(mechanic)/(tabs)/leads" as any)} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + 80 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => setJobExpanded(!jobExpanded)}
          style={[
            styles.jobCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.jobCardHeader}>
            <View style={[styles.jobIconContainer, { backgroundColor: colors.accent + "20" }]}>
              <Ionicons name="car-sport" size={24} color={colors.accent} />
            </View>
            <View style={styles.jobCardInfo}>
              <Text style={[styles.jobVehicle, { color: colors.textPrimary }]}>
                {job.vehicle
                  ? `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`
                  : "No vehicle info"}
              </Text>
              <Text style={[styles.jobTitle, { color: colors.textMuted }]}>
                {getDisplayTitle(job.title)}
              </Text>
            </View>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </Animated.View>
          </View>

          {jobExpanded && (
            <View style={[styles.jobCardExpanded, { borderTopColor: colors.border }]}>
              {job.vehicle?.color && (
                <View style={styles.jobDetailRow}>
                  <Ionicons name="color-palette-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.jobDetailText, { color: colors.textSecondary }]}>
                    {job.vehicle.color}{job.vehicle.license_plate ? ` • ${job.vehicle.license_plate}` : ""}
                  </Text>
                </View>
              )}
              {job.description && !job.description.startsWith("{") && (
                <View style={styles.jobDetailRow}>
                  <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.jobDetailText, { color: colors.textSecondary }]}>
                    {job.description}
                  </Text>
                </View>
              )}
              {job.location_address && (
                <View style={styles.jobDetailRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.jobDetailText, { color: colors.textSecondary }]}>
                    {formatAddressWithoutStreet(job.location_address)}
                  </Text>
                </View>
              )}
              {job.preferred_time && (
                <View style={styles.jobDetailRow}>
                  <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.jobDetailText, { color: colors.textSecondary }]}>
                    Preferred: {job.preferred_time}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Pressable>

        {job.customer_id && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Customer</Text>
            <UserProfileCard
              userId={job.customer_id}
              variant="mini"
              context="quote_compose"
              onPressViewProfile={() => setShowCustomerProfile(true)}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quote Type</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Select the approach that fits this job
          </Text>

          <View style={styles.quoteTypeGrid}>
            {quoteTypes.map((qt) => {
              const isSelected = quoteType === qt.type;
              return (
                <Pressable
                  key={qt.type}
                  onPress={() => setQuoteType(qt.type)}
                  style={[
                    styles.quoteTypeCard,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <View style={[
                    styles.quoteTypeIcon,
                    { backgroundColor: isSelected ? "rgba(0,0,0,0.15)" : colors.accent + "15" }
                  ]}>
                    <Ionicons 
                      name={qt.icon} 
                      size={22} 
                      color={isSelected ? "#000" : colors.accent} 
                    />
                  </View>
                  <Text style={[
                    styles.quoteTypeTitle,
                    { color: isSelected ? "#000" : colors.textPrimary }
                  ]}>
                    {qt.title}
                  </Text>
                  <Text style={[
                    styles.quoteTypeDesc,
                    { color: isSelected ? "rgba(0,0,0,0.7)" : colors.textMuted }
                  ]}>
                    {qt.description}
                  </Text>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark" size={14} color="#000" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {quoteType && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pricing</Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Hourly rate</Text>
                <Pressable
                  onPress={() => setShowRatePicker(true)}
                  style={[
                    styles.selectButton,
                    { backgroundColor: colors.surface, borderColor: colors.border }
                  ]}
                >
                  <Text style={[
                    styles.selectButtonText,
                    { color: hourlyRate ? colors.textPrimary : colors.textMuted }
                  ]}>
                    {hourlyRate ? `$${hourlyRate}/hr` : "Select rate"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                </Pressable>
              </View>

              {quoteType === "range" ? (
                <View style={styles.rowInputs}>
                  <View style={styles.halfInput}>
                    <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Hours (low)</Text>
                    <Pressable
                      onPress={() => setShowHoursLowPicker(true)}
                      style={[
                        styles.selectButton,
                        { backgroundColor: colors.surface, borderColor: colors.border }
                      ]}
                    >
                      <Text style={[
                        styles.selectButtonText,
                        { color: hoursLow ? colors.textPrimary : colors.textMuted }
                      ]}>
                        {hoursLow ? `${hoursLow} hrs` : "Select"}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Hours (high)</Text>
                    <Pressable
                      onPress={() => setShowHoursHighPicker(true)}
                      style={[
                        styles.selectButton,
                        { backgroundColor: colors.surface, borderColor: colors.border }
                      ]}
                    >
                      <Text style={[
                        styles.selectButtonText,
                        { color: hoursHigh ? colors.textPrimary : colors.textMuted }
                      ]}>
                        {hoursHigh ? `${hoursHigh} hrs` : "Select"}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Estimated hours</Text>
                  <Pressable
                    onPress={() => setShowHoursPicker(true)}
                    style={[
                      styles.selectButton,
                      { backgroundColor: colors.surface, borderColor: colors.border }
                    ]}
                  >
                    <Text style={[
                      styles.selectButtonText,
                      { color: estimatedHours ? colors.textPrimary : colors.textMuted }
                    ]}>
                      {estimatedHours ? `${estimatedHours} hrs` : "Select hours"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}

              <Pressable
                onPress={() => setIncludeDiagnosticFee(!includeDiagnosticFee)}
                style={[
                  styles.checkboxRow,
                  { backgroundColor: colors.surface, borderColor: colors.border }
                ]}
              >
                <View style={[
                  styles.checkbox,
                  {
                    borderColor: includeDiagnosticFee ? colors.accent : colors.border,
                    backgroundColor: includeDiagnosticFee ? colors.accent : "transparent",
                  }
                ]}>
                  {includeDiagnosticFee && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <View style={styles.checkboxContent}>
                  <Text style={[styles.checkboxTitle, { color: colors.textPrimary }]}>
                    Include diagnostic fee
                  </Text>
                  <Text style={[styles.checkboxSubtitle, { color: colors.textMuted }]}>
                    Add ${DIAGNOSTIC_FEE} diagnostic fee
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setIncludeDriveFee(!includeDriveFee)}
                style={[
                  styles.checkboxRow,
                  { backgroundColor: colors.surface, borderColor: colors.border }
                ]}
              >
                <View style={[
                  styles.checkbox,
                  {
                    borderColor: includeDriveFee ? colors.accent : colors.border,
                    backgroundColor: includeDriveFee ? colors.accent : "transparent",
                  }
                ]}>
                  {includeDriveFee && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <View style={styles.checkboxContent}>
                  <Text style={[styles.checkboxTitle, { color: colors.textPrimary }]}>
                    Include drive fee
                  </Text>
                  <Text style={[styles.checkboxSubtitle, { color: colors.textMuted }]}>
                    Add ${DRIVE_FEE} travel fee
                  </Text>
                </View>
              </Pressable>
            </View>

            {((quoteType === "range" && hourlyRate && hoursLow && hoursHigh) ||
              ((quoteType === "diagnostic_only" || quoteType === "fixed") &&
                hourlyRate &&
                estimatedHours)) && (
              <View style={[styles.breakdownCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 12 }]}>
                  Pricing Breakdown
                </Text>

                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Hourly rate</Text>
                  <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>${hourlyRate}/hr</Text>
                </View>

                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Estimated hours</Text>
                  <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>
                    {quoteType === "range" ? `${hoursLow} - ${hoursHigh} hrs` : `${estimatedHours} hrs`}
                  </Text>
                </View>

                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Labor subtotal</Text>
                  <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>
                    {quoteType === "range"
                      ? `$${(hourlyRate! * (hoursLow ?? 0)).toFixed(0)} - $${(hourlyRate! * (hoursHigh ?? 0)).toFixed(0)}`
                      : `$${(hourlyRate! * (estimatedHours ?? 0)).toFixed(0)}`}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {includeDriveFee && (
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Drive fee</Text>
                    <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>${DRIVE_FEE}</Text>
                  </View>
                )}

                {includeDiagnosticFee && (
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Diagnostic fee</Text>
                    <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>${DIAGNOSTIC_FEE}</Text>
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.breakdownRow}>
                  <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: colors.accent }]}>
                    {quoteType === "range"
                      ? `$${calculateTotalLow().toFixed(0)} - $${calculateTotalHigh().toFixed(0)}`
                      : `$${calculateTotal().toFixed(0)}`}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Availability</Text>

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Arrival date</Text>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={[
                      styles.selectButton,
                      { backgroundColor: colors.surface, borderColor: colors.border }
                    ]}
                  >
                    <Text style={[styles.selectButtonText, { color: colors.textPrimary }]}>
                      {arrivalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Arrival time</Text>
                  <Pressable
                    onPress={() => setShowTimePicker(true)}
                    style={[
                      styles.selectButton,
                      { backgroundColor: colors.surface, borderColor: colors.border }
                    ]}
                  >
                    <Text style={[styles.selectButtonText, { color: colors.textPrimary }]}>
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

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Message (optional)
              </Text>
              <TextInput
                placeholder="Brief note about your approach..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={300}
                value={message}
                onChangeText={setMessage}
                style={[
                  styles.textArea,
                  {
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    backgroundColor: colors.surface,
                  }
                ]}
              />
              <Text style={[styles.charCount, { color: colors.textMuted }]}>
                {message.length}/300
              </Text>
            </View>

            {showGuidance && getGuidanceForQuoteType() && (
              <View style={[styles.guidanceCard, { backgroundColor: colors.accent + "12", borderLeftColor: colors.accent }]}>
                <Pressable
                  onPress={() => setShowGuidance(false)}
                  style={styles.guidanceHeader}
                >
                  <View style={styles.guidanceTitleRow}>
                    <Ionicons name="bulb" size={18} color={colors.accent} />
                    <Text style={[styles.guidanceTitle, { color: colors.accent }]}>
                      Quote Strategy Tips
                    </Text>
                  </View>
                  <Ionicons name="close" size={20} color={colors.accent} />
                </Pressable>

                <View style={styles.guidanceContent}>
                  {getGuidanceForQuoteType()!.tips.map((tip, i) => (
                    <Text key={i} style={[styles.guidanceTip, { color: colors.textSecondary }]}>
                      • {tip}
                    </Text>
                  ))}
                  {getGuidanceForQuoteType()!.risks.length > 0 && (
                    <View style={styles.guidanceRisks}>
                      <Text style={[styles.guidanceRiskTitle, { color: colors.textPrimary }]}>
                        Consider:
                      </Text>
                      {getGuidanceForQuoteType()!.risks.map((risk, i) => (
                        <Text key={i} style={[styles.guidanceTip, { color: colors.textMuted }]}>
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
      </ScrollView>

      <View style={[
        styles.bottomBar,
        { 
          backgroundColor: colors.bg,
          paddingBottom: Math.max(insets.bottom, 16),
          borderTopColor: colors.border,
        }
      ]}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue()}
          style={({ pressed }) => [
            styles.continueButton,
            {
              backgroundColor: colors.accent,
              opacity: !canContinue() ? 0.4 : pressed ? 0.85 : 1,
            }
          ]}
        >
          <Text style={styles.continueButtonText}>Review Quote</Text>
          <Ionicons name="arrow-forward" size={20} color="#000" />
        </Pressable>
      </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  jobCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  jobCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  jobIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  jobCardInfo: {
    flex: 1,
  },
  jobVehicle: {
    fontSize: 16,
    fontWeight: "700",
  },
  jobTitle: {
    fontSize: 14,
    marginTop: 2,
  },
  jobCardExpanded: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  jobDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  jobDetailText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: -4,
  },
  quoteTypeGrid: {
    gap: 12,
  },
  quoteTypeCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    position: "relative",
  },
  quoteTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  quoteTypeTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  quoteTypeDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  selectedBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 12,
  },
  halfInput: {
    flex: 1,
    gap: 6,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  checkboxSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  breakdownCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
  guidanceCard: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 14,
  },
  guidanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  guidanceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  guidanceTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  guidanceContent: {
    marginTop: 10,
    gap: 4,
  },
  guidanceTip: {
    fontSize: 13,
    lineHeight: 20,
  },
  guidanceRisks: {
    marginTop: 8,
  },
  guidanceRiskTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    padding: 20,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  pickerOption: {
    padding: 14,
    marginBottom: 4,
  },
  pickerOptionText: {
    fontSize: 16,
  },
});
