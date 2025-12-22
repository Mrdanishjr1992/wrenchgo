import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";

type Job = {
  id: string;
  title: string;
  status: string;
  preferred_time: string | null;
  created_at: string;
};

const statusColor = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "accepted") return colors.accent;
  if (s === "work_in_progress") return colors.brand;
  if (s === "completed") return colors.success;
  return colors.textSecondary;
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

export default function MechanicJobs() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const mechanicId = userData.user?.id;
      if (!mechanicId) return;

      const { data, error } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at")
        .eq("accepted_mechanic_id", mechanicId)
        .in("status", ["accepted", "work_in_progress", "completed"])
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
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <Text style={text.title}>My Jobs</Text>
      <Text style={{ marginTop: 6, ...text.muted }}>
        Jobs you’ve been assigned after customers accept your quote.
      </Text>

      {loading ? (
        <View style={{ marginTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ marginTop: 10, ...text.muted }}>Loading…</Text>
        </View>
      ) : jobs.length === 0 ? (
        <View style={{ marginTop: 18 }}>
          <Text style={text.section}>No assigned jobs yet</Text>
          <Text style={{ marginTop: 6, ...text.body }}>
            Once a customer accepts your quote, it will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ marginTop: spacing.lg }}
          data={jobs}
          keyExtractor={(j) => j.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(mechanic)/job/${item.id}`)}
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

              <Text style={text.body}>
                Preferred: {item.preferred_time ?? "—"}
              </Text>

              <Text style={text.muted}>
                Created {new Date(item.created_at).toLocaleString()}
              </Text>

              <Text style={{ marginTop: spacing.sm, color: colors.accent, fontWeight: "800" }}>
                Tap to open ?
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
