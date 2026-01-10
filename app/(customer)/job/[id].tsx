import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  RefreshControl,
  Dimensions,
  FlatList,
  Animated as RNAnimated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolate,
  FadeIn,
  FadeInRight,
  SlideInRight,
} from "react-native-reanimated";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { CancelQuoteModal } from "../../../src/components/CancelQuoteModal";
import { UserProfileCard } from "../../../components/profile/UserProfileCardQuotes";
import { ProfileCardModal } from "../../../components/profile/ProfileCardModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JobProgressTracker, InvoiceView, JobActions } from "../../../components/job";
import { getContractWithDetails, subscribeToJobProgress, subscribeToJobContract } from "../../../src/lib/job-contract";
import { getInvoiceByJobId, subscribeToLineItems } from "../../../src/lib/invoice";
import type { JobContract, JobProgress, Invoice } from "../../../src/types/job-lifecycle";
import { getDisplayTitle } from "../../../src/lib/format-symptom";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const QUOTE_CARD_WIDTH = SCREEN_WIDTH - 80;

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type JobIntake = {
  symptom?: { key: string; label: string };
  answers?: Record<string, string>;
  context?: {
    can_move?: string;
    location_type?: string;
    location?: string;
    time_preference?: string;
    mileage?: string | null;
    additional_details?: string;
  };
  vehicle?: {
    id: string;
    year: number;
    make: string;
    model: string;
    nickname?: string | null;
  };
};

type Quote = {
  id: string;
  job_id: string;
  mechanic_id: string;
  status: "pending" | "accepted" | "declined" | "expired" | "withdrawn";
  price_cents: number | null;
  estimated_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  accepted_at?: string | null;
  cancel_reason?: string | null;
  cancel_note?: string | null;
  cancellation_fee_cents?: number | null;
  mechanic?: { full_name: string | null } | null;
};

type Job = {
  id: string;
  title: string;
  description: string | null;
  preferred_time: string | null;
  status: string;
  created_at: string;
  accepted_mechanic_id: string | null;
  accepted_mechanic: { full_name: string | null } | null;
  vehicle_id: string | null;
  vehicle: { year: number; make: string; model: string } | null;
  canceled_at: string | null;
  canceled_by: string | null;
};

const parseJobIntake = (description: string | null): JobIntake | null => {
  if (!description) return null;
  try {
    return JSON.parse(description) as JobIntake;
  } catch {
    return null;
  }
};

const money = (cents: number | null) => (cents == null ? "—" : `$${(cents / 100).toFixed(0)}`);

const fmtRelative = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
};

const normalizeCanMove = (raw?: string) => {
  const s = (raw || "").trim();
  const l = s.toLowerCase();
  if (!s) return "Not sure";
  if (l === "yes") return "Yes";
  if (l === "no") return "No";
  if (l === "not sure" || l === "unsure") return "Not sure";
  return s;
};

const normalizeLocation = (raw?: string) => {
  const s = (raw || "").trim();
  const l = s.toLowerCase();
  if (!s) return "Not specified";
  if (l === "driveway") return "Driveway";
  if (l === "parking_lot" || l === "parking lot") return "Parking lot";
  if (l === "roadside") return "Roadside";
  return s;
};

export default function CustomerJobDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { colors, text, spacing } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [job, setJob] = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);
  const [questionMap, setQuestionMap] = useState<Record<string, string>>({});
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [invoiceExpanded, setInvoiceExpanded] = useState(false);

  const [contract, setContract] = useState<JobContract | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const detailsChevronRotation = useSharedValue(0);

  useEffect(() => {
    detailsChevronRotation.value = withTiming(detailsExpanded ? 180 : 0, { duration: 200 });
  }, [detailsExpanded]);

  const detailsChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${detailsChevronRotation.value}deg` }],
  }));

  const statusConfig = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "searching") return { color: colors.textMuted, icon: "search" as const, label: "Searching" };
    if (s === "quoted") return { color: colors.warning, icon: "pricetags" as const, label: "Quoted" };
    if (s === "accepted") return { color: colors.accent, icon: "checkmark-circle" as const, label: "Accepted" };
    if (s === "work_in_progress") return { color: colors.accent, icon: "construct" as const, label: "In Progress" };
    if (s === "completed") return { color: colors.success, icon: "checkmark-done-circle" as const, label: "Completed" };
    if (s === "canceled" || s.includes("canceled")) return { color: colors.error, icon: "close-circle" as const, label: "Canceled" };
    return { color: colors.textMuted, icon: "ellipse" as const, label: status };
  };

  const openChat = useCallback(() => {
    if (!id) return;
    router.push(`/(customer)/messages/${id}` as any);
  }, [id, router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const customerId = userData.user?.id;
      if (!customerId || !id) return;

      const { data: j, error: jErr } = await supabase
        .from("jobs")
        .select(`id,title,description,preferred_time,status,created_at,accepted_mechanic_id,vehicle_id,canceled_at,canceled_by,vehicle:vehicles(year, make, model)`)
        .eq("id", id)
        .eq("customer_id", customerId)
        .maybeSingle();

      if (jErr) {
        Alert.alert("Error", "Failed to load job details.");
        return;
      }

      if (!j) {
        Alert.alert("Not Found", "Job not found or you don't have access.");
        return;
      }

      setJob(j as any as Job);

      const intake = parseJobIntake(j.description);
      if (intake?.symptom?.key && intake?.answers) {
        const answerKeys = Object.keys(intake.answers);
        if (answerKeys.length > 0) {
          const { data: questions } = await supabase
            .from("symptom_questions")
            .select("question_key, question_text")
            .eq("symptom_key", intake.symptom.key)
            .in("question_key", answerKeys);

          if (questions) {
            const qMap: Record<string, string> = {};
            questions.forEach((q: any) => {
              qMap[q.question_key] = q.question_text;
            });
            setQuestionMap(qMap);
          }
        }
      }

      const { data: q, error: qErr } = await supabase
        .from("quotes")
        .select(`id,job_id,mechanic_id,status,price_cents,estimated_hours,notes,created_at,updated_at,mechanic:profiles!quotes_mechanic_id_fkey(full_name,phone)`)
        .eq("job_id", id)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      setQuotes((q as any as Quote[]) ?? []);

      const lifecycleData = await getContractWithDetails(id);
      setContract(lifecycleData.contract);
      setProgress(lifecycleData.progress);

      if (lifecycleData.contract) {
        const invoiceData = await getInvoiceByJobId(id);
        setInvoice(invoiceData);
      } else {
        setInvoice(null);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load job.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id || !job?.accepted_mechanic_id) return;

    const progressChannel = subscribeToJobProgress(id, (p) => setProgress(p));
    const contractChannel = subscribeToJobContract(id, async (c) => {
      setContract(c);
      if (c) {
        const invoiceData = await getInvoiceByJobId(id);
        setInvoice(invoiceData);
      }
    });

    let lineItemsChannel: ReturnType<typeof subscribeToLineItems> | null = null;
    if (contract?.id) {
      lineItemsChannel = subscribeToLineItems(contract.id, async () => {
        const invoiceData = await getInvoiceByJobId(id);
        setInvoice(invoiceData);
      });
    }

    return () => {
      supabase.removeChannel(progressChannel);
      supabase.removeChannel(contractChannel);
      if (lineItemsChannel) supabase.removeChannel(lineItemsChannel);
    };
  }, [id, job?.accepted_mechanic_id, contract?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const acceptQuote = async (quoteId: string) => {
    try {
      setBusy(true);
      router.push(`/(customer)/payment/${id}?quoteId=${quoteId}` as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to accept quote.");
    } finally {
      setBusy(false);
    }
  };

  const rejectQuote = async (quoteId: string) => {
    Alert.alert("Decline Quote", "Are you sure you want to decline this quote?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(true);
            const { error } = await supabase.from("quotes").update({ status: "declined" }).eq("id", quoteId);
            if (error) throw error;
            await load();
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to decline quote.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
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
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={{ ...text.section, marginTop: spacing.md }}>Job not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent, fontWeight: "700" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const intake = parseJobIntake(job.description);
  const acceptedQuote = quotes.find((q) => q.status === "accepted" || q.mechanic_id === job.accepted_mechanic_id);
  const pendingQuotes = quotes.filter((q) => q.status === "pending");
  const effectiveStatus = job.accepted_mechanic_id ? job.status : quotes.some((q) => q.status === "pending") ? "quoted" : job.status;
  const statusInfo = statusConfig(effectiveStatus);

  const QuoteCard = ({ quote, index }: { quote: Quote; index: number }) => {
    const isAccepted = quote.status === "accepted" || quote.mechanic_id === job.accepted_mechanic_id;
    const canAccept = quote.status === "pending" && quote.price_cents != null && !job.accepted_mechanic_id;
    const needsPayment = quote.status === "accepted" && !contract && quote.price_cents != null;
    const isExpanded = expandedQuote === quote.id;

    const inputRange = [(index - 1) * QUOTE_CARD_WIDTH, index * QUOTE_CARD_WIDTH, (index + 1) * QUOTE_CARD_WIDTH];
    const scale = scrollX.interpolate({ inputRange, outputRange: [0.9, 1, 0.9], extrapolate: "clamp" });
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: "clamp" });

    const notes = quote.notes || "";
    const hasDriveFee = notes.toLowerCase().includes("drive fee");
    const hasDiagnosticFee = notes.toLowerCase().includes("diagnostic fee");
    const isRange = notes.toLowerCase().includes("range:");
    const rangeMatch = notes.match(/Range:\s*\$(\d+)\s*-\s*\$(\d+)/i);
    const rangeLow = rangeMatch ? parseInt(rangeMatch[1]) : null;
    const rangeHigh = rangeMatch ? parseInt(rangeMatch[2]) : null;
    const driveFee = hasDriveFee ? 50 : 0;
    const diagnosticFee = hasDiagnosticFee ? 80 : 0;
    const totalFees = driveFee + diagnosticFee;
    const totalCents = quote.price_cents || 0;
    const laborCents = totalCents - totalFees * 100;

    const cleanNotes = notes
      .replace(/Range:\s*\$\d+\s*-\s*\$\d+\s*/gi, "")
      .replace(/Fees included:[\s\S]*$/gi, "")
      .trim();

    return (
      <RNAnimated.View style={{ width: QUOTE_CARD_WIDTH, marginHorizontal: 8, transform: [{ scale }], opacity }}>
        <View
          style={[
            card,
            {
              padding: spacing.md,
              borderColor: isAccepted ? colors.accent : colors.border,
              borderWidth: isAccepted ? 2 : 1,
            },
          ]}
        >
          {isAccepted && (
            <View
              style={{
                position: "absolute",
                top: -1,
                right: 16,
                backgroundColor: colors.accent,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8,
              }}
            >
              <Text style={{ color: "#000", fontSize: 10, fontWeight: "900" }}>ACCEPTED</Text>
            </View>
          )}

          <View style={{ marginBottom: spacing.sm }}>
            <UserProfileCard
              userId={quote.mechanic_id}
              variant="mini"
              context="quote_list"
              onPressViewProfile={() => setSelectedMechanicId(quote.mechanic_id)}
            />
          </View>

          <View style={{ alignItems: "center", marginVertical: spacing.md }}>
            <Text style={{ ...text.muted, fontSize: 12 }}>
              {isRange ? "Price Range" : "Total Price"}
            </Text>
            <Text style={{ fontSize: 32, fontWeight: "900", color: colors.accent, marginTop: 4 }}>
              {isRange && rangeLow && rangeHigh ? `$${rangeLow} - $${rangeHigh}` : money(quote.price_cents)}
            </Text>
            {quote.estimated_hours && (
              <Text style={{ ...text.muted, fontSize: 12, marginTop: 4 }}>
                Est. {quote.estimated_hours < 1 ? `${Math.round(quote.estimated_hours * 60)} min` : `${quote.estimated_hours.toFixed(1)} hrs`}
              </Text>
            )}
          </View>

          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setExpandedQuote(isExpanded ? null : quote.id);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 8,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ ...text.muted, fontSize: 12, fontWeight: "700" }}>
              {isExpanded ? "Hide Breakdown" : "View Breakdown"}
            </Text>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
          </Pressable>

          {isExpanded && (
            <View style={{ paddingTop: spacing.sm, gap: spacing.xs }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: 8 }}>
                {isRange && rangeLow !== null && rangeHigh !== null ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.body}>Labor (range)</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>${rangeLow - totalFees} - ${rangeHigh - totalFees}</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.body}>Labor</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>${(laborCents / 100).toFixed(0)}</Text>
                  </View>
                )}
                {hasDriveFee && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.body}>Drive fee</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>${driveFee}</Text>
                  </View>
                )}
                {hasDiagnosticFee && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.body}>Diagnostic fee</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>${diagnosticFee}</Text>
                  </View>
                )}
                {(hasDriveFee || hasDiagnosticFee) && (
                  <>
                    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ ...text.body, fontWeight: "900" }}>Total</Text>
                      <Text style={{ ...text.body, fontWeight: "900", color: colors.accent }}>
                        {isRange && rangeLow && rangeHigh ? `$${rangeLow} - $${rangeHigh}` : money(quote.price_cents)}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {cleanNotes ? (
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md }}>
                  <Text style={{ ...text.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>MECHANIC NOTE</Text>
                  <Text style={text.body}>{cleanNotes}</Text>
                </View>
              ) : null}
            </View>
          )}

          {needsPayment ? (
            <Pressable
              onPress={() => router.push(`/(customer)/payment/${id}?quoteId=${quote.id}` as any)}
              disabled={busy}
              style={({ pressed }) => ({
                backgroundColor: colors.accent,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
                marginTop: spacing.md,
                opacity: busy ? 0.5 : pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontWeight: "900", color: "#000" }}>Proceed to Payment</Text>
            </Pressable>
          ) : canAccept ? (
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable
                onPress={() => rejectQuote(quote.id)}
                disabled={busy}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  opacity: busy ? 0.5 : pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Decline</Text>
              </Pressable>
              <Pressable
                onPress={() => acceptQuote(quote.id)}
                disabled={busy}
                style={({ pressed }) => ({
                  flex: 2,
                  backgroundColor: colors.accent,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  opacity: busy ? 0.5 : pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontWeight: "900", color: "#000" }}>{busy ? "Processing..." : "Accept Quote"}</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={{ ...text.muted, fontSize: 11, textAlign: "center", marginTop: spacing.sm }}>
            Received {fmtRelative(quote.created_at)}
          </Text>
        </View>
      </RNAnimated.View>
    );
  };

  const context = intake?.context;
  const canMoveText = normalizeCanMove(context?.can_move);
  const locationText = normalizeLocation(context?.location_type || context?.location);
  const timeText = context?.time_preference || job.preferred_time || "Flexible";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={[colors.accent, colors.accent + "CC"]} style={{ paddingTop: insets.top, paddingBottom: spacing.xl }}>
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(customer)/(tabs)/jobs" as any))}
              hitSlop={12}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.md }}
            >
              <Ionicons name="chevron-back" size={20} color="#000" />
              <Text style={{ color: "#000", fontWeight: "700" }}>Back</Text>
            </Pressable>

            <Text style={{ fontSize: 24, fontWeight: "900", color: "#000", marginBottom: 8 }}>
              {getDisplayTitle(job.title)}
            </Text>

            {intake?.vehicle && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm }}>
                <Ionicons name="car-outline" size={16} color="#000" />
                <Text style={{ color: "#000", fontWeight: "600" }}>
                  {intake.vehicle.year} {intake.vehicle.make} {intake.vehicle.model}
                </Text>
              </View>
            )}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: "rgba(0,0,0,0.15)",
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
              }}
            >
              <Ionicons name={statusInfo.icon} size={14} color="#000" />
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 12 }}>{statusInfo.label.toUpperCase()}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.md, marginTop: -spacing.lg }}>
          {job.accepted_mechanic_id && (
            <Pressable
              onPress={openChat}
              style={({ pressed }) => [
                card,
                {
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: colors.accent,
                  borderColor: colors.accent,
                  marginBottom: spacing.md,
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="chatbubbles" size={22} color="#000" />
                </View>
                <View>
                  <Text style={{ fontWeight: "900", color: "#000", fontSize: 16 }}>Chat with Mechanic</Text>
                  <Text style={{ color: "rgba(0,0,0,0.7)", fontSize: 12, marginTop: 2 }}>Message your assigned mechanic</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#000" />
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setDetailsExpanded(!detailsExpanded);
            }}
            style={[card, { padding: spacing.md, marginBottom: spacing.md }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                </View>
                <Text style={text.section}>Job Details</Text>
              </View>
              <Animated.View style={detailsChevronStyle}>
                <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
              </Animated.View>
            </View>

            {!detailsExpanded && (
              <Text style={{ ...text.muted, marginTop: spacing.sm }} numberOfLines={1}>
                {intake?.symptom?.label || "Tap to view details"}
              </Text>
            )}

            {detailsExpanded && intake && (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {intake.symptom?.label && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md }}>
                    <Text style={{ ...text.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>ISSUE</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>{intake.symptom.label}</Text>
                  </View>
                )}

                {intake.answers && Object.keys(intake.answers).length > 0 && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: 8 }}>
                    <Text style={{ ...text.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>DETAILS</Text>
                    {Object.entries(intake.answers).map(([key, value]) => (
                      <View key={key} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ ...text.muted, flex: 1 }}>{questionMap[key] || key}</Text>
                        <Text style={{ ...text.body, fontWeight: "700" }}>{value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {context && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: 8 }}>
                    <Text style={{ ...text.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>CONTEXT</Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={text.muted}>Can move vehicle</Text>
                      <Text style={{ ...text.body, fontWeight: "700" }}>{canMoveText}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={text.muted}>Location</Text>
                      <Text style={{ ...text.body, fontWeight: "700" }}>{locationText}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={text.muted}>Time preference</Text>
                      <Text style={{ ...text.body, fontWeight: "700" }}>{timeText}</Text>
                    </View>
                    {context.mileage && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={text.muted}>Mileage</Text>
                        <Text style={{ ...text.body, fontWeight: "700" }}>{context.mileage}</Text>
                      </View>
                    )}
                    {context.additional_details && (
                      <View style={{ marginTop: 4 }}>
                        <Text style={text.muted}>Additional details</Text>
                        <Text style={{ ...text.body, marginTop: 4 }}>{context.additional_details}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </Pressable>

          {quotes.length > 0 && !job.accepted_mechanic_id && (
            <View style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm, paddingHorizontal: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={text.section}>Quotes</Text>
                  <View style={{ backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: "#000", fontSize: 12, fontWeight: "900" }}>{pendingQuotes.length}</Text>
                  </View>
                </View>
                <Text style={{ ...text.muted, fontSize: 12 }}>Swipe to browse</Text>
              </View>

              <RNAnimated.FlatList
                data={quotes}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={QUOTE_CARD_WIDTH + 16}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 32 }}
                onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
                renderItem={({ item, index }) => <QuoteCard quote={item} index={index} />}
              />

              {quotes.length > 1 && (
                <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.sm, gap: 6 }}>
                  {quotes.map((_, i) => {
                    const inputRange = [(i - 1) * QUOTE_CARD_WIDTH, i * QUOTE_CARD_WIDTH, (i + 1) * QUOTE_CARD_WIDTH];
                    const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 16, 8], extrapolate: "clamp" });
                    const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: "clamp" });
                    return (
                      <RNAnimated.View
                        key={i}
                        style={{
                          width: dotWidth,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.accent,
                          opacity: dotOpacity,
                        }}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {quotes.length === 0 && !job.accepted_mechanic_id && (
            <View style={[card, { padding: spacing.xl, alignItems: "center", marginBottom: spacing.md }]}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent + "20", alignItems: "center", justifyContent: "center", marginBottom: spacing.md }}>
                <Ionicons name="time-outline" size={32} color={colors.accent} />
              </View>
              <Text style={{ ...text.section, textAlign: "center" }}>Waiting for Quotes</Text>
              <Text style={{ ...text.muted, textAlign: "center", marginTop: spacing.sm }}>
                Mechanics are reviewing your request. Quotes will appear here automatically.
              </Text>
            </View>
          )}

          {job.accepted_mechanic_id && acceptedQuote && (
            <>
              {!contract && (
                <View style={[card, { padding: spacing.md, marginBottom: spacing.md }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.warning + "20", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="card-outline" size={18} color={colors.warning} />
                    </View>
                    <Text style={text.section}>Payment Required</Text>
                  </View>
                  <Text style={{ ...text.muted, marginBottom: spacing.md }}>
                    Complete payment to confirm your booking and notify the mechanic.
                  </Text>
                  <Pressable
                    onPress={() => router.push(`/(customer)/payment/${id}?quoteId=${acceptedQuote.id}` as any)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? colors.accent + "DD" : colors.accent,
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                    })}
                  >
                    <Text style={{ color: colors.buttonText, fontWeight: "700", fontSize: 16 }}>Complete Payment</Text>
                  </Pressable>
                </View>
              )}

              {contract && (
                <View style={[card, { padding: spacing.md, marginBottom: spacing.md }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent + "20", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="trending-up-outline" size={18} color={colors.accent} />
                    </View>
                    <Text style={text.section}>Job Progress</Text>
                  </View>
                  <JobProgressTracker progress={progress} status={job.status} role="customer" />
                </View>
              )}

              {contract && job.status !== "completed" && job.status !== "canceled" && (
                <View style={[card, { padding: spacing.md, marginBottom: spacing.md }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#f59e0b20", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="hand-left-outline" size={18} color="#f59e0b" />
                    </View>
                    <Text style={text.section}>Actions Required</Text>
                  </View>
                  <JobActions
                    jobId={id}
                    progress={progress}
                    contract={contract}
                    role="customer"
                    onRefresh={load}
                    hasPendingItems={(invoice?.pending_items.length ?? 0) > 0}
                  />
                </View>
              )}

              {invoice && (
                <Pressable
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setInvoiceExpanded(!invoiceExpanded);
                  }}
                  style={[card, { padding: spacing.md, marginBottom: spacing.md }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="receipt-outline" size={18} color="#10B981" />
                      </View>
                      <Text style={text.section}>Invoice</Text>
                    </View>
                    <Ionicons name={invoiceExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
                  </View>

                  {!invoiceExpanded && (
                    <Text style={{ ...text.body, color: colors.accent, fontWeight: "900", marginTop: spacing.sm }}>
                      Total: ${((invoice.approved_subtotal_cents + invoice.pending_subtotal_cents + invoice.contract.platform_fee_cents) / 100).toFixed(2)}
                    </Text>
                  )}

                  {invoiceExpanded && (
                    <View style={{ marginTop: spacing.sm }}>
                      <InvoiceView
                        invoice={invoice}
                        role="customer"
                        onRefresh={load}
                        showPendingActions={job.status !== "completed" && job.status !== "canceled"}
                      />
                    </View>
                  )}
                </Pressable>
              )}

              <View style={[card, { padding: spacing.md, marginBottom: spacing.md }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent + "20", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="person-outline" size={18} color={colors.accent} />
                  </View>
                  <Text style={text.section}>Your Mechanic</Text>
                </View>

                <UserProfileCard
                  userId={job.accepted_mechanic_id}
                  variant="mini"
                  context="quote_detail"
                  onPressViewProfile={() => setSelectedMechanicId(job.accepted_mechanic_id!)}
                />

                {job.status !== "completed" && job.status !== "canceled" && (
                  <Pressable
                    onPress={() => setShowCancelModal(true)}
                    style={({ pressed }) => ({
                      marginTop: spacing.md,
                      paddingVertical: 14,
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: "#EF4444",
                      borderRadius: 12,
                      alignItems: "center",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontWeight: "700", color: "#EF4444" }}>Cancel Job</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {acceptedQuote && job && (
        <CancelQuoteModal
          visible={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            setShowCancelModal(false);
            load();
            router.replace("/(customer)/(tabs)/jobs" as any);
          }}
          quoteId={acceptedQuote.id}
          jobId={id}
          acceptedAt={acceptedQuote.accepted_at}
          jobStatus={job.status}
        />
      )}

      {selectedMechanicId && (
        <ProfileCardModal
          visible={!!selectedMechanicId}
          userId={selectedMechanicId}
          onClose={() => setSelectedMechanicId(null)}
          title="Mechanic Profile"
          showReviewsButton={true}
        />
      )}
    </View>
  );
}
