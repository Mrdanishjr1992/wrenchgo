import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";
import { notifyUser } from "../../../src/lib/notify";

type Job = {
  id: string;
  title: string;
  status: string;
  preferred_time: string | null;
  created_at: string;
  accepted_mechanic_id: string | null;
};

const statusColor = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "accepted") return colors.accent;
  if (s === "work_in_progress") return colors.brand;
  if (s === "completed") return colors.success;
  if (s === "searching") return colors.textMuted;
  return colors.textSecondary;
};

const statusHint = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "searching") return "Waiting for mechanics to send quotes…";
  if (s === "accepted") return "Mechanic assigned. Next: start job.";
  if (s === "work_in_progress") return "Work in progress. You’ll get updates here.";
  if (s === "completed") return "Job completed. Review details inside.";
  return "Tap to view details.";
};

const StatusPill = ({ status }: { status: string }) => {
  const c = statusColor(status);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: c + "22",
        borderWidth: 1,
        borderColor: c + "55",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "900", color: c }}>
        {(status || "unknown").toUpperCase()}
      </Text>
    </View>
  );
};

export default function CustomerJobs() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userData.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at,accepted_mechanic_id")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });
        

      if (error) throw error;
      setJobs((data as Job[]) ?? []);
    } catch (e: any) {
      Alert.alert("Jobs error", e?.message ?? "Failed to load jobs.");
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
        const userId = userData.user?.id;
        if (!userId) return;

        channel = supabase
          .channel("customer-jobs-" + userId)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "jobs", filter: `customer_id=eq.${userId}` },
            () => load()
          )
          .subscribe();
      })();

      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    }, [load])
  );

  const active = useMemo(
    () => jobs.filter((j) => !["completed"].includes((j.status || "").toLowerCase())),
    [jobs]
  );
  const completed = useMemo(
    () => jobs.filter((j) => (j.status || "").toLowerCase() === "completed"),
    [jobs]
  );

  const Section = ({ title, data }: { title: string; data: Job[] }) => (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={text.section}>{title}</Text>
      {data.length === 0 ? (
        <Text style={{ marginTop: 6, ...text.muted }}>Nothing here yet.</Text>
      ) : (
        <FlatList
          style={{ marginTop: spacing.md }}
          data={data}
          keyExtractor={(j) => j.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(customer)/job/${item.id}`)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.sm,
              }}
            >
              <Text style={text.section}>{item.title}</Text>
              <StatusPill status={item.status} />

              <Text style={text.body}>Preferred: {item.preferred_time ?? "—"}</Text>
              <Text style={text.muted}>{statusHint(item.status)}</Text>

              <Text style={text.muted}>
                Created {new Date(item.created_at).toLocaleString()}
              </Text>

              <Text style={{ marginTop: spacing.sm, color: colors.accent, fontWeight: "800" }}>
                Tap to open →
              </Text>
            </Pressable>
          )}
        />
      )}
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
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <Text style={text.title}>Jobs</Text>
      <Text style={{ marginTop: 6, ...text.muted }}>
        Track quotes, assignments, and progress.
      </Text>

      {jobs.length === 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={text.section}>No jobs yet</Text>
          <Text style={{ marginTop: 6, ...text.body }}>
            Start from Home → Continue → pick mechanics → request quotes.
          </Text>
        </View>
      ) : (
        <FlatList
          data={[{ key: "sections" }]}
          keyExtractor={(i: any) => i.key}
          renderItem={() => (
            <View>
              <Section title="Active" data={active} />
              <Section title="Completed" data={completed} />
            </View>
          )}
        />
      )}
    </View>
  );
}
