import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { useTheme } from "../../../src/ui/theme-context";
import { getDisplayTitle } from "../../../src/lib/format-symptom";
import { Ionicons } from "@expo/vector-icons";
import { getPendingReviewPrompts, ReviewPrompt } from "../../../src/lib/reviews";
import ReviewPromptBanner from "../../../components/reviews/ReviewPromptBanner";
import { FinancialSummary } from "../../../components/financials";
import { formatCents, PAYOUT_STATUS_LABELS, PAYOUT_STATUS_COLORS } from "../../../src/lib/financials";
import { WalkthroughTarget, WALKTHROUGH_TARGET_IDS } from "../../../src/onboarding";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.75;

type Job = {
  id: string;
  title: string;
  status: string;
  preferred_time: string | null;
  created_at: string;
  customer_name: string | null;
  mechanic_payout_cents?: number | null;
  payout_status?: string | null;
  payment_status?: "pending" | "authorized" | "captured" | null;
  has_reviewed?: boolean;
  has_pending_review?: boolean;
};

type WaitingJob = {
  id: string;
  title: string;
  status: string;
  preferred_time: string | null;
  created_at: string;
  customer_name: string | null;
  quoteId: string;
  quotePriceCents: number | null;
  quoteStatus: string;
};

export default function MechanicJobs() {
  const router = useRouter();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [waitingJobs, setWaitingJobs] = useState<WaitingJob[]>([]);
  const [reviewPrompts, setReviewPrompts] = useState<ReviewPrompt[]>([]);
  const [mechanicId, setMechanicId] = useState<string | null>(null);
  const [showFinancials, setShowFinancials] = useState(false);

  const statusColor = useCallback(
    (status: string) => {
      const s = (status || "").toLowerCase();
      if (s === "accepted" || s === "scheduled" || s === "in_progress" || s === "work_in_progress") return colors.accent;
      if (s === "completed") return colors.success;
      if (s === "canceled") return colors.error;
      if (s === "pending" || s === "quoted" || s === "searching") return colors.warning;
      return colors.textMuted;
    },
    [colors]
  );

  const statusLabel = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted") return "ASSIGNED";
    if (s === "scheduled") return "ON THE WAY";
    if (s === "in_progress" || s === "work_in_progress") return "IN PROGRESS";
    if (s === "completed") return "COMPLETED";
    return (status || "unknown").toUpperCase();
  };

  const statusHint = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted") return "Ready to start";
    if (s === "scheduled") return "En route to location";
    if (s === "in_progress" || s === "work_in_progress") return "Work in progress";
    if (s === "completed") return "Job completed";
    if (s === "canceled") return "Canceled";
    return "Tap to view";
  };

  const fmtShort = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const SectionHeader = ({ title, count, icon, color }: { title: string; count: number; icon: keyof typeof Ionicons.glyphMap; color: string }) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color + "15", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={{ ...text.section, fontSize: 18 }}>{title}</Text>
      </View>
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: color + "15",
        }}
      >
        <Text style={{ fontWeight: "900", fontSize: 13, color }}>{count}</Text>
      </View>
    </View>
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const mId = userData.user?.id;
      if (!mId) {
        setJobs([]);
        setWaitingJobs([]);
        return;
      }
      setMechanicId(mId);

      const { data, error } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at,customer_id")
        .eq("accepted_mechanic_id", mId)
        .in("status", ["accepted", "scheduled", "in_progress", "work_in_progress", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: pendingQuotes, error: quotesErr } = await supabase
        .from("quotes")
        .select("id,job_id,price_cents,status,created_at")
        .eq("mechanic_id", mId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (quotesErr) throw quotesErr;

      const pendingJobIds = (pendingQuotes ?? []).map((q: any) => q.job_id).filter(Boolean);

      let waitingJobsData: WaitingJob[] = [];
      if (pendingJobIds.length > 0) {
        const { data: waitingJobRows } = await supabase
          .from("jobs")
          .select("id,title,status,preferred_time,created_at,customer_id")
          .in("id", pendingJobIds)
          .neq("status", "cancelled");

        if (waitingJobRows) {
          const waitingCustomerIds = Array.from(new Set((waitingJobRows as any[]).map((j) => j.customer_id).filter(Boolean)));
          let waitingNameById = new Map<string, string>();

          if (waitingCustomerIds.length > 0) {
            const { data: profRows } = await supabase
              .from("profiles")
              .select("id,full_name")
              .in("id", waitingCustomerIds);

            ((profRows ?? []) as any[]).forEach((p) => {
              if (p.id) waitingNameById.set(p.id, p.full_name?.trim() || "Customer");
            });
          }

          const quoteByJobId = new Map<string, any>();
          (pendingQuotes ?? []).forEach((q: any) => {
            quoteByJobId.set(q.job_id, q);
          });

          waitingJobsData = (waitingJobRows as any[]).map((j) => {
            const q = quoteByJobId.get(j.id);
            return {
              id: j.id,
              title: j.title || "Job",
              status: j.status,
              preferred_time: j.preferred_time,
              created_at: j.created_at,
              customer_name: waitingNameById.get(j.customer_id) || null,
              quoteId: q?.id,
              quotePriceCents: q?.price_cents,
              quoteStatus: q?.status || "pending",
            };
          });
        }
      }

      setWaitingJobs(waitingJobsData);

      const jobsData = (data ?? []) as any[];
      const customerIds = Array.from(new Set(jobsData.map((j) => j.customer_id).filter(Boolean)));
      const jobIds = jobsData.map((j) => j.id);

      let nameById = new Map<string, string>();
      if (customerIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", customerIds);

        ((profRows ?? []) as any[]).forEach((p) => {
          if (p.id) nameById.set(p.id, p.full_name?.trim() || "Customer");
        });
      }

      let contractsByJobId = new Map<string, any>();
      let payoutsByContractId = new Map<string, any>();

      if (jobIds.length > 0) {
        const { data: contracts } = await supabase
          .from("job_contracts")
          .select("job_id, mechanic_payout_cents, payment_authorized_at, payment_captured_at, id")
          .in("job_id", jobIds)
          .eq("mechanic_id", mId);

        (contracts ?? []).forEach((c: any) => {
          contractsByJobId.set(c.job_id, c);
        });

        const contractIds = (contracts ?? []).map((c: any) => c.id).filter(Boolean);
        if (contractIds.length > 0) {
          const { data: payouts } = await supabase
            .from("payouts")
            .select("contract_id, status")
            .in("contract_id", contractIds);

          (payouts ?? []).forEach((p: any) => {
            payoutsByContractId.set(p.contract_id, p);
          });
        }
      }

      const completedJobIds = jobsData.filter((j) => j.status === "completed").map((j) => j.id);
      let reviewedJobIds = new Set<string>();

      if (completedJobIds.length > 0) {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("job_id")
          .eq("reviewer_id", mId)
          .in("job_id", completedJobIds);

        (reviews ?? []).forEach((r: any) => {
          reviewedJobIds.add(r.job_id);
        });
      }

      const prompts = await getPendingReviewPrompts(mId);
      setReviewPrompts(prompts);
      const promptJobIds = new Set(prompts.map((p) => p.job_id));

      setJobs(
        jobsData.map((j) => {
          const contract = contractsByJobId.get(j.id);
          const payout = contract ? payoutsByContractId.get(contract.id) : null;

          let paymentStatus: Job["payment_status"] = null;
          if (contract) {
            if (contract.payment_captured_at) {
              paymentStatus = "captured";
            } else if (contract.payment_authorized_at) {
              paymentStatus = "authorized";
            } else {
              paymentStatus = "pending";
            }
          }

          return {
            id: j.id,
            title: j.title || "Job",
            status: j.status,
            preferred_time: j.preferred_time,
            created_at: j.created_at,
            customer_name: nameById.get(j.customer_id) || null,
            mechanic_payout_cents: contract?.mechanic_payout_cents || null,
            payout_status: payout?.status || null,
            payment_status: paymentStatus,
            has_reviewed: reviewedJobIds.has(j.id),
            has_pending_review: promptJobIds.has(j.id),
          };
        })
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load jobs.");
      setJobs([]);
      setWaitingJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      let channel: any;

      (async () => {
        const { data: userData } = await supabase.auth.getUser();
        const mechanicId = userData.user?.id;
        if (!mechanicId) return;

        channel = supabase
          .channel("mechanic-jobs-" + mechanicId)
          .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `accepted_mechanic_id=eq.${mechanicId}` }, () => load())
          .subscribe();
      })();

      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const active = useMemo(
    () => jobs.filter((j) => ["accepted", "scheduled", "in_progress", "work_in_progress"].includes((j.status || "").toLowerCase())),
    [jobs]
  );
  const completed = useMemo(
    () => jobs.filter((j) => (j.status || "").toLowerCase() === "completed"),
    [jobs]
  );

  const JobCard = ({ item, accentColor }: { item: Job; accentColor: string }) => {
    const isCompleted = item.status === "completed";
    const payoutColor = item.payout_status ? PAYOUT_STATUS_COLORS[item.payout_status] : null;
    const payoutLabel = item.payout_status ? PAYOUT_STATUS_LABELS[item.payout_status] : null;

    return (
      <Pressable
        onPress={() => router.push(`/(mechanic)/job-details/${item.id}` as any)}
        style={({ pressed }) => [
          card,
          pressed && cardPressed,
          {
            width: CARD_WIDTH,
            padding: spacing.md,
            borderRadius: radius.lg,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: pressed ? accentColor : colors.border,
            backgroundColor: colors.surface,
            marginRight: spacing.sm,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accentColor }} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: accentColor }}>{statusLabel(item.status)}</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ ...text.muted, fontSize: 12 }}>{fmtShort(item.created_at)}</Text>
        </View>

        <Text style={{ ...text.section, fontSize: 16 }} numberOfLines={2}>{getDisplayTitle(item.title) || "Job"}</Text>
        <Text style={{ ...text.muted, fontSize: 13 }} numberOfLines={1}>{statusHint(item.status)}</Text>

        {item.customer_name && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent + "10", borderRadius: 8, padding: 8 }}>
            <Ionicons name="person" size={14} color={colors.accent} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }} numberOfLines={1}>{item.customer_name}</Text>
          </View>
        )}

        {isCompleted && item.mechanic_payout_cents && (
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            <View style={{ flex: 1, backgroundColor: colors.successBg, borderRadius: 8, padding: 8 }}>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>Earnings</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.success }}>{formatCents(item.mechanic_payout_cents)}</Text>
            </View>
            {payoutLabel && payoutColor && (
              <View style={{ backgroundColor: payoutColor + "15", borderRadius: 8, padding: 8, justifyContent: "center" }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: payoutColor }}>{payoutLabel}</Text>
              </View>
            )}
          </View>
        )}

        {isCompleted && item.has_pending_review && !item.has_reviewed && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/(mechanic)/review/${item.id}` as any);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: colors.warningBg,
              borderRadius: 8,
              padding: 10,
            }}
          >
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.warning }}>Review Customer</Text>
          </Pressable>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {item.preferred_time ? item.preferred_time : "Flexible"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: accentColor }}>View</Text>
            <Ionicons name="chevron-forward" size={14} color={accentColor} />
          </View>
        </View>
      </Pressable>
    );
  };

  const WaitingJobCard = ({ item }: { item: WaitingJob }) => {
    const priceText = item.quotePriceCents ? `$${(item.quotePriceCents / 100).toFixed(0)}` : "TBD";

    return (
      <Pressable
        onPress={() => router.push(`/(mechanic)/quote-sent/${item.id}` as any)}
        style={({ pressed }) => [
          card,
          pressed && cardPressed,
          {
            width: CARD_WIDTH,
            padding: spacing.md,
            borderRadius: radius.lg,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: pressed ? colors.warning : colors.border,
            backgroundColor: colors.surface,
            marginRight: spacing.sm,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning }} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.warning }}>QUOTE SENT</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ ...text.muted, fontSize: 12 }}>{fmtShort(item.created_at)}</Text>
        </View>

        <Text style={{ ...text.section, fontSize: 16 }} numberOfLines={2}>{getDisplayTitle(item.title) || "Job"}</Text>
        <Text style={{ ...text.muted, fontSize: 13 }} numberOfLines={1}>Waiting for customer response</Text>

        {item.customer_name && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent + "10", borderRadius: 8, padding: 8 }}>
            <Ionicons name="person" size={14} color={colors.accent} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }} numberOfLines={1}>{item.customer_name}</Text>
          </View>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.warningBg, borderRadius: 8, padding: 10 }}>
          <Text style={{ fontSize: 12, color: colors.warning }}>Your Quote</Text>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.warning }}>{priceText}</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {item.preferred_time ? item.preferred_time : "Flexible"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.warning }}>View Quote</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.warning} />
          </View>
        </View>
      </Pressable>
    );
  };

  const EmptySection = ({ message }: { message: string }) => (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.lg }}>
      <Text style={{ ...text.muted, fontStyle: "italic" }}>{message}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 10, ...text.muted }}>Loading jobs…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.accent, colors.accent + "CC"]}
          style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl, paddingHorizontal: spacing.md }}
        >
          <Text style={{ fontSize: 28, fontWeight: "900", color: colors.buttonText }}>My Jobs</Text>
          <Text style={{ fontSize: 14, color: colors.buttonText, opacity: 0.7, marginTop: 4 }}>Jobs assigned to you</Text>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 16, padding: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="flash" size={14} color={colors.buttonText} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.buttonText, opacity: 0.7 }}>Active</Text>
              </View>
              <Text style={{ fontSize: 28, fontWeight: "900", color: colors.buttonText, marginTop: 4 }}>{active.length}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 16, padding: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="time" size={14} color={colors.buttonText} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.buttonText, opacity: 0.7 }}>Waiting</Text>
              </View>
              <Text style={{ fontSize: 28, fontWeight: "900", color: colors.buttonText, marginTop: 4 }}>{waitingJobs.length}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 16, padding: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="checkmark-circle" size={14} color={colors.buttonText} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.buttonText, opacity: 0.7 }}>Done</Text>
              </View>
              <Text style={{ fontSize: 28, fontWeight: "900", color: colors.buttonText, marginTop: 4 }}>{completed.length}</Text>
            </View>
          </View>
        </LinearGradient>

        {mechanicId && completed.length > 0 && (
          <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.MECHANIC_EARNINGS_TAB}>
            <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
              <Pressable
                onPress={() => setShowFinancials(!showFinancials)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Ionicons name="stats-chart-outline" size={20} color={colors.accent} />
                  <Text style={{ ...text.body, fontWeight: "600" }}>Earnings Summary</Text>
                </View>
                <Ionicons
                  name={showFinancials ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
              {showFinancials && (
                <View style={{ marginTop: spacing.sm }}>
                  <FinancialSummary userId={mechanicId} role="mechanic" />
                </View>
              )}
            </View>
          </WalkthroughTarget>
        )}

        {jobs.length === 0 && waitingJobs.length === 0 && (
          <View style={{ marginTop: spacing.xl, alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="construct-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={{ ...text.section, marginTop: spacing.sm }}>No jobs yet</Text>
            <Text style={{ ...text.muted, textAlign: "center" }}>When customers accept your quotes, jobs will appear here</Text>
            <Pressable
              onPress={() => router.push("/(mechanic)/(tabs)/leads" as any)}
              style={{ marginTop: spacing.md, backgroundColor: colors.accent, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16 }}
            >
              <Text style={{ fontWeight: "900", fontSize: 15, color: colors.buttonText }}>VIEW LEADS</Text>
            </Pressable>
          </View>
        )}

        {reviewPrompts.length > 0 && (
          <>
            <SectionHeader title="Pending Reviews" count={reviewPrompts.length} icon="star" color={colors.warning} />
            <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
              {reviewPrompts.map((prompt) => (
                <ReviewPromptBanner
                  key={prompt.id}
                  jobId={prompt.job_id}
                  targetName={prompt.target_name}
                  expiresAt={prompt.expires_at}
                  userRole="mechanic"
                />
              ))}
            </View>
          </>
        )}

        {(jobs.length > 0 || waitingJobs.length > 0) && (
          <>
            <SectionHeader title="Active" count={active.length} icon="flash" color={colors.accent} />
            {active.length === 0 ? (
              <EmptySection message="No active jobs right now" />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
              >
                {active.map((item) => <JobCard key={item.id} item={item} accentColor={colors.accent} />)}
              </ScrollView>
            )}

            <SectionHeader title="Waiting for Response" count={waitingJobs.length} icon="time" color={colors.warning} />
            {waitingJobs.length === 0 ? (
              <EmptySection message="No pending quotes" />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
              >
                {waitingJobs.map((item) => <WaitingJobCard key={item.quoteId || item.id} item={item} />)}
              </ScrollView>
            )}

            <SectionHeader title="Completed" count={completed.length} icon="checkmark-circle" color={colors.success} />
            {completed.length === 0 ? (
              <EmptySection message="No completed jobs yet" />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
              >
                {completed.map((item) => <JobCard key={item.id} item={item} accentColor={colors.success} />)}
              </ScrollView>
            )}
          </>
        )}

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
    </View>
  );
}
