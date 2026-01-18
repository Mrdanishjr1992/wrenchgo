import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
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
import { useTheme } from "../../../src/ui/theme-context";
import { getDisplayTitle } from "../../../src/lib/format-symptom";
import { Ionicons } from "@expo/vector-icons";
import { getPendingReviewPrompts, ReviewPrompt } from "../../../src/lib/reviews";
import ReviewPromptBanner from "../../../components/reviews/ReviewPromptBanner";
import { FinancialSummary } from "../../../components/financials";
import { formatCents, PAYOUT_STATUS_LABELS, PAYOUT_STATUS_COLORS } from "../../../src/lib/financials";
import { WalkthroughTarget, WALKTHROUGH_TARGET_IDS } from "../../../src/onboarding";
import { ThemedText } from "../../../src/ui/components/ThemedText";
import { ThemedCard } from "../../../src/ui/components/ThemedCard";
import { ThemedBadge } from "../../../src/ui/components/ThemedBadge";
import { Skeleton } from "../../../src/ui/components/Skeleton";
import { AppButton } from "../../../src/ui/components/AppButton";
import Animated, { FadeInDown } from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TabKey = "active" | "waiting" | "completed";

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
  const { colors, spacing, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [waitingJobs, setWaitingJobs] = useState<WaitingJob[]>([]);
  const [reviewPrompts, setReviewPrompts] = useState<ReviewPrompt[]>([]);
  const [mechanicId, setMechanicId] = useState<string | null>(null);
  const [showFinancials, setShowFinancials] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("active");

  const statusBadgeVariant = useCallback((status: string): "primary" | "success" | "warning" | "error" | "default" => {
    const s = (status || "").toLowerCase();
    if (s === "accepted" || s === "scheduled" || s === "in_progress" || s === "work_in_progress") return "primary";
    if (s === "completed") return "success";
    if (s === "canceled") return "error";
    if (s === "pending" || s === "quoted" || s === "searching") return "warning";
    return "default";
  }, []);

  const statusLabel = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted") return "Assigned";
    if (s === "scheduled") return "On the Way";
    if (s === "in_progress" || s === "work_in_progress") return "In Progress";
    if (s === "completed") return "Completed";
    return status || "Unknown";
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  };

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

  const tabs: { key: TabKey; label: string; count: number; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "active", label: "Active", count: active.length, icon: "flash" },
    { key: "waiting", label: "Waiting", count: waitingJobs.length, icon: "time" },
    { key: "completed", label: "Done", count: completed.length, icon: "checkmark-circle" },
  ];

  const JobCardSkeleton = () => (
    <ThemedCard style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <Skeleton width={80} height={20} borderRadius={radius.full} />
        <Skeleton width={60} height={14} />
      </View>
      <Skeleton width="80%" height={18} style={{ marginBottom: spacing.xs }} />
      <Skeleton width="50%" height={14} style={{ marginBottom: spacing.md }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Skeleton width={32} height={32} borderRadius={16} />
        <Skeleton width={100} height={14} />
      </View>
    </ThemedCard>
  );

  const JobCard = ({ item, index }: { item: Job; index: number }) => {
    const isCompleted = item.status === "completed";
    const payoutColor = item.payout_status ? PAYOUT_STATUS_COLORS[item.payout_status] : null;
    const payoutLabel = item.payout_status ? PAYOUT_STATUS_LABELS[item.payout_status] : null;

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
        <ThemedCard
          pressable
          onPress={() => router.push(`/(mechanic)/job-details/${item.id}` as any)}
          style={{ marginBottom: spacing.md }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
            <ThemedBadge label={statusLabel(item.status)} variant={statusBadgeVariant(item.status)} size="sm" />
            <ThemedText variant="caption" color="muted">{fmtDate(item.created_at)}</ThemedText>
          </View>

          <ThemedText variant="h4" numberOfLines={2} style={{ marginBottom: spacing.xs }}>
            {getDisplayTitle(item.title) || "Job"}
          </ThemedText>

          {item.preferred_time && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm }}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <ThemedText variant="caption" color="muted">{item.preferred_time}</ThemedText>
            </View>
          )}

          {item.customer_name && (
            <View style={{ 
              flexDirection: "row", 
              alignItems: "center", 
              gap: spacing.sm, 
              backgroundColor: colors.surface2, 
              borderRadius: radius.md, 
              padding: spacing.sm,
              marginBottom: spacing.sm 
            }}>
              <View style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 16, 
                backgroundColor: colors.primaryBg, 
                alignItems: "center", 
                justifyContent: "center" 
              }}>
                <Ionicons name="person" size={16} color={colors.primary} />
              </View>
              <ThemedText variant="body" weight="medium" numberOfLines={1}>{item.customer_name}</ThemedText>
            </View>
          )}

          {isCompleted && item.mechanic_payout_cents && (
            <View style={{ 
              flexDirection: "row", 
              gap: spacing.sm, 
              marginBottom: spacing.sm 
            }}>
              <View style={{ 
                flex: 1, 
                backgroundColor: colors.successBg, 
                borderRadius: radius.md, 
                padding: spacing.sm 
              }}>
                <ThemedText variant="caption" color="muted">Earnings</ThemedText>
                <ThemedText variant="h3" color="success">{formatCents(item.mechanic_payout_cents)}</ThemedText>
              </View>
              {payoutLabel && payoutColor && (
                <View style={{ 
                  backgroundColor: payoutColor + "15", 
                  borderRadius: radius.md, 
                  padding: spacing.sm, 
                  justifyContent: "center",
                  alignItems: "center"
                }}>
                  <ThemedText variant="caption" style={{ color: payoutColor }}>{payoutLabel}</ThemedText>
                </View>
              )}
            </View>
          )}

          {isCompleted && item.has_pending_review && !item.has_reviewed && (
            <AppButton
              label="Review Customer"
              variant="warning"
              size="sm"
              icon={<Ionicons name="star" size={14} color={colors.warning} />}
              onPress={() => router.push(`/(mechanic)/review/${item.id}` as any)}
              style={{ marginBottom: spacing.sm }}
            />
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
            <ThemedText variant="body" color="primary" weight="semibold">View Details</ThemedText>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} style={{ marginLeft: spacing.xxs }} />
          </View>
        </ThemedCard>
      </Animated.View>
    );
  };

  const WaitingJobCard = ({ item, index }: { item: WaitingJob; index: number }) => {
    const priceText = item.quotePriceCents ? `$${(item.quotePriceCents / 100).toFixed(0)}` : "TBD";

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
        <ThemedCard
          pressable
          onPress={() => router.push(`/(mechanic)/quote-sent/${item.id}` as any)}
          style={{ marginBottom: spacing.md }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
            <ThemedBadge label="Quote Sent" variant="warning" size="sm" />
            <ThemedText variant="caption" color="muted">{fmtDate(item.created_at)}</ThemedText>
          </View>

          <ThemedText variant="h4" numberOfLines={2} style={{ marginBottom: spacing.xs }}>
            {getDisplayTitle(item.title) || "Job"}
          </ThemedText>

          <ThemedText variant="caption" color="muted" style={{ marginBottom: spacing.sm }}>
            Waiting for customer response
          </ThemedText>

          {item.customer_name && (
            <View style={{ 
              flexDirection: "row", 
              alignItems: "center", 
              gap: spacing.sm, 
              backgroundColor: colors.surface2, 
              borderRadius: radius.md, 
              padding: spacing.sm,
              marginBottom: spacing.sm 
            }}>
              <View style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 16, 
                backgroundColor: colors.primaryBg, 
                alignItems: "center", 
                justifyContent: "center" 
              }}>
                <Ionicons name="person" size={16} color={colors.primary} />
              </View>
              <ThemedText variant="body" weight="medium" numberOfLines={1}>{item.customer_name}</ThemedText>
            </View>
          )}

          <View style={{ 
            flexDirection: "row", 
            alignItems: "center", 
            justifyContent: "space-between", 
            backgroundColor: colors.warningBg, 
            borderRadius: radius.md, 
            padding: spacing.md,
            marginBottom: spacing.sm
          }}>
            <ThemedText variant="body" color="warning">Your Quote</ThemedText>
            <ThemedText variant="h3" color="warning">{priceText}</ThemedText>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
            <ThemedText variant="body" color="warning" weight="semibold">View Quote</ThemedText>
            <Ionicons name="chevron-forward" size={16} color={colors.warning} style={{ marginLeft: spacing.xxs }} />
          </View>
        </ThemedCard>
      </Animated.View>
    );
  };

  const EmptyState = ({ tab }: { tab: TabKey }) => {
    const config = {
      active: {
        icon: "flash-outline" as const,
        title: "No active jobs",
        subtitle: "When customers accept your quotes, active jobs will appear here",
        action: "View Leads",
        onAction: () => router.push("/(mechanic)/(tabs)/leads" as any),
      },
      waiting: {
        icon: "time-outline" as const,
        title: "No pending quotes",
        subtitle: "Quotes you send will appear here while waiting for customer response",
        action: "Browse Leads",
        onAction: () => router.push("/(mechanic)/(tabs)/leads" as any),
      },
      completed: {
        icon: "checkmark-circle-outline" as const,
        title: "No completed jobs yet",
        subtitle: "Your completed jobs and earnings will show up here",
        action: null,
        onAction: null,
      },
    };

    const { icon, title, subtitle, action, onAction } = config[tab];

    return (
      <View style={{ alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg }}>
        <View style={{ 
          width: 80, 
          height: 80, 
          borderRadius: 40, 
          backgroundColor: colors.surface2, 
          alignItems: "center", 
          justifyContent: "center",
          marginBottom: spacing.lg
        }}>
          <Ionicons name={icon} size={36} color={colors.textMuted} />
        </View>
        <ThemedText variant="h4" style={{ marginBottom: spacing.xs, textAlign: "center" }}>{title}</ThemedText>
        <ThemedText variant="body" color="muted" style={{ textAlign: "center", marginBottom: spacing.lg }}>{subtitle}</ThemedText>
        {action && onAction && (
          <AppButton label={action} variant="primary" onPress={onAction} />
        )}
      </View>
    );
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <View style={{ padding: spacing.md }}>
          {[1, 2, 3].map((i) => <JobCardSkeleton key={i} />)}
        </View>
      );
    }

    const items = activeTab === "active" ? active : activeTab === "waiting" ? waitingJobs : completed;

    if (items.length === 0) {
      return <EmptyState tab={activeTab} />;
    }

    return (
      <View style={{ padding: spacing.md }}>
        {activeTab === "waiting"
          ? (items as WaitingJob[]).map((item, index) => <WaitingJobCard key={item.quoteId || item.id} item={item} index={index} />)
          : (items as Job[]).map((item, index) => <JobCard key={item.id} item={item} index={index} />)
        }
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark || colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl, paddingHorizontal: spacing.md }}
        >
          <ThemedText variant="h1" style={{ color: "#fff" }}>My Jobs</ThemedText>
          <ThemedText variant="body" style={{ color: "rgba(255,255,255,0.8)", marginTop: spacing.xxs }}>
            Manage your assigned work
          </ThemedText>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            {tabs.map((tab) => (
              <View 
                key={tab.key}
                style={{ 
                  flex: 1, 
                  backgroundColor: "rgba(255,255,255,0.15)", 
                  borderRadius: radius.lg, 
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.2)"
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <Ionicons name={tab.icon} size={14} color="#fff" />
                  <ThemedText variant="caption" style={{ color: "rgba(255,255,255,0.9)" }}>{tab.label}</ThemedText>
                </View>
                <ThemedText variant="h2" style={{ color: "#fff", marginTop: spacing.xxs }}>
                  {tab.key === "active" ? active.length : tab.key === "waiting" ? waitingJobs.length : completed.length}
                </ThemedText>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={{ backgroundColor: colors.bg, paddingTop: spacing.sm }}>
          <View style={{ 
            flexDirection: "row", 
            marginHorizontal: spacing.md, 
            backgroundColor: colors.surface2, 
            borderRadius: radius.lg, 
            padding: spacing.xxs 
          }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.xs,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: isActive ? colors.cardBg : "transparent",
                    ...( isActive ? shadows.sm : {}),
                  }}
                >
                  <Ionicons name={tab.icon} size={16} color={isActive ? colors.primary : colors.textMuted} />
                  <ThemedText 
                    variant="body" 
                    weight={isActive ? "semibold" : "regular"}
                    color={isActive ? "primary" : "muted"}
                  >
                    {tab.label}
                  </ThemedText>
                  {tab.count > 0 && (
                    <View style={{
                      backgroundColor: isActive ? colors.primaryBg : colors.surface,
                      paddingHorizontal: spacing.xs,
                      paddingVertical: 2,
                      borderRadius: radius.full,
                      minWidth: 20,
                      alignItems: "center"
                    }}>
                      <ThemedText variant="caption" color={isActive ? "primary" : "muted"}>{tab.count}</ThemedText>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {mechanicId && completed.length > 0 && (
          <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.MECHANIC_EARNINGS_TAB}>
            <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
              <ThemedCard
                pressable
                onPress={() => setShowFinancials(!showFinancials)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.successBg,
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Ionicons name="stats-chart" size={20} color={colors.success} />
                    </View>
                    <ThemedText variant="body" weight="semibold">Earnings Summary</ThemedText>
                  </View>
                  <Ionicons
                    name={showFinancials ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.textMuted}
                  />
                </View>
              </ThemedCard>
              {showFinancials && (
                <View style={{ marginTop: spacing.sm }}>
                  <FinancialSummary userId={mechanicId} role="mechanic" />
                </View>
              )}
            </View>
          </WalkthroughTarget>
        )}

        {reviewPrompts.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
              <Ionicons name="star" size={18} color={colors.warning} />
              <ThemedText variant="h4">Pending Reviews</ThemedText>
              <ThemedBadge label={String(reviewPrompts.length)} variant="warning" size="sm" />
            </View>
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
        )}

        {renderTabContent()}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}
