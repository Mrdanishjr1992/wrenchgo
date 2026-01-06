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
import { Ionicons } from "@expo/vector-icons";

type Job = {
  id: string;
  title: string;
  status: string;
  preferred_time: string | null;
  created_at: string;
  customer_name: string | null;
};

export default function MechanicJobs() {
  const router = useRouter();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);

  const statusColor = useCallback(
    (status: string) => {
      const s = (status || "").toLowerCase();
      if (s === "accepted" || s === "work_in_progress") return colors.accent;
      if (s === "completed") return "#10b981";
      if (s === "canceled") return "#EF4444";
      return colors.textMuted;
    },
    [colors]
  );

  const statusLabel = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted") return "ASSIGNED";
    if (s === "work_in_progress") return "IN PROGRESS";
    if (s === "completed") return "COMPLETED";
    return (status || "unknown").toUpperCase();
  };

  const statusHint = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted") return "Ready to start";
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

      const mechanicId = userData.user?.id;
      if (!mechanicId) {
        setJobs([]);
        return;
      }

      const { data, error } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at,customer_id")
        .eq("accepted_mechanic_id", mechanicId)
        .in("status", ["accepted", "work_in_progress", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const jobsData = (data ?? []) as any[];
      const customerIds = Array.from(new Set(jobsData.map((j) => j.customer_id).filter(Boolean)));

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

      setJobs(
        jobsData.map((j) => ({
          id: j.id,
          title: j.title || "Job",
          status: j.status,
          preferred_time: j.preferred_time,
          created_at: j.created_at,
          customer_name: nameById.get(j.customer_id) || null,
        }))
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load jobs.");
      setJobs([]);
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
    () => jobs.filter((j) => ["accepted", "work_in_progress"].includes((j.status || "").toLowerCase())),
    [jobs]
  );
  const completed = useMemo(
    () => jobs.filter((j) => (j.status || "").toLowerCase() === "completed"),
    [jobs]
  );

  const JobCard = ({ item }: { item: Job }) => {
    const c = statusColor(item.status);

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
            <Text style={text.section} numberOfLines={1}>{item.title || "Job"}</Text>
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
            <Text style={{ ...text.muted, marginTop: 4 }}>Jobs assigned to you</Text>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: colors.accent + "40" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Active</Text>
                <Text style={{ ...text.title, fontSize: 22, color: colors.accent }}>{active.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: "#10b98140" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Completed</Text>
                <Text style={{ ...text.title, fontSize: 22, color: "#10b981" }}>{completed.length}</Text>
              </View>
            </View>

            {jobs.length === 0 && (
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
