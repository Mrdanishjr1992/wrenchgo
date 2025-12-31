import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Image,
  Alert,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { useTheme } from "../../../src/ui/theme-context";


type Job = {
  id: string;
  title: string;
  status: string;
  preferred_time: string | null;
  created_at: string;
};

const statusLabel = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "accepted") return "Assigned";
  if (s === "work_in_progress") return "In progress";
  if (s === "completed") return "Completed";
  return (status || "unknown").toUpperCase();
};

const statusHint = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "accepted") return "Ready to start — open the job for details.";
  if (s === "work_in_progress") return "Keep the customer updated as you work.";
  if (s === "completed") return "Job is done — review notes & wrap-up.";
  return "Tap to open job details.";
};

const fmtShort = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

export default function MechanicJobs() {
  const router = useRouter();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const statusColor = useCallback((status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted") return colors.accent;
    if (s === "work_in_progress") return colors.accent;
    if (s === "completed") return "#10b981";
    return colors.textMuted;
  }, [colors]);

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
      setErr(null);
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
        .select("id,title,status,preferred_time,created_at")
        .eq("accepted_mechanic_id", mechanicId)
        .in("status", ["accepted", "work_in_progress", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs((data as Job[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load jobs.");
      setJobs([]);
      Alert.alert("Jobs error", e?.message ?? "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

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

  const JobCard = ({ item }: { item: Job }) => {
    const c = statusColor(item.status);

    return (
      <Pressable
        onPress={() => router.push(`/(mechanic)/job/${item.id}` as any)}
        style={({ pressed }) => [
          card,
          pressed && cardPressed,
          {
            padding: spacing.md,
            borderRadius: radius.lg,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: pressed ? `${c}66` : colors.border,
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

        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            opacity: 0.7,
            marginTop: 2,
          }}
        />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={text.body}>Preferred: {item.preferred_time ?? "—"}</Text>
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
              colors={[colors.accent + "33", colors.accent + "11", colors.bg]}
              style={{
                paddingTop: spacing.xl,
                paddingBottom: spacing.lg,
                paddingHorizontal: spacing.md,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: colors.accent + "22",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  bottom: -60,
                  left: -60,
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  backgroundColor: colors.accent + "15",
                }}
              />

              <View style={{ alignItems: "center", zIndex: 1 }}>
                <View
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <Image
                    source={require("../../../assets/working.png")}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <Text style={[text.title, { marginTop: spacing.md, textAlign: "center" }]}>My Jobs</Text>
              <Text style={{ marginTop: 6, ...text.muted, textAlign: "center" }}>
                Your accepted quotes and active work, all in one place.
              </Text>

              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface + "dd",
                    borderRadius: 16,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.accent + "33",
                    gap: 6,
                  }}
                >
                  <Text style={text.muted}>Active</Text>
                  <Text style={{ ...text.title, fontSize: 28, color: colors.accent }}>{String(active.length)}</Text>
                </View>

                <LinearGradient
                  colors={["#10b98122", "#10b98111"]}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: "#10b98133",
                    gap: 6,
                  }}
                >
                  <Text style={text.muted}>Completed</Text>
                  <Text style={{ ...text.title, fontSize: 28, color: "#10b981" }}>{String(completed.length)}</Text>
                </LinearGradient>
              </View>
            </LinearGradient>

            <View style={{ padding: spacing.md, gap: spacing.sm }}>
              {err ? (
                <View
                  style={[
                    card,
                    {
                      padding: spacing.md,
                      borderColor: "rgba(239,68,68,0.35)",
                      backgroundColor: "rgba(239,68,68,0.08)",
                    },
                  ]}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "900" }}>Couldn&apos;t refresh</Text>
                  <Text style={{ marginTop: 6, ...text.body }}>{err}</Text>
                </View>
              ) : null}

              {jobs.length === 0 ? (
                <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                  <View style={{ width: 90, height: 90, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
                    <Image
                      source={require("../../../assets/sleeping.png")}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={text.section}>No assigned jobs yet</Text>
                  <Text style={{ ...text.body, marginTop: 2 }}>
                    When a customer accepts your quote, it&apos;ll appear here.
                  </Text>

                  <View
                    style={[
                      card,
                      {
                        marginTop: spacing.md,
                        padding: spacing.md,
                        borderStyle: "dashed",
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <Text style={text.muted}>Tip</Text>
                    <Text style={{ ...text.body, marginTop: 6 }}>
                      Respond fast to new quote requests to get more accepts.
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        }
        renderItem={() => (
          <View style={{ padding: spacing.md }}>
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
