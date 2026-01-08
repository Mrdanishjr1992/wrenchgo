import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "expired"
    | "withdrawn";
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

const fmtDT = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

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
  // supports your current stored values: "Yes" | "No" | "Not sure"
  return s;
};

const normalizeLocation = (raw?: string) => {
  const s = (raw || "").trim();
  const l = s.toLowerCase();
  if (!s) return "Not specified";
  if (l === "driveway") return "Driveway";
  if (l === "parking_lot" || l === "parking lot") return "Parking lot";
  if (l === "roadside") return "Roadside";
  // supports your current stored values: "Driveway" | "Parking lot" | "Roadside"
  return s;
};

export default function CustomerJobDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { colors, text, spacing } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [job, setJob] = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);
  const [questionMap, setQuestionMap] = useState<Record<string, string>>({});
  const [quotesExpanded, setQuotesExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [invoiceExpanded, setInvoiceExpanded] = useState(false);
  const insets = useSafeAreaInsets();

  // Job lifecycle state
  const [contract, setContract] = useState<JobContract | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const statusColor = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted") return colors.accent;
    if (s === "work_in_progress") return colors.accent;
    if (s === "completed") return colors.success;
    if (s === "searching") return colors.textMuted;
    if (s === "quoted") return "#f59e0b"; // Orange for quoted
    if (s === "canceled" || s.includes("canceled")) return "#EF4444";
    return colors.textMuted;
  };

  const statusEmoji = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "searching") return "🔎";
    if (s === "accepted") return "✅";
    if (s === "work_in_progress") return "🛠️";
    if (s === "completed") return "🏁";
    if (s === "quoted") return "💬";
    if (s === "canceled" || s.includes("canceled")) return "❌";
    return "•";
  };

  const StatusPill = ({ status }: { status: string }) => {
    const c = statusColor(status);
    return (
      <View
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: c + "1F",
          borderWidth: 1,
          borderColor: c + "55",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 12 }}>{statusEmoji(status)}</Text>
        <Text style={{ fontSize: 12, fontWeight: "900", color: c }}>
          {(status || "unknown").toUpperCase()}
        </Text>
      </View>
    );
  };

  const SectionCard = ({
    title,
    icon,
    children,
  }: {
    title: string;
    icon?: any;
    children: any;
  }) => (
    <View style={[card, { padding: spacing.md, gap: spacing.sm }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {icon ? (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={icon} size={18} color={colors.textPrimary} />
          </View>
        ) : null}
        <Text style={text.section}>{title}</Text>
      </View>
      {children}
    </View>
  );

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
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
        .select(
          `
          id,title,description,preferred_time,status,created_at,accepted_mechanic_id,vehicle_id,canceled_at,canceled_by,
          vehicle:vehicles(year, make, model)
        `
        )
        .eq("id", id)
        .eq("customer_id", customerId)
        .maybeSingle();

      if (jErr) {
        console.error("Error loading job:", jErr);
        Alert.alert("Error", "Failed to load job details. Please try again.");
        return;
      }

      if (!j) {
        Alert.alert("Not Found", "Job not found or you don't have access.");
        return;
      }

      setJob(j as any as Job);

      // Fetch question texts for this job's symptom
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
        .select(
          `id,job_id,mechanic_id,status,price_cents,estimated_hours,notes,created_at,updated_at,
           mechanic:profiles!quotes_mechanic_id_fkey(full_name,phone)`
        )
        .eq("job_id", id)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      setQuotes((q as any as Quote[]) ?? []);

      // Load lifecycle data - check for contract regardless of accepted_mechanic_id
      // Contract might exist even if status hasn't updated properly
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
      console.error("Job load error:", e);
      Alert.alert("Error", e?.message ?? "Failed to load job.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let channel: any;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const customerId = userData.user?.id;
      if (!customerId || !id) return;

      channel = supabase
        .channel("customer-job-" + id)
        .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${id}` }, load)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "quotes", filter: `job_id=eq.${id}` },
          load
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [id, load]);

  // Subscribe to lifecycle updates for accepted jobs
  useEffect(() => {
    if (!job?.accepted_mechanic_id || !id || !contract) return;

    const progressSub = subscribeToJobProgress(id, (p) => setProgress(p));
    const contractSub = subscribeToJobContract(id, (c) => setContract(c));
    const lineItemsSub = contract?.id
      ? subscribeToLineItems(contract.id, async () => {
          const invoiceData = await getInvoiceByJobId(id);
          setInvoice(invoiceData);
        })
      : null;

    return () => {
      progressSub?.unsubscribe();
      contractSub?.unsubscribe();
      lineItemsSub?.unsubscribe();
    };
  }, [id, job?.accepted_mechanic_id, contract?.id]);

  // "Quoted" means mechanic submitted a price - status is "pending" with price_cents set
  const quotedQuotes = useMemo(() => quotes.filter((q) => q.status === "pending" && q.price_cents != null), [quotes]);
  const acceptedQuote = useMemo(
    () => quotes.find((q) => q.status === "accepted" || q.mechanic_id === job?.accepted_mechanic_id),
    [quotes, job]
  );

  const quoteCount = quotes.length;
  const prices = quotes
    .map((q) => q.price_cents)
    .filter((p): p is number => p !== null && p !== undefined);
  const minQuote = prices.length > 0 ? Math.min(...prices) : null;
  const maxQuote = prices.length > 0 ? Math.max(...prices) : null;

  const acceptQuote = useCallback(
    async (quoteId: string) => {
      Alert.alert(
        "Commit to Payment?",
        "After committing, you'll be taken to the payment screen to complete your booking.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Commit to Payment",
            style: "default",
            onPress: () => {
              router.push(`/(customer)/payment/${id}?quoteId=${quoteId}` as any);
            },
          },
        ]
      );
    },
    [id, router]
  );

  const rejectQuote = useCallback(
    async (quoteId: string) => {
      Alert.alert(
        "Reject Quote?",
        "Are you sure you want to reject this quote?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reject",
            style: "destructive",
            onPress: async () => {
              try {
                setBusy(true);
                const { error } = await supabase
                  .from("quotes")
                  .update({ status: "declined", updated_at: new Date().toISOString() })
                  .eq("id", quoteId);
                if (error) throw error;
                load();
              } catch (e: any) {
                Alert.alert("Reject error", e?.message ?? "Failed to reject quote.");
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    },
    [load]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 10, ...text.muted }}>Loading job…</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
        <Text style={text.title}>Job</Text>
        <Text style={{ marginTop: 10, ...text.body }}>No job found.</Text>
      </View>
    );
  }

  // Single source of truth: job.status (corrected if accepted_mechanic_id exists)
  const effectiveStatus = job.accepted_mechanic_id
    ? (job.status === 'searching' || job.status === 'draft' || job.status === 'quoted' ? 'accepted' : job.status)
    : job.status;

  // Header hint derived ONLY from effectiveStatus - no fallback to "Searching" unless status is actually searching
  const headerHint = (() => {
    const s = (effectiveStatus || '').toLowerCase();
    if (s === 'accepted' || s === 'scheduled' || s === 'in_progress' || s === 'work_in_progress') {
      return "✅ Assigned — message your mechanic anytime.";
    }
    if (s === 'completed') {
      return "🎉 Job completed — please rate your mechanic.";
    }
    if (s === 'cancelled') {
      return "❌ This job was cancelled.";
    }
    if (s === 'quoted') {
      const pendingCount = quotes.filter(q => q.status === 'pending').length;
      const acceptedCount = quotes.filter(q => q.status === 'accepted').length;
      if (acceptedCount > 0) {
        return "✅ Quote accepted — proceed to payment.";
      }
      if (pendingCount > 0) {
        return `🎉 ${pendingCount} quote${pendingCount === 1 ? "" : "s"} ready — pick one to accept.`;
      }
      return "📋 Quotes received — review below.";
    }
    if (s === 'searching' || s === 'draft') {
      if (quotes.length > 0) {
        return `🎉 ${quotes.length} quote${quotes.length === 1 ? "" : "s"} ready — pick one to accept.`;
      }
      return "🔎 Searching — quotes will appear here as mechanics respond.";
    }
    return "📋 View job details below.";
  })();

  return (

    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            gap: spacing.md,
          }}
        >
{/* Top row (Safe Area) */}
<View
  style={{
    paddingTop: insets.top,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  }}
>
  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/(customer)/(tabs)/jobs" as any))}
      hitSlop={12}
      style={({ pressed }) => [{ paddingVertical: 8, paddingRight: 10 }, pressed && { opacity: 0.6 }]}
    >
      <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 18 }}>
        Back
      </Text>
    </Pressable>
  </View>
</View>


        {/* Summary card */}
        <View style={[card, { padding: spacing.lg, gap: 10 }]}>
          <Text style={text.title}>{getDisplayTitle(job.title)}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <StatusPill status={effectiveStatus} />
            <Text style={text.muted}>Created {fmtDT(job.created_at)}</Text>
          </View>

          <View
            style={{
              marginTop: 6,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: spacing.md,
            }}
          >
            <Text style={{ ...text.body, color: colors.textPrimary, fontWeight: "800" }}>{headerHint}</Text>
          </View>
        </View>

        {/* Chat with Mechanic - prominent button for active jobs */}
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
              },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chatbubbles" size={22} color="#fff" />
              </View>
              <View>
                <Text style={{ fontWeight: "900", color: "#fff", fontSize: 16 }}>Chat with Mechanic</Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>
                  Message your assigned mechanic
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </Pressable>
        )}

        {/* Job details */}
        <View style={[card, { padding: spacing.md, gap: spacing.sm }]}>
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setDetailsExpanded(!detailsExpanded);
            }}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
              </View>
              <Text style={text.section}>Job Details</Text>
            </View>
            <Ionicons name={detailsExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
          </Pressable>

          {/* Summary when collapsed */}
          {!detailsExpanded && (
            <Text style={text.muted} numberOfLines={1}>
              {(() => {
                const intake = parseJobIntake(job.description);
                if (intake?.symptom?.label) return intake.symptom.label;
                if (job.vehicle) return `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`;
                return "Tap to view details";
              })()}
            </Text>
          )}

          {detailsExpanded && (
            <>
              {(() => {
                const intake = parseJobIntake(job.description);

                if (!intake) {
                  return (
                    <View>
                      {job.vehicle ? (
                        <View style={{ marginBottom: spacing.sm }}>
                          <Text style={{ ...text.muted, fontSize: 13 }}>Vehicle</Text>
                          <Text style={{ ...text.body, fontWeight: "900", marginTop: 2 }}>
                            {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                          </Text>
                        </View>
                      ) : null}

                      {job.preferred_time ? (
                        <View style={{ marginBottom: spacing.sm }}>
                          <Text style={{ ...text.muted, fontSize: 13 }}>Preferred Time</Text>
                          <Text style={{ ...text.body, fontWeight: "900", marginTop: 2 }}>{job.preferred_time}</Text>
                        </View>
                      ) : null}

                      {job.description ? (
                        <View>
                          <Text style={{ ...text.muted, fontSize: 13 }}>Description</Text>
                          <Text style={{ ...text.body, marginTop: 2 }}>{job.description}</Text>
                        </View>
                      ) : (
                        <Text style={text.muted}>No details provided.</Text>
                      )}
                    </View>
                  );
                }

                const vehicleData = intake.vehicle || job.vehicle;
                const symptomLabel = intake.symptom?.label || "Issue not specified";
                const answers = intake.answers || {};
                const context = intake.context || {};

                const canMoveText = normalizeCanMove(context.can_move);
                const locationText = normalizeLocation(context.location || context.location_type);
                const timeText = context.time_preference || job.preferred_time || "Not specified";

                return (
                  <View style={{ gap: spacing.md }}>
                    {vehicleData && (
                      <View
                        style={{
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          padding: spacing.md,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <Ionicons name="car-outline" size={16} color={colors.accent} />
                          <Text style={{ ...text.muted, fontSize: 13, fontWeight: "900" }}>VEHICLE</Text>
                        </View>
                        <Text style={{ ...text.body, fontWeight: "900", fontSize: 16 }}>
                          {vehicleData.year} {vehicleData.make} {vehicleData.model}
                        </Text>
                        {intake.vehicle?.nickname ? (
                          <Text style={{ ...text.muted, fontSize: 13, marginTop: 2 }}>
                            "{intake.vehicle.nickname}"
                          </Text>
                        ) : null}
                      </View>
                    )}

                    <View
                      style={{
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: spacing.md,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <Ionicons name="alert-circle-outline" size={16} color={colors.accent} />
                        <Text style={{ ...text.muted, fontSize: 13, fontWeight: "900" }}>ISSUE</Text>
                      </View>
                      <Text style={{ ...text.body, fontWeight: "900", fontSize: 16 }}>{symptomLabel}</Text>
                    </View>

                    {Object.keys(answers).length > 0 && (
                      <View
                        style={{
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          padding: spacing.md,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.accent} />
                          <Text style={{ ...text.muted, fontSize: 13, fontWeight: "900" }}>CUSTOMER ANSWERS</Text>
                        </View>

                        <View style={{ gap: spacing.sm }}>
                          {Object.entries(answers).map(([key, value], idx) => {
                            const label = questionMap[key] || `Question ${idx + 1}`;
                            return (
                              <View key={key}>
                                <Text style={{ ...text.muted, fontSize: 12 }}>{label}</Text>
                                <Text style={{ ...text.body, marginTop: 2 }}>{value || "—"}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    <View
                      style={{
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: spacing.md,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                        <Text style={{ ...text.muted, fontSize: 13, fontWeight: "900" }}>CONTEXT</Text>
                      </View>

                      <View style={{ gap: spacing.sm }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ ...text.muted, fontSize: 13 }}>Can move</Text>
                          <Text style={{ ...text.body, fontWeight: "900" }}>{canMoveText}</Text>
                        </View>

                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ ...text.muted, fontSize: 13 }}>Vehicle location</Text>
                          <Text style={{ ...text.body, fontWeight: "900" }}>{locationText}</Text>
                        </View>

                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ ...text.muted, fontSize: 13 }}>Time preference</Text>
                          <Text style={{ ...text.body, fontWeight: "900" }}>{timeText}</Text>
                        </View>

                        {context.mileage ? (
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ ...text.muted, fontSize: 13 }}>Mileage</Text>
                            <Text style={{ ...text.body, fontWeight: "900" }}>{context.mileage}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {job.preferred_time ? (
                      <View
                        style={{
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          padding: spacing.md,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <Ionicons name="time-outline" size={16} color={colors.accent} />
                          <Text style={{ ...text.muted, fontSize: 13, fontWeight: "900" }}>PREFERRED TIME</Text>
                        </View>
                        <Text style={{ ...text.body, fontWeight: "900" }}>{job.preferred_time}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })()}
            </>
          )}
        </View>

        {/* Cancellation (if canceled) */}
        {job.status === "canceled" && job.canceled_by === "customer" && acceptedQuote ? (
          <SectionCard title="Cancellation" icon="close-circle-outline">
            <View
              style={{
                backgroundColor: "#FEE2E2",
                borderWidth: 1,
                borderColor: "#FCA5A5",
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "900", color: "#991B1B" }}>❌ JOB CANCELED</Text>
            </View>

            <Text style={text.body}>
              Canceled on: <Text style={{ fontWeight: "900" }}>{fmtDT(job.canceled_at || "")}</Text>
            </Text>

            {acceptedQuote.cancel_reason ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ ...text.muted, fontSize: 13 }}>Reason</Text>
                <Text style={{ ...text.body, marginTop: 2 }}>
                  {acceptedQuote.cancel_reason.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </Text>
              </View>
            ) : null}

            {acceptedQuote.cancel_note ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ ...text.muted, fontSize: 13 }}>Note</Text>
                <Text style={{ ...text.body, marginTop: 2 }}>{acceptedQuote.cancel_note}</Text>
              </View>
            ) : null}

            {acceptedQuote.cancellation_fee_cents && acceptedQuote.cancellation_fee_cents > 0 ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ ...text.muted, fontSize: 13 }}>Cancellation Fee</Text>
                <Text style={{ ...text.title, fontSize: 20, color: "#EF4444", marginTop: 2 }}>
                  ${(acceptedQuote.cancellation_fee_cents / 100).toFixed(2)}
                </Text>
              </View>
            ) : null}
          </SectionCard>
        ) : null}

        {/* Quotes */}
        <View style={[card, { padding: spacing.md, gap: spacing.sm }]}>
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setQuotesExpanded(!quotesExpanded);
            }}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="pricetag-outline" size={18} color={colors.textPrimary} />
              </View>
              <Text style={text.section}>Quotes</Text>
              {quoteCount > 0 && (
                <View style={{ backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>{quoteCount}</Text>
                </View>
              )}
            </View>
            <Ionicons name={quotesExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
          </Pressable>

          {/* Summary row - always visible */}
          {quoteCount > 0 && !quotesExpanded && (
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              {minQuote !== null && (
                <Text style={{ ...text.body, color: colors.accent, fontWeight: "900" }}>
                  Best: {money(minQuote)}
                </Text>
              )}
              {minQuote !== null && maxQuote !== null && minQuote !== maxQuote && (
                <Text style={text.muted}>
                  Range: {money(minQuote)} – {money(maxQuote)}
                </Text>
              )}
            </View>
          )}

          {quotesExpanded && (
            <>
              {quoteCount > 0 ? (
                <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.sm }}>
                  <View
                    style={{
                      flex: 1,
                      minWidth: 100,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.accent,
                      borderRadius: 12,
                      padding: spacing.md,
                    }}
                  >
                    <Text style={{ ...text.muted, fontSize: 12 }}>Total Quotes</Text>
                    <Text style={{ ...text.title, fontSize: 20, marginTop: 4 }}>{quoteCount}</Text>
                  </View>

                  {minQuote !== null ? (
                    <View
                      style={{
                        flex: 1,
                        minWidth: 100,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.accent,
                        borderRadius: 12,
                        padding: spacing.md,
                      }}
                    >
                      <Text style={{ ...text.muted, fontSize: 12 }}>Best Price</Text>
                      <Text style={{ ...text.title, fontSize: 20, color: colors.accent, marginTop: 4 }}>
                        {money(minQuote)}
                      </Text>
                    </View>
                  ) : null}

                  {minQuote !== null && maxQuote !== null && minQuote !== maxQuote ? (
                    <View
                      style={{
                        flex: 1,
                        minWidth: 100,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: spacing.md,
                      }}
                    >
                      <Text style={{ ...text.muted, fontSize: 12 }}>Price Range</Text>
                      <Text style={{ ...text.body, fontWeight: "900", marginTop: 4 }}>
                        {money(minQuote)} – {money(maxQuote)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {quotes.length === 0 ? (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: spacing.lg,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>⏳</Text>
                  <Text style={{ ...text.section, textAlign: "center" }}>Waiting for quotes</Text>
                  <Text style={{ ...text.muted, marginTop: 6, textAlign: "center" }}>
                    Mechanics will respond soon. You'll see them here automatically.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: spacing.md }}>
                  {quotes.map((q) => {
                    const canAccept =
                      q.status === "pending" && q.price_cents != null && !job.accepted_mechanic_id;
                    const isAccepted = q.status === "accepted" || q.mechanic_id === job.accepted_mechanic_id;
                    const needsPayment = q.status === "accepted" && !contract && q.price_cents != null;
                    const isOpen = expanded[q.id] ?? isAccepted;

                    return (
                      <View
                        key={q.id}
                        style={[
                          card,
                          {
                            padding: spacing.md,
                            gap: spacing.sm,
                            borderColor: isAccepted ? colors.accent : colors.border,
                            borderWidth: isAccepted ? 2 : 1,
                            opacity: busy ? 0.9 : 1,
                          },
                        ]}
                      >
                        {isAccepted ? (
                          <View
                            style={{
                              backgroundColor: `${colors.accent}15`,
                              borderWidth: 1,
                              borderColor: `${colors.accent}40`,
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              alignSelf: "flex-start",
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "900", color: colors.accent }}>✓ ACCEPTED</Text>
                          </View>
                        ) : null}

                        <View style={{ marginBottom: spacing.sm }}>
                          <UserProfileCard
                            userId={q.mechanic_id}
                            variant="mini"
                            context="quote_list"
                            onPressViewProfile={() => setSelectedMechanicId(q.mechanic_id)}
                          />
                        </View>

                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <View
                            style={{
                              backgroundColor:
                                q.status === "accepted"
                                  ? `${colors.success}15`
                                  : q.status === "pending"
                                  ? `${colors.accent}15`
                                  : `${colors.error}15`,
                              borderWidth: 1,
                              borderColor:
                                q.status === "accepted"
                                  ? `${colors.success}40`
                                  : q.status === "pending"
                                  ? `${colors.accent}40`
                                  : `${colors.error}40`,
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "900",
                                color:
                                  q.status === "accepted" ? colors.success : q.status === "pending" ? colors.accent : colors.error,
                              }}
                            >
                              {(q.status || "pending").toUpperCase()}
                            </Text>
                          </View>
                          <View
                            style={{
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 8,
                              padding: spacing.sm,
                            }}
                          >
                            <Text style={{ ...text.muted, fontSize: 11 }}>Total Price</Text>
                            <Text style={{ ...text.title, fontSize: 18, color: colors.accent, marginTop: 2 }}>
                              {money(q.price_cents)}
                            </Text>
                          </View>
                        </View>

                        {needsPayment ? (
                          <Pressable
                            onPress={() => router.push(`/(customer)/payment/${id}?quoteId=${q.id}` as any)}
                            disabled={busy}
                            style={({ pressed }) => [
                              {
                                backgroundColor: colors.accent,
                                paddingVertical: 14,
                                borderRadius: 14,
                                alignItems: "center",
                                marginTop: spacing.sm,
                                opacity: busy ? 0.65 : 1,
                              },
                              pressed && { opacity: 0.85 },
                            ]}
                          >
                            <Text style={{ fontWeight: "900", color: "#fff" }}>
                              Commit to Payment
                            </Text>
                          </Pressable>
                        ) : canAccept ? (
                          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                            <Pressable
                              onPress={() => rejectQuote(q.id)}
                              disabled={busy}
                              style={({ pressed }) => [
                                {
                                  flex: 1,
                                  backgroundColor: colors.surface,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  paddingVertical: 14,
                                  borderRadius: 14,
                                  alignItems: "center",
                                  opacity: busy ? 0.65 : 1,
                                },
                                pressed && { opacity: 0.85 },
                              ]}
                            >
                              <Text style={{ fontWeight: "900", color: colors.textPrimary }}>
                                REJECT
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => acceptQuote(q.id)}
                              disabled={busy}
                              style={({ pressed }) => [
                                {
                                  flex: 1,
                                  backgroundColor: colors.accent,
                                  paddingVertical: 14,
                                  borderRadius: 14,
                                  alignItems: "center",
                                  opacity: busy ? 0.65 : 1,
                                },
                                pressed && { opacity: 0.85 },
                              ]}
                            >
                              <Text style={{ fontWeight: "900", color: "#fff" }}>
                                {busy ? "COMMITTING…" : "Commit to Payment"}
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}

                        <Pressable
                          onPress={() => toggleExpand(q.id)}
                          disabled={busy}
                          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}
                        >
                          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                          <Text style={{ ...text.muted, fontWeight: "800", fontSize: 12 }}>
                            {isOpen ? "Hide details" : "View details"}
                          </Text>
                        </Pressable>

                        {isOpen ? (
                          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                            {q.notes ? (
                              <View
                                style={{
                                  backgroundColor: colors.surface,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  borderRadius: 10,
                                  padding: spacing.md,
                                }}
                              >
                                <Text style={{ ...text.muted, fontWeight: "900", fontSize: 12 }}>Mechanic Note</Text>
                                <Text style={{ ...text.body, marginTop: 4 }}>{q.notes}</Text>
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>

        {/* Assigned mechanic */}
        {job.accepted_mechanic_id && acceptedQuote ? (
          <>

            {/* Progress Tracker */}
            {contract && (
              <SectionCard title="Job Progress" icon="trending-up-outline">
                <JobProgressTracker
                  progress={progress}
                  status={job.status}
                  role="customer"
                />
              </SectionCard>
            )}

            {/* Job Actions */}
            {contract && job.status !== "completed" && job.status !== "canceled" && (
              <SectionCard title="Actions Required" icon="hand-left-outline">
                <JobActions
                  jobId={id}
                  progress={progress}
                  contract={contract}
                  role="customer"
                  onRefresh={load}
                  hasPendingItems={(invoice?.pending_items.length ?? 0) > 0}
                />
              </SectionCard>
            )}

            {/* Invoice */}
            {invoice && (
              <View style={[card, { padding: spacing.md, gap: spacing.sm }]}>
                <Pressable
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setInvoiceExpanded(!invoiceExpanded);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.bg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Ionicons name="receipt-outline" size={18} color={colors.textPrimary} />
                    </View>
                    <Text style={text.section}>Invoice</Text>
                  </View>
                  <Ionicons name={invoiceExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
                </Pressable>

                {/* Summary when collapsed */}
                {!invoiceExpanded && (
                  <Text style={{ ...text.body, color: colors.accent, fontWeight: "900" }}>
                    Total: ${((invoice.approved_subtotal_cents + invoice.pending_subtotal_cents + invoice.contract.platform_fee_cents) / 100).toFixed(2)}
                  </Text>
                )}

                {invoiceExpanded && (
                  <InvoiceView
                    invoice={invoice}
                    role="customer"
                    onRefresh={load}
                    showPendingActions={job.status !== "completed" && job.status !== "canceled"}
                  />
                )}
              </View>
            )}

            {/* Mechanic Info */}
            <SectionCard title="Your Mechanic" icon="person-outline">
              <UserProfileCard
                userId={job.accepted_mechanic_id}
                variant="mini"
                context="quote_detail"
                onPressViewProfile={() => setSelectedMechanicId(job.accepted_mechanic_id!)}
              />

              {job.status !== "completed" && job.status !== "canceled" && (
                <Pressable
                  onPress={() => setShowCancelModal(true)}
                  style={({ pressed }) => [
                    {
                      marginTop: spacing.md,
                      paddingVertical: 14,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: "#EF4444",
                      borderRadius: 14,
                      alignItems: "center",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ fontWeight: "900", color: "#EF4444" }}>Cancel Job</Text>
                </Pressable>
              )}
            </SectionCard>
          </>
        ) : null}
      </ScrollView>

      {/* Cancel modal */}
      {acceptedQuote && job ? (
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
      ) : null}

      {/* Profile modal */}
      {selectedMechanicId ? (
        <ProfileCardModal
          visible={!!selectedMechanicId}
          userId={selectedMechanicId}
          onClose={() => setSelectedMechanicId(null)}
          title="Mechanic Profile"
          showReviewsButton={true}
        />
      ) : null}
    </View>
  );
}
