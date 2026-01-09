import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { useTheme } from "../../../src/ui/theme-context";
import { getDisplayTitle } from "../../../src/lib/format-symptom";
import { Ionicons } from "@expo/vector-icons";
import { getPendingReviewPrompts, ReviewPrompt, hasReviewedJob } from "../../../src/lib/reviews";
import ReviewPromptBanner from "../../../components/reviews/ReviewPromptBanner";
import { FinancialSummary } from "../../../components/financials";
import { formatCents, PAYOUT_STATUS_LABELS, PAYOUT_STATUS_COLORS } from "../../../src/lib/financials";
import { WalkthroughTarget, WALKTHROUGH_TARGET_IDS } from "../../../src/onboarding";

type Job = {
  id: string;
  title: string;
  status: string;
  preferred_time: string | null;
  created_at: string;
  customer_name: string | null;
  // Financial fields for completed jobs
  mechanic_payout_cents?: number | null;
  payout_status?: string | null;
  payment_status?: "pending" | "authorized" | "captured" | null;
  // Review status
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
      if (s === "completed") return "#10b981";
      if (s === "canceled") return "#EF4444";
      if (s === "pending" || s === "quoted" || s === "searching") return "#f59e0b";
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

  const StatusPill = ({ status }: { status: string }) => {
    const c = statusColor(status);
    return (
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: `${c}22`,
          borderWidth: 1,
          borderColor: `${c}55`,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: "900", color: c }}>{statusLabel(status)}</Text>
      </View>
    );
  };

  const SectionHeader = ({ title, count }: { title: string; count: number }) => (
    <View style={{ marginTop: spacing.lg, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={text.section}>{title}</Text>
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ ...text.muted, fontWeight: "900", fontSize: 12 }}>{count}</Text>
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

      // Load assigned jobs
      const { data, error } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at,customer_id")
        .eq("accepted_mechanic_id", mId)
        .in("status", ["accepted", "scheduled", "in_progress", "work_in_progress", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Load pending quotes to show "Waiting" jobs
      const { data: pendingQuotes, error: quotesErr } = await supabase
        .from("quotes")
        .select("id,job_id,price_cents,status,created_at")
        .eq("mechanic_id", mId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (quotesErr) throw quotesErr;

      // Get job IDs from pending quotes
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

      // Load financial data for jobs (contracts + payouts)
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

      // Check review status for completed jobs
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

      // Get pending review prompts
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

  const JobCard = ({ item }: { item: Job }) => {
    const c = statusColor(item.status);
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
            padding: spacing.md,
            borderRadius: radius.lg,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: pressed ? colors.accent : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={text.section} numberOfLines={1}>{getDisplayTitle(item.title) || "Job"}</Text>
            <Text style={{ ...text.muted, marginTop: 4 }} numberOfLines={1}>{statusHint(item.status)}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Text style={text.muted}>{fmtShort(item.created_at)}</Text>
            <StatusPill status={item.status} />
          </View>
        </View>

        {item.customer_name && (
          <View style={{ backgroundColor: `${colors.accent}15`, borderWidth: 1, borderColor: `${colors.accent}40`, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
              👤 {item.customer_name}
            </Text>
          </View>
        )}

        {/* Financial info for completed jobs */}
        {isCompleted && item.mechanic_payout_cents && (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: "#10b98115", borderWidth: 1, borderColor: "#10b98140", borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>Your Earnings</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#10b981" }}>
                {formatCents(item.mechanic_payout_cents)}
              </Text>
            </View>
            {payoutLabel && payoutColor && (
              <View style={{ backgroundColor: `${payoutColor}15`, borderWidth: 1, borderColor: `${payoutColor}40`, borderRadius: 8, padding: 10, justifyContent: "center" }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: payoutColor }}>{payoutLabel}</Text>
              </View>
            )}
          </View>
        )}

        {/* Review badge for completed jobs */}
        {isCompleted && (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {item.has_pending_review && !item.has_reviewed && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  router.push(`/(mechanic)/review/${item.id}` as any);
                }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  backgroundColor: "#f59e0b15",
                  borderWidth: 1,
                  borderColor: "#f59e0b40",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <Ionicons name="star-outline" size={16} color="#f59e0b" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#f59e0b" }}>Review Customer</Text>
              </Pressable>
            )}
            {item.has_reviewed && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#10b98115", borderRadius: 8, padding: 10 }}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#10b981" }}>Review Submitted</Text>
              </View>
            )}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/(mechanic)/payout-details/${item.id}` as any);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 10,
              }}
            >
              <Ionicons name="receipt-outline" size={16} color={colors.accent} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }}>Details</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={text.body}>
            {item.preferred_time ? `Preferred: ${item.preferred_time}` : "No time preference"}
          </Text>
          <Text style={{ color: colors.accent, fontWeight: "900" }}>Open →</Text>
        </View>
      </Pressable>
    );
  };

  const WaitingJobCard = ({ item }: { item: WaitingJob }) => {
    const priceText = item.quotePriceCents
      ? `$${(item.quotePriceCents / 100).toFixed(0)}`
      : "TBD";

    return (
      <Pressable
        onPress={() => router.push(`/(mechanic)/quote-sent/${item.id}` as any)}
        style={({ pressed }) => [
          card,
          pressed && cardPressed,
          {
            padding: spacing.md,
            borderRadius: radius.lg,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: pressed ? "#f59e0b" : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={text.section} numberOfLines={1}>{getDisplayTitle(item.title) || "Job"}</Text>
            <Text style={{ ...text.muted, marginTop: 4 }} numberOfLines={1}>Waiting for customer response</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Text style={text.muted}>{fmtShort(item.created_at)}</Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: "#f59e0b22",
                borderWidth: 1,
                borderColor: "#f59e0b55",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "900", color: "#f59e0b" }}>QUOTE SENT</Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {item.customer_name && (
            <View style={{ flex: 1, backgroundColor: `${colors.accent}15`, borderWidth: 1, borderColor: `${colors.accent}40`, borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
                👤 {item.customer_name}
              </Text>
            </View>
          )}
          <View style={{ backgroundColor: "#f59e0b15", borderWidth: 1, borderColor: "#f59e0b40", borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#f59e0b" }}>
              💰 {priceText}
            </Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={text.body}>
            {item.preferred_time ? `Preferred: ${item.preferred_time}` : "No time preference"}
          </Text>
          <Text style={{ color: "#f59e0b", fontWeight: "900" }}>View Quote →</Text>
        </View>
      </Pressable>
    );
  };

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
      <FlatList
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        data={(jobs.length === 0 && waitingJobs.length === 0) ? [] : [{ key: "sections" } as any]}
        keyExtractor={(i: any) => i.key}
        ListHeaderComponent={
          <View style={{ padding: spacing.md, paddingTop: spacing.xl }}>
            <Text style={text.title}>My Jobs</Text>
            <Text style={{ ...text.muted, marginTop: 4 }}>Jobs assigned to you</Text>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: colors.accent + "40" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Active</Text>
                <Text style={{ ...text.title, fontSize: 22, color: colors.accent }}>{active.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: "#f59e0b40" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Waiting</Text>
                <Text style={{ ...text.title, fontSize: 22, color: "#f59e0b" }}>{waitingJobs.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: "#10b98140" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Completed</Text>
                <Text style={{ ...text.title, fontSize: 22, color: "#10b981" }}>{completed.length}</Text>
              </View>
            </View>

            {/* Financial Summary Toggle */}
            {mechanicId && completed.length > 0 && (
              <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.MECHANIC_EARNINGS_TAB}>
                <View style={{ marginTop: spacing.md }}>
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
              <View style={{ marginTop: spacing.xl, alignItems: "center", gap: spacing.sm }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Ionicons name="construct-outline" size={28} color={colors.textMuted} />
                </View>
                <Text style={text.section}>No jobs yet</Text>
                <Text style={{ ...text.muted, textAlign: "center" }}>When customers accept your quotes, jobs will appear here</Text>
                <Pressable
                  onPress={() => router.push("/(mechanic)/(tabs)/leads" as any)}
                  style={{ marginTop: spacing.sm, backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14 }}
                >
                  <Text style={{ fontWeight: "900", color: "#000" }}>VIEW LEADS</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        renderItem={() => (
          <View style={{ paddingHorizontal: spacing.md }}>
            {reviewPrompts.length > 0 && (
              <>
                <SectionHeader title="Pending Reviews" count={reviewPrompts.length} />
                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
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

            {/* Waiting Section - Quotes sent, waiting for customer */}
            <SectionHeader title="Waiting" count={waitingJobs.length} />
            {waitingJobs.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No pending quotes.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {waitingJobs.map((item) => <WaitingJobCard key={item.quoteId || item.id} item={item} />)}
              </View>
            )}

            <SectionHeader title="Active" count={active.length} />
            {active.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No active jobs right now.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {active.map((item) => <JobCard key={item.id} item={item} />)}
              </View>
            )}

            <SectionHeader title="Completed" count={completed.length} />
            {completed.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No completed jobs yet.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {completed.map((item) => <JobCard key={item.id} item={item} />)}
              </View>
            )}

            <View style={{ height: spacing.lg }} />
          </View>
        )}
      />
    </View>
  );
}
