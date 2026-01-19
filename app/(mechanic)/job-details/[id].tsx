import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { supabase } from "../../../src/lib/supabase";
import { createCard } from "../../../src/ui/styles";
import { useTheme } from "../../../src/ui/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserProfileCard } from "../../../components/profile/UserProfileCardQuotes";
import { ProfileCardModal } from "../../../components/profile/ProfileCardModal";

import { JobProgressTracker, InvoiceView, JobActions, AddLineItemForm } from "../../../components/job";
import { getContractWithDetails, subscribeToJobProgress, subscribeToJobContract } from "../../../src/lib/job-contract";
import { getInvoice, getInvoiceByJobId, subscribeToLineItems } from "../../../src/lib/invoice";
import type { JobContract, JobProgress, Invoice } from "../../../src/types/job-lifecycle";
import { getDisplayTitle } from "../../../src/lib/format-symptom";
import { symptomQuestions } from "../../../src/data/symptomQuestions";
import { getDisputeForJob, mechanicRespondToDispute, formatSlaRemaining, Dispute } from "../../../src/lib/disputes";
import { DISPUTE_STATUS_LABELS, DISPUTE_STATUS_COLORS, DisputeStatus } from "../../../src/constants/disputes";
import { AI_DIAGNOSIS_ENABLED, isDescriptionVague } from "../../../src/lib/aiDiagnosisService";
import { DiagnosisAssistant } from "../../../components/diagnosis/DiagnosisAssistant";

// Note: setLayoutAnimationEnabledExperimental is a no-op in New Architecture
// Removed to suppress warning

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

type Job = {
  id: string;
  title: string;
  description: string | null;
  preferred_time: string | null;
  status: string;
  created_at: string;
  accepted_mechanic_id: string | null;
  customer_id: string;
  vehicle_id: string | null;
  vehicle: { year: number; make: string; model: string } | null;
  canceled_at: string | null;
  canceled_by: string | null;
};

type QuoteRequest = {
  id: string;
  job_id: string;
  status: string;
  price_cents: number | null;
  estimated_hours: number | null;
  notes: string | null;
  canceled_at: string | null;
  canceled_by: string | null;
  cancel_reason: string | null;
  cancel_note: string | null;
  cancellation_fee_cents: number | null;
};

const parseJobIntake = (description: string | null): JobIntake | null => {
  if (!description) return null;
  try {
    return JSON.parse(description) as JobIntake;
  } catch {
    return null;
  }
};

const fmtDT = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const money = (cents: number | null) => (cents == null ? "—" : `$${(cents / 100).toFixed(0)}`);

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

export default function MechanicJobDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, text, spacing } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [mechanicId, setMechanicId] = useState<string | null>(null);

  const [contract, setContract] = useState<JobContract | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [showAddLineItem, setShowAddLineItem] = useState(false);
  const [questionMap, setQuestionMap] = useState<Record<string, string>>({});

  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [invoiceExpanded, setInvoiceExpanded] = useState(false);

  // Dispute state
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [showDisputeResponseModal, setShowDisputeResponseModal] = useState(false);
  const [disputeResponse, setDisputeResponse] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // AI Diagnosis state
  const [showDiagnosis, setShowDiagnosis] = useState(false);

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
    if (s === "quoted") return { color: "#f59e0b", icon: "pricetags" as const, label: "Quoted" };
    if (s === "accepted") return { color: colors.accent, icon: "checkmark-circle" as const, label: "Accepted" };
    if (s === "work_in_progress") return { color: colors.accent, icon: "construct" as const, label: "In Progress" };
    if (s === "completed") return { color: "#10B981", icon: "checkmark-done-circle" as const, label: "Completed" };
    if (s === "canceled" || s.includes("canceled")) return { color: "#EF4444", icon: "close-circle" as const, label: "Canceled" };
    return { color: colors.textMuted, icon: "ellipse" as const, label: status };
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const currentMechanicId = userData.user?.id;

      if (!currentMechanicId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      setMechanicId(currentMechanicId);

      let { data, error } = await supabase
        .from("jobs")
        .select(
          `
          id,title,description,preferred_time,status,created_at,accepted_mechanic_id,customer_id,vehicle_id,
          canceled_at,canceled_by,
          vehicle:vehicles(year, make, model)
        `
        )
        .eq("id", id)
        .eq("accepted_mechanic_id", currentMechanicId)
        .single();

      if (error?.code === "PGRST116") {
        const result = await supabase
          .from("jobs")
          .select(
            `
            id,title,description,preferred_time,status,created_at,accepted_mechanic_id,customer_id,vehicle_id,
            canceled_at,canceled_by,
            vehicle:vehicles(year, make, model)
          `
          )
          .eq("id", id)
          .single();

        if (result.error) {
          Alert.alert("Job Not Found", "This job may have been canceled or is no longer available.");
          router.back();
          return;
        }
        data = result.data;
        error = null;
      } else if (error) {
        throw error;
      }

      setJob(data as any as Job);

      const { data: quoteData } = await supabase
        .from("quotes")
        .select("id,job_id,status,price_cents,estimated_hours,notes,created_at,updated_at,cancel_reason,cancel_note,cancellation_fee_cents")
        .eq("job_id", id)
        .eq("mechanic_id", currentMechanicId)
        .single();

      if (quoteData) {
        setQuoteRequest(quoteData as any as QuoteRequest);
      }

      if (data?.accepted_mechanic_id === currentMechanicId) {
        const lifecycleData = await getContractWithDetails(id);
        setContract(lifecycleData.contract);
        setProgress(lifecycleData.progress);

        // Use the contract we already fetched to get invoice
        if (lifecycleData.contract) {
          const invoiceData = await getInvoice(lifecycleData.contract.id, lifecycleData.contract);
          setInvoice(invoiceData);
          } else {
        setInvoice(null);
          }
        
// Check for disputes on this job
        try {
        const disputeData = await getDisputeForJob(id);
          setDispute(disputeData);
          } catch (err) {
          console.log('Error checking for disputes:', err);
        }
      } else {
        setContract(null);
        setProgress(null);
        setInvoice(null);
        setDispute(null);
      }

      const intake = parseJobIntake(data?.description);
      if (intake?.symptom?.key && intake?.answers) {
        const questions = symptomQuestions[intake.symptom.key] || [];
        const qMap: Record<string, string> = {};
        questions.forEach((q) => {
          qMap[q.question_key] = q.question_label;
        });
        setQuestionMap(qMap);
      }
    } catch (e: any) {
      Alert.alert("Job error", e?.message ?? "Failed to load job.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

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
      const mechanicId = userData.user?.id;
      if (!mechanicId || !id) return;

      channel = supabase
        .channel("mechanic-job-" + id)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "jobs",
          filter: `id=eq.${id}`
        }, load)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "quotes",
          filter: `job_id=eq.${id}`
        }, load)
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [id, load]);

  useEffect(() => {
    if (!job?.accepted_mechanic_id || !id) return;

    const progressChannel = subscribeToJobProgress(id, (p) => setProgress(p));
    const contractChannel = subscribeToJobContract(id, (c) => setContract(c));

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

  const openChat = useCallback(() => {
    if (!job?.id) return;
    router.push(`/(mechanic)/messages/${job.id}` as any);
  }, [job?.id, router]);

  const chatUnlocked = !!job?.accepted_mechanic_id && job?.status !== "canceled";

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
  const statusInfo = statusConfig(job.status);
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
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(mechanic)/(tabs)/jobs" as any))}
              hitSlop={12}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.md }}
            >
              <Ionicons name="chevron-back" size={20} color="#000" />
              <Text style={{ color: "#000", fontWeight: "700" }}>Back</Text>
            </Pressable>

            <Text style={{ fontSize: 24, fontWeight: "900", color: "#000", marginBottom: 8 }}>
              {getDisplayTitle(job.title)}
            </Text>

            {(intake?.vehicle || job.vehicle) && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm }}>
                <Ionicons name="car-outline" size={16} color="#000" />
                <Text style={{ color: "#000", fontWeight: "600" }}>
                  {(intake?.vehicle || job.vehicle)?.year} {(intake?.vehicle || job.vehicle)?.make} {(intake?.vehicle || job.vehicle)?.model}
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

        {/* Dispute Banner */}
        {dispute && (
          <View style={{
            backgroundColor: dispute.sla_breached ? '#EF4444' : '#F59E0B',
            padding: spacing.md,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="warning" size={24} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  {dispute.sla_breached ? 'SLA BREACHED - Response Overdue!' : 'Customer Reported an Issue'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 }}>
                  {dispute.mechanic_response
                    ? `Responded on ${new Date(dispute.mechanic_responded_at!).toLocaleDateString()}`
                    : `Respond within: ${formatSlaRemaining(dispute.response_deadline)}`
                  }
                </Text>
              </View>
            </View>

            {!dispute.mechanic_response && (
              <Pressable
                onPress={() => setShowDisputeResponseModal(true)}
                style={({ pressed }) => ({
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  padding: spacing.md,
                  borderRadius: 8,
                  marginTop: spacing.md,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Respond Now</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                Alert.alert(
                  'Issue Details',
                  `Category: ${dispute.category}\n\nDescription: ${dispute.description}${dispute.desired_resolution ? `\n\nDesired Resolution: ${dispute.desired_resolution}` : ''}`,
                  [{ text: 'OK' }]
                );
              }}
              style={{ marginTop: spacing.sm }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, textDecorationLine: 'underline' }}>
                View Issue Details
              </Text>
            </Pressable>
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.md, marginTop: dispute ? spacing.md : -spacing.lg }}>
          {chatUnlocked && (
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
                  <Text style={{ fontWeight: "900", color: "#000", fontSize: 16 }}>Chat with Customer</Text>
                  <Text style={{ color: "rgba(0,0,0,0.7)", fontSize: 12, marginTop: 2 }}>Message your customer</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#000" />
            </Pressable>
          )}

          {job.customer_id && (
            <View style={[card, { padding: spacing.md, marginBottom: spacing.md }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="person-outline" size={18} color={colors.accent} />
                </View>
                <Text style={text.section}>Customer</Text>
              </View>
              <UserProfileCard
                userId={job.customer_id}
                variant="mini"
                context="quote_detail"
                onPressViewProfile={() => setSelectedCustomerId(job.customer_id)}
              />
            </View>
          )}

          {quoteRequest && (
            <View style={[card, { padding: spacing.md, marginBottom: spacing.md }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="pricetag-outline" size={18} color="#10B981" />
                </View>
                <Text style={text.section}>Your Quote</Text>
              </View>
              <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                <Text style={{ ...text.muted, fontSize: 12 }}>Total Price</Text>
                <Text style={{ fontSize: 32, fontWeight: "900", color: colors.accent, marginTop: 4 }}>
                  {money(quoteRequest.price_cents)}
                </Text>
                {quoteRequest.estimated_hours && (
                  <Text style={{ ...text.muted, fontSize: 12, marginTop: 4 }}>
                    Est. {quoteRequest.estimated_hours < 1 ? `${Math.round(quoteRequest.estimated_hours * 60)} min` : `${quoteRequest.estimated_hours.toFixed(1)} hrs`}
                  </Text>
                )}
              </View>
              {quoteRequest.notes && (
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginTop: spacing.sm }}>
                  <Text style={{ ...text.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>YOUR NOTE</Text>
                  <Text style={text.body}>{quoteRequest.notes.split('\n').filter(line => !line.includes('Platform fee')).join('\n')}</Text>
                </View>
              )}
            </View>
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
                    <Text style={{ ...text.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>CUSTOMER ANSWERS</Text>
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

            {detailsExpanded && !intake && (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {job.vehicle && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md }}>
                    <Text style={{ ...text.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>VEHICLE</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</Text>
                  </View>
                )}
                {job.preferred_time && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md }}>
                    <Text style={{ ...text.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>PREFERRED TIME</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>{job.preferred_time}</Text>
                  </View>
                )}
                {job.description && !job.description.startsWith("{") && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md }}>
                    <Text style={{ ...text.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>DESCRIPTION</Text>
                    <Text style={text.body}>{job.description}</Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>

          {job.status === "canceled" && (
            <View style={[card, { padding: spacing.md, marginBottom: spacing.md, borderColor: "#EF4444", borderWidth: 1 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#EF444420", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                </View>
                <Text style={{ ...text.section, color: "#EF4444" }}>Canceled</Text>
              </View>

              <View style={{ backgroundColor: "#FEE2E2", borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#991B1B" }}>
                  {job.canceled_by === "customer" ? "Canceled by customer" : "Job canceled"}
                </Text>
                <Text style={{ ...text.muted, fontSize: 12, marginTop: 4 }}>
                  {fmtDT(job.canceled_at || "")}
                </Text>
              </View>

              {quoteRequest?.cancel_reason && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={{ ...text.muted, fontSize: 12 }}>Reason</Text>
                  <Text style={{ ...text.body, marginTop: 2 }}>
                    {quoteRequest.cancel_reason.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                </View>
              )}

              {quoteRequest?.cancel_note && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={{ ...text.muted, fontSize: 12 }}>Customer note</Text>
                  <Text style={{ ...text.body, marginTop: 2 }}>{quoteRequest.cancel_note}</Text>
                </View>
              )}

              {quoteRequest?.cancellation_fee_cents && quoteRequest.cancellation_fee_cents > 0 && (
                <View style={{ marginTop: spacing.md, backgroundColor: "#10B98120", borderRadius: 12, padding: spacing.md }}>
                  <Text style={{ ...text.muted, fontSize: 12 }}>Cancellation fee earned</Text>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: "#10B981", marginTop: 4 }}>
                    ${(quoteRequest.cancellation_fee_cents / 100).toFixed(2)}
                  </Text>
                </View>
              )}
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
              <JobProgressTracker progress={progress} status={job.status} role="mechanic" />
            </View>
          )}

          {/* AI Diagnose Button */}
          {AI_DIAGNOSIS_ENABLED && job.status !== "completed" && job.status !== "canceled" && (
            <Pressable
              onPress={() => setShowDiagnosis(true)}
              style={({ pressed }) => [
                card,
                {
                  padding: spacing.md,
                  marginBottom: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  borderWidth: 1,
                  borderColor: colors.accent,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent + "20", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="pulse" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.body, fontWeight: "700", fontSize: 14 }}>AI Diagnose</Text>
                <Text style={{ ...text.muted, fontSize: 12 }}>Get diagnostic help and suggested questions</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.accent} />
            </Pressable>
          )}

          {contract && job.status !== "completed" && job.status !== "canceled" && (
            <View style={[card, { padding: spacing.md, marginBottom: spacing.md }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#f59e0b20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="hand-left-outline" size={18} color="#f59e0b" />
                </View>
                <Text style={text.section}>Actions</Text>
              </View>
              <JobActions
                jobId={id}
                progress={progress}
                contract={contract}
                role="mechanic"
                onRefresh={load}
                hasPendingItems={(invoice?.pending_items.length ?? 0) > 0}
                contractId={contract?.id}
              />
            </View>
          )}

          {invoice && (
            <View style={[card, { padding: spacing.md, marginBottom: spacing.md }]}>
              <Pressable
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setInvoiceExpanded(!invoiceExpanded);
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="receipt-outline" size={18} color="#10B981" />
                    </View>
                    <Text style={text.section}>Invoice & Line Items</Text>
                  </View>
                  <Ionicons name={invoiceExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
                </View>

                {!invoiceExpanded && (() => {
                  const laborTotal = invoice.approved_items
                    .filter(i => i.item_type !== 'platform_fee' && i.item_type !== 'parts')
                    .reduce((sum, i) => sum + i.total_cents, 0);
                  const partsTotal = invoice.approved_items
                    .filter(i => i.item_type === 'parts')
                    .reduce((sum, i) => sum + i.total_cents, 0);
                  const approvedTotal = laborTotal + partsTotal;

                  // 12% of labor only, max $50
                  const serviceFee = Math.min(Math.round(laborTotal * 0.12), 5000);
                  const promoCredit = invoice.contract.mechanic_promo_discount_cents || 0;
                  const earnings = approvedTotal - serviceFee + promoCredit;

                  const pendingTotal = invoice.pending_items.reduce((sum, i) => sum + i.total_cents, 0);

                  return (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
                      <Text style={text.muted}>Your earnings</Text>
                      <Text style={{ ...text.body, color: "#10B981", fontWeight: "900" }}>
                        ${(earnings / 100).toFixed(2)}
                        {pendingTotal > 0 && (
                          <Text style={{ color: colors.textMuted, fontWeight: "500" }}>
                            {" "}(+${(pendingTotal / 100).toFixed(2)} pending)
                          </Text>
                        )}
                      </Text>
                    </View>
                  );
                })()}
              </Pressable>

              {invoiceExpanded && (
                <View style={{ marginTop: spacing.sm }}>
                  <InvoiceView
                    invoice={invoice}
                    role="mechanic"
                    onRefresh={load}
                    showPendingActions={job.status !== "completed" && job.status !== "canceled"}
                  />
                </View>
              )}

              {job.status !== "completed" && job.status !== "canceled" && (
                <Pressable
                  onPress={() => setShowAddLineItem(true)}
                  style={({ pressed }) => ({
                    marginTop: spacing.md,
                    paddingVertical: 14,
                    backgroundColor: colors.accent,
                    borderRadius: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={{ fontWeight: "700", color: "#fff" }}>Add Parts or Labor</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {selectedCustomerId && (
        <ProfileCardModal
          visible={!!selectedCustomerId}
          userId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          title="Customer Profile"
          showReviewsButton={false}
        />
      )}

      {showAddLineItem && (
        <AddLineItemForm
          visible={showAddLineItem}
          onClose={() => setShowAddLineItem(false)}
          jobId={id}
          onSuccess={() => {
            setShowAddLineItem(false);
            load();
          }}
        />
      )}

      {/* Dispute Response Modal */}
      <Modal visible={showDisputeResponseModal} animationType="slide" transparent>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: spacing.lg,
            maxHeight: '80%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <Text style={{ ...text.section }}>Respond to Issue</Text>
              <Pressable onPress={() => setShowDisputeResponseModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView>
              {dispute && (
                <View style={{
                  backgroundColor: '#F59E0B20',
                  padding: spacing.md,
                  borderRadius: 8,
                  marginBottom: spacing.lg,
                }}>
                  <Text style={{ color: '#F59E0B', fontWeight: '600', marginBottom: spacing.sm }}>
                    Customer's Issue
                  </Text>
                  <Text style={{ color: colors.textPrimary, marginBottom: spacing.sm }}>
                    {dispute.description}
                  </Text>
                  {dispute.desired_resolution && (
                    <>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: spacing.sm }}>
                        Desired Resolution:
                      </Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                        {dispute.desired_resolution}
                      </Text>
                    </>
                  )}
                </View>
              )}

              <Text style={{ ...text.xs, color: colors.textSecondary, marginBottom: spacing.sm }}>
                Your Response *
              </Text>
              <TextInput
                value={disputeResponse}
                onChangeText={setDisputeResponse}
                placeholder="Explain your perspective on this issue..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  minHeight: 120,
                  textAlignVertical: 'top',
                  marginBottom: spacing.lg,
                }}
              />

              <View style={{
                backgroundColor: colors.background,
                padding: spacing.md,
                borderRadius: 8,
                marginBottom: spacing.lg,
              }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Your response will be shared with the customer and reviewed by our support team.
                  Please be professional and provide relevant details about the work performed.
                </Text>
              </View>

              <Pressable
                onPress={async () => {
                  if (!disputeResponse.trim()) {
                    Alert.alert('Error', 'Please provide a response');
                    return;
                  }
                  if (!dispute) return;

                  setSubmittingResponse(true);
                  try {
                    const result = await mechanicRespondToDispute(dispute.id, disputeResponse);
                    if (result.success) {
                      Alert.alert(
                        'Response Submitted',
                        result.sla_breached
                          ? 'Your response was submitted but was past the deadline. This may affect your account.'
                          : 'Your response has been submitted and will be reviewed.',
                        [{ text: 'OK', onPress: () => {
                          setShowDisputeResponseModal(false);
                          setDisputeResponse('');
                          load();
                        }}]
                      );
                    } else {
                      Alert.alert('Error', result.error || 'Failed to submit response');
                    }
                  } catch (error: any) {
                    Alert.alert('Error', error.message);
                  } finally {
                    setSubmittingResponse(false);
                  }
                }}
                disabled={submittingResponse || !disputeResponse.trim()}
                style={({ pressed }) => ({
                  backgroundColor: submittingResponse || !disputeResponse.trim() ? colors.border : colors.accent,
                  padding: spacing.md,
                  borderRadius: 8,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                {submittingResponse ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#000', fontWeight: '600' }}>Submit Response</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* AI Diagnosis Assistant Modal */}
      {AI_DIAGNOSIS_ENABLED && job && (
        <DiagnosisAssistant
          visible={showDiagnosis}
          onClose={() => setShowDiagnosis(false)}
          leadId={id || ""}
          title={job.title}
          description={job.description || ""}
          vehicleInfo={
            job.vehicle
              ? {
                  year: job.vehicle.year,
                  make: job.vehicle.make,
                  model: job.vehicle.model,
                }
              : undefined
          }
          onSendMessage={(message) => {
            Alert.alert(
              "Message Ready",
              "Question copied! Go to messages to send it to the customer.",
              [
                { text: "Later", style: "cancel" },
                {
                  text: "Go to Messages",
                  onPress: () => {
                    setShowDiagnosis(false);
                    router.push(`/(mechanic)/messages/${id}` as any);
                  },
                },
              ]
            );
          }}
          onSaveNotes={async (notes) => {
            try {
              await supabase.from("lead_notes").insert({
                lead_id: id,
                content: notes,
                source: "ai_assist",
                created_at: new Date().toISOString(),
              });
              Alert.alert("Saved", "Documentation has been recorded.");
            } catch (e) {
              console.log("Note save failed:", e);
              Alert.alert("Note Saved", "Documentation has been recorded.");
            }
          }}
        />
      )}
    </View>
  );
}