import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { getDisplayTitle } from "../../../src/lib/format-symptom";
import { Ionicons } from "@expo/vector-icons";
import { getPendingReviewPrompts, ReviewPrompt } from "../../../src/lib/reviews";
import ReviewPromptBanner from "../../../components/reviews/ReviewPromptBanner";
import { FinancialSummary } from "../../../components/financials";
import { WalkthroughTarget, WALKTHROUGH_TARGET_IDS } from "../../../src/onboarding";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.75;

type QuoteSummary = {
  quoteCount: number;
  minQuote: number | null;
  maxQuote: number | null;
  newestQuoteAt: string | null;
  hasQuotes: boolean;
  acceptedQuoteId: string | null;
  acceptedMechanicName: string | null;
};

type Job = {
  id: string;
  title: string | null;
  status: string | null;
  preferred_time: string | null;
  created_at: string;
  accepted_mechanic_id: string | null;
  vehicle?: {
    year: number;
    make: string;
    model: string;
  } | null | Array<{
    year: number;
    make: string;
    model: string;
  }>;
};

type JobWithQuoteSummary = Job & { quoteSummary: QuoteSummary };

type ProfileName = { id: string; full_name: string | null };

export default function CustomerJobs() {
  const router = useRouter();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<JobWithQuoteSummary[]>([]);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [reviewPrompts, setReviewPrompts] = useState<ReviewPrompt[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showFinancials, setShowFinancials] = useState(false);

  const statusColor = useCallback(
    (status: string) => {
      const s = (status || "").toLowerCase();
      if (s === "accepted" || s === "work_in_progress") return colors.accent;
      if (s === "completed") return colors.success;
      if (s === "quoted") return colors.warning;
      if (s === "canceled") return colors.error;
      return colors.textMuted;
    },
    [colors]
  );

  const statusLabel = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "work_in_progress") return "IN PROGRESS";
    if (s === "quoted") return "QUOTED";
    if (s === "searching") return "SEARCHING";
    return (status || "unknown").toUpperCase();
  };

  const statusHint = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "searching") return "Waiting for quotes…";
    if (s === "quoted") return "Waiting for customer response";
    if (s === "accepted") return "Mechanic assigned";
    if (s === "work_in_progress") return "Work in progress";
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

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

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

      const userId = userData.user?.id;
      if (!userId) {
        setJobs([]);
        return;
      }
      setCustomerId(userId);

      const { data: jobRows, error: jobsErr } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at,accepted_mechanic_id,vehicle:vehicles(year,make,model)")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });

      if (jobsErr) throw jobsErr;

      const jobsData = ((jobRows as Job[]) ?? []).map((j) => ({
        ...j,
        title: j.title ?? "Job",
        status:
          j.accepted_mechanic_id && ["searching", "draft", "quoted"].includes(j.status ?? "")
            ? "accepted"
            : j.status ?? "searching",
        vehicle: Array.isArray(j.vehicle) && j.vehicle.length > 0 ? j.vehicle[0] : j.vehicle ?? null,
      }));

      if (jobsData.length === 0) {
        setJobs([]);
        return;
      }

      const jobIds = jobsData.map((j) => j.id);

      const { data: quoteRows, error: quotesErr } = await supabase
        .from("quotes")
        .select("id,job_id,mechanic_id,status,price_cents,created_at")
        .in("job_id", jobIds);

      if (quotesErr) throw quotesErr;

      const quotes = (quoteRows ?? []).map((q: any) => ({
        ...q,
        customer_id: userId,
        accepted_at: q.status === "accepted" ? q.created_at : null,
      }));

      const mechanicIds = Array.from(new Set(quotes.map((q: any) => q.mechanic_id).filter(Boolean)));
      const acceptedMechanicIds = Array.from(
        new Set(jobsData.map((j) => j.accepted_mechanic_id).filter((x): x is string => !!x))
      );
      const allMechanicIds = Array.from(new Set([...mechanicIds, ...acceptedMechanicIds]));

      let nameById = new Map<string, string>();
      if (allMechanicIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", allMechanicIds);

        ((profRows as ProfileName[]) ?? []).forEach((p) => {
          if (p.id) nameById.set(p.id, p.full_name?.trim() || "Mechanic");
        });
      }

      const jobsWithQuotes: JobWithQuoteSummary[] = jobsData.map((job) => {
        const jobQuotes = quotes
          .filter((q: any) => q.job_id === job.id)
          .sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at));

        const acceptedQuote = jobQuotes.find((q: any) => (q.status || "").toLowerCase() === "accepted");
        const prices = jobQuotes.map((q: any) => q.price_cents).filter((p: any) => typeof p === "number");

        const acceptedMechanicName =
          (job.accepted_mechanic_id && nameById.get(job.accepted_mechanic_id)) ||
          (acceptedQuote?.mechanic_id && nameById.get(acceptedQuote.mechanic_id)) ||
          null;

        return {
          ...job,
          quoteSummary: {
            quoteCount: jobQuotes.length,
            minQuote: prices.length ? Math.min(...prices) : null,
            maxQuote: prices.length ? Math.max(...prices) : null,
            newestQuoteAt: jobQuotes.length ? jobQuotes[0].created_at : null,
            hasQuotes: jobQuotes.length > 0,
            acceptedQuoteId: acceptedQuote?.id ?? null,
            acceptedMechanicName,
          },
        };
      });

      setJobs(jobsWithQuotes);

      const prompts = await getPendingReviewPrompts(userId);
      setReviewPrompts(prompts);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      let jobsChannel: any;
      let quotesChannel: any;

      (async () => {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;

        jobsChannel = supabase
          .channel("customer-jobs-" + userId)
          .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `customer_id=eq.${userId}` }, () => load())
          .subscribe();

        quotesChannel = supabase
          .channel("customer-quotes-" + userId)
          .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, () => load())
          .subscribe();
      })();

      return () => {
        if (jobsChannel) supabase.removeChannel(jobsChannel);
        if (quotesChannel) supabase.removeChannel(quotesChannel);
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleCancelJob = useCallback(async (jobId: string) => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this service request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setCanceling(jobId);
              const { error } = await supabase
                .from("jobs")
                .update({ status: "cancelled", canceled_at: new Date().toISOString() })
                .eq("id", jobId);

              if (error) throw error;
              await load();
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to cancel job");
            } finally {
              setCanceling(null);
            }
          },
        },
      ]
    );
  }, [load]);

  const waitingForQuote = useMemo(
    () => jobs.filter((j) => ["searching", "draft", "quoted"].includes((j.status || "").toLowerCase())),
    [jobs]
  );
  const active = useMemo(
    () => jobs.filter((j) => ["accepted", "work_in_progress", "in_progress", "scheduled"].includes((j.status || "").toLowerCase())),
    [jobs]
  );
  const completed = useMemo(
    () => jobs.filter((j) => (j.status || "").toLowerCase() === "completed"),
    [jobs]
  );

  const JobCard = ({ item, accentColor }: { item: JobWithQuoteSummary; accentColor: string }) => {
    const qs = item.quoteSummary;
    const s = (item.status || "").toLowerCase();
    const isQuoted = s === "quoted" || s === "searching" && qs.hasQuotes;
    const isSearching = s === "searching" && !qs.hasQuotes;

    return (
      <Pressable
        onPress={() => router.push(`/(customer)/job/${item.id}` as any)}
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
          <Text style={{ fontSize: 11, fontWeight: "700", color: accentColor }}>{statusLabel(item.status || "searching")}</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ ...text.muted, fontSize: 12 }}>{fmtShort(item.created_at)}</Text>
        </View>

        <Text style={{ ...text.section, fontSize: 16 }} numberOfLines={2}>{getDisplayTitle(item.title) || "Job"}</Text>
        <Text style={{ ...text.muted, fontSize: 13 }} numberOfLines={1}>{statusHint(item.status || "searching")}</Text>

        {item.vehicle && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.bg, borderRadius: 8, padding: 8 }}>
            <Ionicons name="car" size={14} color={colors.textMuted} />
            <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
              {Array.isArray(item.vehicle) ? (item.vehicle[0] ? `${item.vehicle[0].year} ${item.vehicle[0].make} ${item.vehicle[0].model}` : '') : `${item.vehicle.year} ${item.vehicle.make} ${item.vehicle.model}`}
            </Text>
          </View>
        )}

        {qs.acceptedMechanicName && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent + "10", borderRadius: 8, padding: 8 }}>
            <Ionicons name="person" size={14} color={colors.accent} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }} numberOfLines={1}>{qs.acceptedMechanicName}</Text>
          </View>
        )}

        {isQuoted && qs.minQuote !== null && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.warningBg, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 12, color: colors.warning }}>Quote</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.warning }}>{formatPrice(qs.minQuote)}</Text>
          </View>
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

        {isSearching && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleCancelJob(item.id);
            }}
            disabled={canceling === item.id}
            style={({ pressed }) => ({
              marginTop: 4,
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: pressed ? colors.error + "15" : "transparent",
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.error + "30",
              opacity: canceling === item.id ? 0.5 : 1,
            })}
          >
            <Text style={{ color: colors.error, fontWeight: "600", fontSize: 12 }}>
              {canceling === item.id ? "Canceling..." : "Cancel Request"}
            </Text>
          </Pressable>
        )}
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
      <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.CUSTOMER_OFFERS_LIST} style={{ flex: 1 }}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[colors.accent, colors.accent + "CC"]}
            style={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl, paddingHorizontal: spacing.md }}
          >
            <Text style={{ fontSize: 28, fontWeight: "900", color: colors.buttonText }}>My Jobs</Text>
            <Text style={{ fontSize: 14, color: colors.buttonText, opacity: 0.7, marginTop: 4 }}>Track your service requests</Text>

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
                <Text style={{ fontSize: 28, fontWeight: "900", color: colors.buttonText, marginTop: 4 }}>{waitingForQuote.length}</Text>
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

          {customerId && completed.length > 0 && (
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
                  <Ionicons name="card-outline" size={20} color={colors.accent} />
                  <Text style={{ ...text.body, fontWeight: "600" }}>Spending Summary</Text>
                </View>
                <Ionicons
                  name={showFinancials ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
              {showFinancials && (
                <View style={{ marginTop: spacing.sm }}>
                  <FinancialSummary userId={customerId} role="customer" />
                </View>
              )}
            </View>
          )}

          {jobs.length === 0 && (
            <View style={{ marginTop: spacing.xl, alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="car-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={{ ...text.section, marginTop: spacing.sm }}>No jobs yet</Text>
              <Text style={{ ...text.muted, textAlign: "center" }}>Request a mechanic from the Home tab to get started</Text>
              <Pressable
                onPress={() => router.push("/explore")}
                style={{ marginTop: spacing.md, backgroundColor: colors.accent, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16 }}
              >
                <Text style={{ fontWeight: "900", fontSize: 15, color: colors.buttonText }}>REQUEST A MECHANIC</Text>
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
                    userRole="customer"
                  />
                ))}
              </View>
            </>
          )}

          {jobs.length > 0 && (
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

              <SectionHeader title="Waiting for Quotes" count={waitingForQuote.length} icon="time" color={colors.warning} />
              {waitingForQuote.length === 0 ? (
                <EmptySection message="No pending quotes" />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
                >
                  {waitingForQuote.map((item) => <JobCard key={item.id} item={item} accentColor={colors.warning} />)}
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
      </WalkthroughTarget>
    </View>
  );
}
