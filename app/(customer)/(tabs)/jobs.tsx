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
  minQuote: number | null; // cents
  maxQuote: number | null; // cents
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
};

type JobWithQuoteSummary = Job & {
  quoteSummary: QuoteSummary;
};

type QuoteRequest = {
  id: string;
  job_id: string;
  mechanic_id: string;
  customer_id: string;
  status: string;
  price_cents: number;
  created_at: string;
  accepted_at: string | null;
};

type ProfileName = {
  id: string;
  full_name: string | null;
};

function safeIso(iso?: string | null) {
  return iso ?? new Date().toISOString();
}

export default function CustomerJobs() {
  const router = useRouter();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<JobWithQuoteSummary[]>([]);

  const statusColor = useCallback(
    (status: string) => {
      const s = (status || "").toLowerCase();
      if (s === "accepted") return colors.accent;
      if (s === "work_in_progress") return colors.accent;
      if (s === "completed") return "#10b981";
      if (s === "searching") return colors.textMuted;
      if (s === "quoted") return "#f59e0b";
      if (s === "canceled") return "#EF4444";
      return colors.textMuted;
    },
    [colors]
  );

  const statusHint = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "searching") return "Waiting for mechanics to send quotes…";
    if (s === "quoted") return "You have quotes waiting! Tap to review.";
    if (s === "accepted") return "Mechanic assigned. Next: start job.";
    if (s === "work_in_progress") return "Work in progress. You'll get updates here.";
    if (s === "completed") return "Job completed. Review details inside.";
    if (s === "canceled") return "Job was canceled.";
    return "Tap to view details.";
  };

  const statusLabel = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "work_in_progress") return "IN PROGRESS";
    if (s === "quoted") return "QUOTED";
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

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

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

      const userId = userData.user?.id;
      if (!userId) {
        setJobs([]);
        return;
      }

      // 1) Load jobs
      const { data: jobRows, error: jobsErr } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at,accepted_mechanic_id")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });

      if (jobsErr) throw jobsErr;

      const jobsData = ((jobRows as Job[]) ?? []).map((j) => ({
        ...j,
        title: j.title ?? "Job",
        // Derive status: if accepted_mechanic_id is set but status is still 'searching', show 'accepted'
        status: j.accepted_mechanic_id && (j.status === 'searching' || j.status === 'draft' || j.status === 'quoted')
          ? 'accepted'
          : j.status ?? "searching",
      }));

      if (jobsData.length === 0) {
        setJobs([]);
        return;
      }

      const jobIds = jobsData.map((j) => j.id);

      // 2) Load quotes
      const { data: quoteRows, error: quotesErr } = await supabase
        .from("quotes")
        .select("id,job_id,mechanic_id,status,price_cents,created_at")
        .in("job_id", jobIds);

      if (quotesErr) throw quotesErr;

      const quotes = (quoteRows ?? []).map((q: any) => ({
        ...q,
        customer_id: userId,
        accepted_at: q.status === 'accepted' ? q.created_at : null,
      })) as QuoteRequest[];

      // 3) Load mechanic names from profiles by id
      const mechanicIds = Array.from(new Set(quotes.map((q) => q.mechanic_id).filter(Boolean)));
      const acceptedMechanicIds = Array.from(
        new Set(jobsData.map((j) => j.accepted_mechanic_id).filter((x): x is string => !!x))
      );

      const allMechanicIds = Array.from(new Set([...mechanicIds, ...acceptedMechanicIds]));

      let nameById = new Map<string, string>();
      if (allMechanicIds.length > 0) {
        const { data: profRows, error: profErr } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", allMechanicIds);

        if (profErr) throw profErr;

        ((profRows as ProfileName[]) ?? []).forEach((p) => {
          if (p.id) nameById.set(p.id, p.full_name?.trim() || "Mechanic");
        });
      }

      // 4) Build summaries
      const jobsWithQuotes: JobWithQuoteSummary[] = jobsData.map((job) => {
        const jobQuotes = quotes
          .filter((q) => q.job_id === job.id)
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

        const acceptedQuote = jobQuotes.find((q) => (q.status || "").toLowerCase() === "accepted");
        const prices = jobQuotes.map((q) => q.price_cents).filter((p) => typeof p === "number");

        const acceptedMechanicName =
          (job.accepted_mechanic_id && nameById.get(job.accepted_mechanic_id)) ||
          (acceptedQuote?.mechanic_id && nameById.get(acceptedQuote.mechanic_id)) ||
          null;

        const quoteSummary: QuoteSummary = {
          quoteCount: jobQuotes.length,
          minQuote: prices.length ? Math.min(...prices) : null,
          maxQuote: prices.length ? Math.max(...prices) : null,
          newestQuoteAt: jobQuotes.length ? jobQuotes[0].created_at : null,
          hasQuotes: jobQuotes.length > 0,
          acceptedQuoteId: acceptedQuote?.id ?? null,
          acceptedMechanicName,
        };

        return { ...job, quoteSummary };
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
            { event: "*", schema: "public", table: "quotes" },
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

  // 3 categories: Waiting for Quote (searching), Active (accepted/in_progress), Completed
  const waitingForQuote = useMemo(
    () => jobs.filter((j) => {
      const s = (j.status || "").toLowerCase();
      return s === "searching" || s === "draft" || s === "quoted";
    }),
    [jobs]
  );
  const active = useMemo(
    () => jobs.filter((j) => {
      const s = (j.status || "").toLowerCase();
      return s === "accepted" || s === "work_in_progress" || s === "in_progress" || s === "scheduled";
    }),
    [jobs]
  );
  const completed = useMemo(
    () => jobs.filter((j) => (j.status || "").toLowerCase() === "completed"),
    [jobs]
  );

  const JobCard = ({ item }: { item: JobWithQuoteSummary }) => {
    const c = statusColor(item.status || "searching");
    const qs = item.quoteSummary;

    const showQuotesWaiting =
      (item.status || "").toLowerCase() === "searching" && qs.hasQuotes && !qs.acceptedQuoteId;

    const showAcceptedTag =
      (item.status || "").toLowerCase() === "accepted" ||
      (item.status || "").toLowerCase() === "work_in_progress";

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
              {statusHint(item.status || "searching")}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Text style={text.muted}>{fmtShort(item.created_at)}</Text>
            <StatusPill status={item.status || "searching"} />
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

        {showAcceptedTag && qs.acceptedMechanicName && (
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
              ✓ Assigned — {qs.acceptedMechanicName}
            </Text>
          </View>
        )}

        <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.7, marginTop: 2 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: qs.hasQuotes ? `${colors.accent}20` : colors.surface,
                  borderWidth: 1,
                  borderColor: qs.hasQuotes ? `${colors.accent}50` : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "900",
                    color: qs.hasQuotes ? colors.accent : colors.textMuted,
                  }}
                >
                  {qs.quoteCount === 0 ? "No quotes yet" : qs.quoteCount === 1 ? "1 Quote" : `${qs.quoteCount} Quotes`}
                </Text>
              </View>

              {qs.hasQuotes && qs.minQuote !== null && (
                <Text style={{ fontSize: 13, fontWeight: "800", color: colors.textPrimary }}>
                  {qs.minQuote === qs.maxQuote
                    ? formatPrice(qs.minQuote)
                    : `${formatPrice(qs.minQuote)}–${formatPrice(qs.maxQuote!)}`}
                </Text>
              )}
            </View>

            {qs.hasQuotes && qs.newestQuoteAt && (
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textMuted }}>
                Newest: {formatRelativeTime(qs.newestQuoteAt)}
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

              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: spacing.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 4,
                  }}
                >
                  <Text style={{ ...text.muted, fontSize: 11 }}>Waiting</Text>
                  <Text style={{ ...text.title, fontSize: 20 }}>{String(waitingForQuote.length)}</Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: spacing.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 4,
                  }}
                >
                  <Text style={{ ...text.muted, fontSize: 11 }}>Active</Text>
                  <Text style={{ ...text.title, fontSize: 20 }}>{String(active.length)}</Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: spacing.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 4,
                  }}
                >
                  <Text style={{ ...text.muted, fontSize: 11 }}>Done</Text>
                  <Text style={{ ...text.title, fontSize: 20 }}>{String(completed.length)}</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
              {jobs.length === 0 ? (
                <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                  <View style={{ width: 90, height: 90, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
                    <Image source={require("../../../assets/sleeping.png")} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
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
            <SectionHeader title="Waiting for Quote" count={waitingForQuote.length} />
            {waitingForQuote.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No jobs waiting for quotes.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {waitingForQuote.map((item) => (
                  <JobCard key={item.id} item={item} />
                ))}
              </View>
            )}

            <SectionHeader title="Active" count={active.length} />
            {active.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No active jobs right now.</Text>
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
