import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { getDisplayTitle } from "../../../src/lib/format-symptom";
import { Ionicons } from "@expo/vector-icons";

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
};

type JobWithQuoteSummary = Job & { quoteSummary: QuoteSummary };

type ProfileName = { id: string; full_name: string | null };

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
      if (s === "accepted" || s === "work_in_progress") return colors.accent;
      if (s === "completed") return "#10b981";
      if (s === "quoted") return "#f59e0b";
      if (s === "canceled") return "#EF4444";
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
    if (s === "quoted") return "Quotes ready — tap to review";
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

      const { data: jobRows, error: jobsErr } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at,accepted_mechanic_id")
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

  const JobCard = ({ item }: { item: JobWithQuoteSummary }) => {
    const c = statusColor(item.status || "searching");
    const qs = item.quoteSummary;
    const s = (item.status || "").toLowerCase();

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
            borderColor: pressed ? colors.accent : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={text.section} numberOfLines={1}>{getDisplayTitle(item.title) || "Job"}</Text>
            <Text style={{ ...text.muted, marginTop: 4 }} numberOfLines={1}>{statusHint(item.status || "searching")}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Text style={text.muted}>{fmtShort(item.created_at)}</Text>
            <StatusPill status={item.status || "searching"} />
          </View>
        </View>

        {s === "searching" && qs.hasQuotes && (
          <View style={{ backgroundColor: `${colors.accent}15`, borderWidth: 1, borderColor: `${colors.accent}40`, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
              💬 {qs.quoteCount} quote{qs.quoteCount > 1 ? "s" : ""} waiting
              {qs.minQuote !== null && ` — ${qs.minQuote === qs.maxQuote ? formatPrice(qs.minQuote) : `${formatPrice(qs.minQuote)}–${formatPrice(qs.maxQuote!)}`}`}
            </Text>
          </View>
        )}

        {(s === "accepted" || s === "work_in_progress") && qs.acceptedMechanicName && (
          <View style={{ backgroundColor: `${colors.accent}15`, borderWidth: 1, borderColor: `${colors.accent}40`, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
              ✓ {qs.acceptedMechanicName}
            </Text>
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
          <View style={{ padding: spacing.md, paddingTop: spacing.xl }}>
            <Text style={text.title}>My Jobs</Text>
            <Text style={{ ...text.muted, marginTop: 4 }}>Track your service requests and progress</Text>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Waiting</Text>
                <Text style={{ ...text.title, fontSize: 22, color: colors.textMuted }}>{waitingForQuote.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: colors.accent + "40" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Active</Text>
                <Text style={{ ...text.title, fontSize: 22, color: colors.accent }}>{active.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: "#10b98140" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Done</Text>
                <Text style={{ ...text.title, fontSize: 22, color: "#10b981" }}>{completed.length}</Text>
              </View>
            </View>

            {jobs.length === 0 && (
              <View style={{ marginTop: spacing.xl, alignItems: "center", gap: spacing.sm }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Ionicons name="car-outline" size={28} color={colors.textMuted} />
                </View>
                <Text style={text.section}>No jobs yet</Text>
                <Text style={{ ...text.muted, textAlign: "center" }}>Request a mechanic from the Home tab to get started</Text>
                <Pressable
                  onPress={() => router.push("/(customer)/(tabs)/explore" as any)}
                  style={{ marginTop: spacing.sm, backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14 }}
                >
                  <Text style={{ fontWeight: "900", color: "#000" }}>REQUEST A MECHANIC</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        renderItem={() => (
          <View style={{ paddingHorizontal: spacing.md }}>
            <SectionHeader title="Waiting for Quote" count={waitingForQuote.length} />
            {waitingForQuote.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No jobs waiting for quotes.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {waitingForQuote.map((item) => <JobCard key={item.id} item={item} />)}
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
