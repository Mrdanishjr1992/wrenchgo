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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import { supabase } from "../../../src/lib/supabase";
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
  const { colors, text, spacing, radius, shadows, withAlpha } = useTheme();
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

  const [notes, setNotes] = useState<Array<{ id: string; note: string; created_at: string }>>([]);
  const [noteText, setNoteText] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const [customerHistory, setCustomerHistory] = useState<Array<{ id: string; title: string; status: string; created_at: string; completed_at: string | null }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
          // Error checking disputes, continue without dispute data
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


  const loadNotes = useCallback(async () => {
    if (!id) return;
    setNotesLoading(true);
    try {
      const { data, error } = await supabase
        .from("mechanic_notes")
        .select("id,note,created_at")
        .eq("job_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes((data ?? []) as Array<{ id: string; note: string; created_at: string }>);
    } catch (e: any) {
      console.error("loadNotes error", e);
    } finally {
      setNotesLoading(false);
    }
  }, [id]);

  const loadHistory = useCallback(async () => {
    if (!selectedCustomerId || !mechanicId) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("id,title,status,created_at,completed_at,vehicle_id")
        .eq("customer_id", selectedCustomerId)
        .eq("accepted_mechanic_id", mechanicId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      // Hide current job from history list
      setHistory(((data ?? []) as any[]).filter((j) => j.id !== id));
    } catch (e: any) {
      console.error("loadHistory error", e);
    } finally {
      setHistoryLoading(false);
    }
  }, [id, mechanicId, selectedCustomerId]);

  const saveNote = useCallback(async () => {
    const note = noteText.trim();
    if (!note) return;
    if (!mechanicId || !selectedCustomerId || !id) {
      Alert.alert("Missing context", "Please wait for the job to finish loading and try again.");
      return;
    }

    setSavingNote(true);
    try {
      const { error } = await supabase.from("mechanic_notes").insert({
        mechanic_id: mechanicId,
        customer_id: selectedCustomerId,
        vehicle_id: job?.vehicle_id ?? null,
        job_id: id,
        note,
      });
      if (error) throw error;
      setNoteText("");
      await loadNotes();
    } catch (e: any) {
      console.error("saveNote error", e);
      Alert.alert("Could not save note", e?.message ?? "Unknown error");
    } finally {
      setSavingNote(false);
    }
  }, [id, job?.vehicle_id, loadNotes, mechanicId, noteText, selectedCustomerId]);

  useEffect(() => {
    if (!id || !mechanicId) return;
    void loadNotes();
    void loadHistory();
  }, [id, mechanicId, loadHistory, loadNotes]);

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
        <View style={{ alignItems: "center" }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: withAlpha(colors.primary, 0.1),
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.lg,
          }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textSecondary }}>Loading job details...</Text>
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: withAlpha(colors.error, 0.1),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.lg,
        }}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm }}>Job not found</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center", marginBottom: spacing.lg }}>
          This job may have been removed or you don't have access.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: colors.buttonText, fontWeight: "700", fontSize: 15 }}>Go Back</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{
          backgroundColor: colors.surface,
          paddingTop: insets.top,
          borderBottomLeftRadius: radius.xl,
          borderBottomRightRadius: radius.xl,
          ...shadows.sm,
        }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(mechanic)/(tabs)/jobs" as any))}
                hitSlop={12}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 15 }}>Back</Text>
              </Pressable>
            </View>

            <Text style={{
              fontSize: 26,
              fontWeight: "800",
              color: colors.textPrimary,
              marginBottom: spacing.sm,
              letterSpacing: -0.5,
            }}>
              {getDisplayTitle(job.title)}
            </Text>

            {(intake?.vehicle || job.vehicle) && (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: spacing.md,
              }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: withAlpha(colors.primary, 0.1),
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Ionicons name="car-sport" size={14} color={colors.primary} />
                </View>
                <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 14 }}>
                  {(intake?.vehicle || job.vehicle)?.year} {(intake?.vehicle || job.vehicle)?.make} {(intake?.vehicle || job.vehicle)?.model}
                </Text>
              </View>
            )}

            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: withAlpha(statusInfo.color, 0.12),
              alignSelf: "flex-start",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
            }}>
              <Ionicons name={statusInfo.icon} size={14} color={statusInfo.color} />
              <Text style={{ color: statusInfo.color, fontWeight: "700", fontSize: 12, letterSpacing: 0.3 }}>
                {statusInfo.label.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Dispute Banner */}
        {dispute && (
          <View style={{
            backgroundColor: dispute.sla_breached ? '#EF4444' : '#F59E0B',
            padding: spacing.md,
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
            borderRadius: radius.lg,
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
                  borderRadius: radius.md,
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

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          {chatUnlocked && (
            <Animated.View entering={FadeInDown.delay(100).duration(300)}>
              <Pressable
                onPress={openChat}
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: spacing.md,
                  opacity: pressed ? 0.9 : 1,
                  ...shadows.md,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: withAlpha("#000", 0.15),
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Ionicons name="chatbubbles" size={24} color={colors.buttonText} />
                  </View>
                  <View>
                    <Text style={{ fontWeight: "800", color: colors.buttonText, fontSize: 16 }}>Chat with Customer</Text>
                    <Text style={{ color: withAlpha(colors.buttonText, 0.8), fontSize: 13, marginTop: 2 }}>
                      Message your customer
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color={colors.buttonText} />
              </Pressable>
            </Animated.View>
          )}

          {job.customer_id && (
            <Animated.View entering={FadeInDown.delay(150).duration(300)}>
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginBottom: spacing.md,
                ...shadows.sm,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.sm }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: withAlpha(colors.primary, 0.1),
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Ionicons name="person-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Customer</Text>
                </View>
                <UserProfileCard
                  userId={job.customer_id}
                  variant="mini"
                  context="quote_detail"
                  onPressViewProfile={() => setSelectedCustomerId(job.customer_id)}
                />

	        <Pressable
	          onPress={() => router.push(`/(mechanic)/customer-history/${job.customer_id}`)}
	          style={{
	            marginTop: 10,
	            alignSelf: 'flex-start',
	            paddingVertical: 8,
	            paddingHorizontal: 12,
	            borderRadius: 10,
	            borderWidth: 1,
	            borderColor: colors.border,
	            backgroundColor: colors.surface,
	          }}
	        >
	          <Text style={{ color: colors.primary, fontWeight: '700' }}>View customer history & notes</Text>
	        </Pressable>
              </View>
            </Animated.View>
          )}

          {quoteRequest && (
            <Animated.View entering={FadeInDown.delay(200).duration(300)}>
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginBottom: spacing.md,
                ...shadows.sm,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.sm }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: withAlpha("#10B981", 0.1),
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Ionicons name="pricetag-outline" size={20} color="#10B981" />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Your Quote</Text>
                </View>
                <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Total Price</Text>
                  <Text style={{ fontSize: 32, fontWeight: "900", color: colors.primary, marginTop: 4 }}>
                    {money(quoteRequest.price_cents)}
                  </Text>
                  {quoteRequest.estimated_hours && (
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                      Est. {quoteRequest.estimated_hours < 1 ? `${Math.round(quoteRequest.estimated_hours * 60)} min` : `${quoteRequest.estimated_hours.toFixed(1)} hrs`}
                    </Text>
                  )}
                </View>
                {quoteRequest.notes && (
                  <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <Ionicons name="chatbubble-outline" size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>YOUR NOTE</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
                      {quoteRequest.notes.split('\n').filter(line => !line.includes('Platform fee')).join('\n')}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(250).duration(300)}>
            <Pressable
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setDetailsExpanded(!detailsExpanded);
              }}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginBottom: spacing.md,
                ...shadows.sm,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: withAlpha(colors.primary, 0.1),
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Job Details</Text>
                </View>
                <Animated.View style={detailsChevronStyle}>
                  <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
                </Animated.View>
              </View>

              {!detailsExpanded && (
                <Text style={{ color: colors.textMuted, marginTop: spacing.sm, fontSize: 14 }} numberOfLines={1}>
                  {intake?.symptom?.label || "Tap to view details"}
                </Text>
              )}

              {detailsExpanded && intake && (
                <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                  {intake.symptom?.label && (
                    <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <Ionicons name="warning-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>ISSUE</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>{intake.symptom.label}</Text>
                    </View>
                  )}

                  {intake.answers && Object.keys(intake.answers).length > 0 && (
                    <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, gap: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Ionicons name="list-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>CUSTOMER ANSWERS</Text>
                      </View>
                      {Object.entries(intake.answers).map(([key, value]) => (
                        <View key={key} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors.textMuted, flex: 1, fontSize: 14 }}>{questionMap[key] || key}</Text>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {context && (
                    <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, gap: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Ionicons name="information-circle-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>CONTEXT</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Can move vehicle</Text>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{canMoveText}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Location</Text>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{locationText}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Time preference</Text>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{timeText}</Text>
                      </View>
                      {context.mileage && (
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Mileage</Text>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{context.mileage}</Text>
                        </View>
                      )}
                      {context.additional_details && (
                        <View style={{ marginTop: 4 }}>
                          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Additional details</Text>
                          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4, lineHeight: 20 }}>{context.additional_details}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {detailsExpanded && !intake && (
                <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                  {job.vehicle && (
                    <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <Ionicons name="car-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>VEHICLE</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</Text>
                    </View>
                  )}
                  {job.preferred_time && (
                    <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>PREFERRED TIME</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>{job.preferred_time}</Text>
                    </View>
                  )}
                  {job.description && !job.description.startsWith("{") && (
                    <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <Ionicons name="document-text-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>DESCRIPTION</Text>
                      </View>
                      <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{job.description}</Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          </Animated.View>

          {job.status === "canceled" && (
            <Animated.View entering={FadeInDown.delay(300).duration(300)}>
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: "#EF4444",
                ...shadows.sm,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.sm }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: withAlpha("#EF4444", 0.1),
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: "#EF4444" }}>Canceled</Text>
                </View>

                <View style={{ backgroundColor: "#FEE2E2", borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#991B1B" }}>
                    {job.canceled_by === "customer" ? "Canceled by customer" : "Job canceled"}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                    {fmtDT(job.canceled_at || "")}
                  </Text>
                </View>

                {quoteRequest?.cancel_reason && (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Reason</Text>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, marginTop: 2 }}>
                      {quoteRequest.cancel_reason.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Text>
                  </View>
                )}

                {quoteRequest?.cancel_note && (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Customer note</Text>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, marginTop: 2 }}>{quoteRequest.cancel_note}</Text>
                  </View>
                )}

                {quoteRequest?.cancellation_fee_cents && quoteRequest.cancellation_fee_cents > 0 && (
                  <View style={{ marginTop: spacing.md, backgroundColor: withAlpha("#10B981", 0.1), borderRadius: radius.lg, padding: spacing.md }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Cancellation fee earned</Text>
                    <Text style={{ fontSize: 24, fontWeight: "900", color: "#10B981", marginTop: 4 }}>
                      ${(quoteRequest.cancellation_fee_cents / 100).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {contract && (
            <Animated.View entering={FadeInDown.delay(350).duration(300)}>
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginBottom: spacing.md,
                ...shadows.sm,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.sm }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: withAlpha(colors.primary, 0.1),
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Job Progress</Text>
                </View>
                <JobProgressTracker progress={progress} status={job.status} role="mechanic" />
              </View>
            </Animated.View>
          )}

          {/* AI Diagnose Button */}
          {AI_DIAGNOSIS_ENABLED && job.status !== "completed" && job.status !== "canceled" && (
            <Animated.View entering={FadeInDown.delay(400).duration(300)}>
              <Pressable
                onPress={() => setShowDiagnosis(true)}
                style={({ pressed }) => ({
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                  ...shadows.sm,
                })}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: withAlpha(colors.primary, 0.1),
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <Ionicons name="pulse" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>AI Diagnose</Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted }}>Get diagnostic help and suggested questions</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.primary} />
              </Pressable>
            </Animated.View>
          )}

          {contract && job.status !== "completed" && job.status !== "canceled" && (
            <Animated.View entering={FadeInDown.delay(450).duration(300)}>
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginBottom: spacing.md,
                ...shadows.sm,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.sm }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: withAlpha("#f59e0b", 0.1),
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Ionicons name="hand-left-outline" size={20} color="#f59e0b" />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Actions</Text>
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
            </Animated.View>
          )}

          {invoice && (
            <Animated.View entering={FadeInDown.delay(500).duration(300)}>
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginBottom: spacing.md,
                ...shadows.sm,
              }}>
                <Pressable
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setInvoiceExpanded(!invoiceExpanded);
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: withAlpha("#10B981", 0.1),
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <Ionicons name="receipt-outline" size={20} color="#10B981" />
                      </View>
                      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Invoice & Line Items</Text>
                    </View>
                    <Ionicons name={invoiceExpanded ? "chevron-up" : "chevron-down"} size={22} color={colors.textMuted} />
                  </View>

                  {!invoiceExpanded && (() => {
                    const laborTotal = invoice.approved_items
                      .filter(i => i.item_type !== 'platform_fee' && i.item_type !== 'parts')
                      .reduce((sum, i) => sum + i.total_cents, 0);
                    const partsTotal = invoice.approved_items
                      .filter(i => i.item_type === 'parts')
                      .reduce((sum, i) => sum + i.total_cents, 0);
                    const approvedTotal = laborTotal + partsTotal;

                    const serviceFee = Math.min(Math.round(laborTotal * 0.12), 5000);
                    const promoCredit = invoice.contract.mechanic_promo_discount_cents || 0;
                    const earnings = approvedTotal - serviceFee + promoCredit;

                    const pendingTotal = invoice.pending_items.reduce((sum, i) => sum + i.total_cents, 0);

                    return (
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
                        <Text style={{ fontSize: 14, color: colors.textMuted }}>Your earnings</Text>
                        <Text style={{ fontSize: 14, color: "#10B981", fontWeight: "900" }}>
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
                      paddingVertical: 16,
                      backgroundColor: colors.primary,
                      borderRadius: radius.lg,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 8,
                      opacity: pressed ? 0.8 : 1,
                      ...shadows.sm,
                    })}
                  >
                    <Ionicons name="add-circle" size={20} color={colors.buttonText} />
                    <Text style={{ fontWeight: "700", color: colors.buttonText, fontSize: 15 }}>Add Parts or Labor</Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}


        {/* Customer & vehicle history (with this mechanic only) */}
        <View
          style={{
            marginTop: spacing.lg,
            backgroundColor: colors.bg,
            borderRadius: radius.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={[text.h3, { marginBottom: spacing.sm }]}>History</Text>
          <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>
            Past jobs you&apos;ve completed for this customer / vehicle.
          </Text>

          {historyLoading ? (
            <View style={{ paddingVertical: spacing.md }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : historyJobs.length === 0 ? (
            <Text style={[text.small, { color: colors.textMuted }]}>No prior jobs yet.</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {historyJobs.map((j) => (
                <View
                  key={j.id}
                  style={{
                    paddingVertical: spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={[text.body, { fontWeight: "600" }]}>{j.title || "Job"}</Text>
                  <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}
                  >
                    {new Date(j.created_at).toLocaleDateString()} • {String(j.status)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Private mechanic notes */}
        <View
          style={{
            marginTop: spacing.lg,
            backgroundColor: colors.bg,
            borderRadius: radius.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={[text.h3, { marginBottom: spacing.sm }]}>Private Notes</Text>
          <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>
            Notes are only visible to you (and admins).
          </Text>

          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Add a note (parts, diagnostics, customer preferences, etc.)"
            placeholderTextColor={colors.textMuted}
            multiline
            style={{
              minHeight: 80,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.sm,
              color: colors.text,
              backgroundColor: colors.surface,
            }}
          />

          <View style={{ height: spacing.sm }} />

          <Pressable
            onPress={saveNote}
            disabled={savingNote || noteText.trim().length === 0}
            style={{
              backgroundColor:
                savingNote || noteText.trim().length === 0 ? colors.border : colors.primary,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>
              {savingNote ? "Saving…" : "Save Note"}
            </Text>
          </Pressable>

          <View style={{ height: spacing.md }} />

          {notesLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : notes.length === 0 ? (
            <Text style={[text.small, { color: colors.textMuted }]}>No notes yet.</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {notes.map((n) => (
                <View
                  key={n.id}
                  style={{
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text style={[text.body]}>{n.note}</Text>
                  <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}
                  >
                    {new Date(n.created_at).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

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
              Alert.alert("Note Saved", "Documentation has been recorded.");
            }
          }}
        />
      )}
    </View>
  );
}