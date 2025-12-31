import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard, cardPressed } from "../../../src/ui/styles";

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
  title: string;
  status: string;
  preferred_time: string | null;
  created_at: string;
  accepted_mechanic_id: string | null;
};

type JobWithQuoteSummary = Job & {
  quoteSummary: QuoteSummary;
};

type QuoteRequest = {
  id: string;
  job_id: string;
  mechanic_id: string;
  status: string;
  proposed_price_cents: number | null;
  created_at: string;
  mechanic?: {
    full_name: string | null;
  };
};

export default function CustomerJobs() {
  const router = useRouter();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<JobWithQuoteSummary[]>([]);

  const statusColor = useCallback((status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted") return colors.accent;
    if (s === "work_in_progress") return colors.accent;
    if (s === "completed") return "#10b981";
    if (s === "searching") return colors.textMuted;
    if (s === "canceled") return "#EF4444";
    return colors.textMuted;
  }, [colors]);

  const statusHint = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "searching") return "Waiting for mechanics to send quotes…";
    if (s === "accepted") return "Mechanic assigned. Next: start job.";
    if (s === "work_in_progress") return "Work in progress. You'll get updates here.";
    if (s === "completed") return "Job completed. Review details inside.";
    if (s === "canceled") return "Job was canceled by customer.";
    return "Tap to view details.";
  };

  const statusLabel = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "work_in_progress") return "IN PROGRESS";
    return (status || "unknown").toUpperCase();
  };

  const fmtShort = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const StatusPill = ({ status }: { status: string }) => {
    const c = statusColor(status);
    return (
      <View
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: `${c}22`,
          borderWidth: 1,
          borderColor: `${c}55`,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: "900", color: c }}>
          {statusLabel(status)}
        </Text>
      </View>
    );
  };

  const SectionHeader = ({ title, count }: { title: string; count: number }) => (
    <View
      style={{
        marginTop: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
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
        <Text style={{ ...text.muted, fontWeight: "900", fontSize: 12 }}>
          {count}
        </Text>
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

      const { data, error } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at,accepted_mechanic_id")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const jobsData = (data as Job[]) ?? [];

      const { data: quotesData, error: quotesError } = await supabase
        .from("quote_requests")
        .select(
          `
          id,
          job_id,
          mechanic_id,
          status,
          proposed_price_cents,
          created_at,
          mechanic:profiles!quote_requests_mechanic_id_fkey(full_name)
        `
        )
        .in(
          "job_id",
          jobsData.map((j) => j.id)
        );

      if (quotesError) throw quotesError;
      const quotes = (quotesData as QuoteRequest[]) ?? [];

      const jobsWithQuotes: JobWithQuoteSummary[] = jobsData.map((job) => {
        const jobQuotes = quotes.filter((q) => q.job_id === job.id);
        const acceptedQuote = jobQuotes.find((q) => q.status === "accepted");
        const prices = jobQuotes
          .map((q) => q.proposed_price_cents)
          .filter((p): p is number => p !== null && p !== undefined);

        const quoteSummary: QuoteSummary = {
          quoteCount: jobQuotes.length,
          minQuote: prices.length > 0 ? Math.min(...prices) : null,
          maxQuote: prices.length > 0 ? Math.max(...prices) : null,
          newestQuoteAt: jobQuotes.length > 0 ? jobQuotes[0].created_at : null,
          hasQuotes: jobQuotes.length > 0,
          acceptedQuoteId: acceptedQuote?.id ?? null,
          acceptedMechanicName: acceptedQuote?.mechanic?.full_name ?? null,
        };

        return {
          ...job,
          quoteSummary,
        };
      });

      setJobs(jobsWithQuotes);
    } catch (e: any) {
      Alert.alert("Jobs error", e?.message ?? "Failed to load jobs.");
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
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "jobs", filter: `customer_id=eq.${userId}` },
            () => load()
          )
          .subscribe();

        quotesChannel = supabase
          .channel("customer-quotes-" + userId)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "quote_requests", filter: `customer_id=eq.${userId}` },
            () => load()
          )
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
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const active = useMemo(
    () => jobs.filter((j) => (j.status || "").toLowerCase() !== "completed"),
    [jobs]
  );
  const completed = useMemo(
    () => jobs.filter((j) => (j.status || "").toLowerCase() === "completed"),
    [jobs]
  );

  const JobCard = ({ item }: { item: JobWithQuoteSummary }) => {
    const c = statusColor(item.status);
    const { quoteSummary } = item;

    const formatPrice = (cents: number) => {
      return `$${(cents / 100).toFixed(0)}`;
    };

    const formatRelativeTime = (iso: string) => {
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
        return "";
      }
    };

    const showQuotesWaiting =
      item.status.toLowerCase() === "searching" &&
      quoteSummary.hasQuotes &&
      !quoteSummary.acceptedQuoteId;

    const showAcceptedTag =
      (item.status.toLowerCase() === "accepted" || item.status.toLowerCase() === "work_in_progress") &&
      quoteSummary.acceptedQuoteId;

    return (
      <Pressable
        onPress={() => router.push(`/(customer)/job/${item.id}` as any)}
        style={({ pressed }) => [
          card,
          pressed && cardPressed,
          {
            padding: spacing.md,
            borderRadius: radius.lg,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: pressed ? colors.accent : `${c}66`,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={text.section} numberOfLines={1}>
              {item.title || "Job"}
            </Text>
            <Text style={{ ...text.muted, marginTop: 4 }} numberOfLines={1}>
              {statusHint(item.status)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Text style={text.muted}>{fmtShort(item.created_at)}</Text>
            <StatusPill status={item.status} />
          </View>
        </View>

        {showQuotesWaiting && (
          <View
            style={{
              backgroundColor: `${colors.accent}15`,
              borderWidth: 1,
              borderColor: `${colors.accent}40`,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 8,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
              💬 Quotes waiting — tap to review
            </Text>
          </View>
        )}

        {showAcceptedTag && quoteSummary.acceptedMechanicName && (
          <View
            style={{
              backgroundColor: `${colors.accent}15`,
              borderWidth: 1,
              borderColor: `${colors.accent}40`,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 8,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
              ✓ Accepted — {quoteSummary.acceptedMechanicName}
            </Text>
          </View>
        )}

        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            opacity: 0.7,
            marginTop: 2,
          }}
        />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: quoteSummary.hasQuotes ? `${colors.accent}20` : colors.surface,
                  borderWidth: 1,
                  borderColor: quoteSummary.hasQuotes ? `${colors.accent}50` : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "900",
                    color: quoteSummary.hasQuotes ? colors.accent : colors.textMuted,
                  }}
                >
                  {quoteSummary.quoteCount === 0
                    ? "No quotes yet"
                    : quoteSummary.quoteCount === 1
                    ? "1 Quote"
                    : `${quoteSummary.quoteCount} Quotes`}
                </Text>
              </View>

              {quoteSummary.hasQuotes && quoteSummary.minQuote !== null && (
                <Text style={{ fontSize: 13, fontWeight: "800", color: colors.textPrimary }}>
                  {quoteSummary.minQuote === quoteSummary.maxQuote
                    ? formatPrice(quoteSummary.minQuote)
                    : `${formatPrice(quoteSummary.minQuote)}–${formatPrice(quoteSummary.maxQuote!)}`}
                </Text>
              )}
            </View>

            {quoteSummary.hasQuotes && quoteSummary.newestQuoteAt && (
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textMuted }}>
                Newest: {formatRelativeTime(quoteSummary.newestQuoteAt)}
              </Text>
            )}
          </View>
          <Text style={{ color: colors.accent, fontWeight: "900" }}>Open →</Text>
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
        data={jobs.length === 0 ? [] : [{ key: "sections" } as any]}
        keyExtractor={(i: any) => i.key}
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={["rgba(13,148,136,0.18)", "rgba(13,148,136,0.00)"]}
              style={{
                paddingTop: spacing.lg,
                paddingBottom: spacing.md,
                paddingHorizontal: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ alignItems: "center", marginTop: spacing.sm }}>
                <View
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <Image
                    source={require("../../../assets/wrench.png")}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <Text style={text.title}>Jobs</Text>
              <Text style={{ marginTop: 6, ...text.muted }}>Track quotes, assignments, and progress.</Text>

              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <Text style={text.muted}>Active</Text>
                  <Text style={{ ...text.title, fontSize: 22 }}>{String(active.length)}</Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 6,
                  }}
                >
                  <Text style={text.muted}>Completed</Text>
                  <Text style={{ ...text.title, fontSize: 22 }}>{String(completed.length)}</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
              {jobs.length === 0 ? (
                <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                  <View style={{ width: 90, height: 90, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
                    <Image
                      source={require("../../../assets/sleeping.png")}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={text.section}>No jobs yet</Text>
                  <Text style={{ ...text.body, marginTop: 2 }}>
                    Tap <Text style={{ fontWeight: "900" }}>Request a mechanic</Text> on Home to start your first job.
                  </Text>

                  <Pressable
                    onPress={() => router.push("/(customer)/(tabs)/explore" as any)}
                    style={{
                      marginTop: spacing.sm,
                      backgroundColor: colors.accent,
                      paddingVertical: 14,
                      borderRadius: 16,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: "#000" }}>REQUEST A MECHANIC</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        }
        renderItem={() => (
          <View style={{ paddingHorizontal: spacing.md }}>
            <SectionHeader title="Active" count={active.length} />
            {active.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>Nothing active right now.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {active.map((item) => (
                  <JobCard key={item.id} item={item} />
                ))}
              </View>
            )}

            <SectionHeader title="Completed" count={completed.length} />
            {completed.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No completed jobs yet.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {completed.map((item) => (
                  <JobCard key={item.id} item={item} />
                ))}
              </View>
            )}

            <View style={{ height: spacing.lg }} />
          </View>
        )}
      />
    </View>
  );
}
