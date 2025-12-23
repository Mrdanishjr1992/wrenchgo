import React, { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";
import { card } from "../../../src/ui/styles";

type JobThread = {
  job_id: string;
  title: string;
  updated_at: string;
  last_message: string | null;
};

const fmtTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

export default function Messages() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jobThreads, setJobThreads] = useState<JobThread[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const userId = userData.user?.id;
      if (!userId) {
        setJobThreads([]);
        return;
      }

      // 1) Jobs for this customer that have an accepted mechanic (chat unlocked)
      const { data: jobs, error: jErr } = await supabase
        .from("jobs")
        .select("id,title,updated_at,created_at,accepted_mechanic_id")
        .eq("customer_id", userId)
        .not("accepted_mechanic_id", "is", null)
        .order("updated_at", { ascending: false });

      if (jErr) throw jErr;

      const jobList = (jobs ?? []).map((j: any) => ({
        id: j.id as string,
        title: (j.title as string) ?? "Job",
        updated_at: (j.updated_at as string) ?? (j.created_at as string) ?? new Date().toISOString(),
      }));

      if (jobList.length === 0) {
        setJobThreads([]);
        return;
      }

      // 2) Pull latest messages for those job_ids (we’ll compute last per job)
      const jobIds = jobList.map((j) => j.id);

      const { data: msgs, error: mErr } = await supabase
        .from("messages")
        .select("job_id, body, created_at")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });

      if (mErr) throw mErr;

      const lastByJob = new Map<string, { body: string | null; created_at: string }>();
      for (const m of msgs ?? []) {
        const jid = m.job_id as string;
        if (!lastByJob.has(jid)) {
          lastByJob.set(jid, {
            body: (m.body as string) ?? null,
            created_at: (m.created_at as string) ?? new Date().toISOString(),
          });
        }
      }

      const merged: JobThread[] = jobList.map((j) => {
        const last = lastByJob.get(j.id);
        return {
          job_id: j.id,
          title: j.title,
          last_message: last?.body ?? "Chat unlocked — say hi 👋",
          updated_at: last?.created_at ?? j.updated_at,
        };
      });

      merged.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
      setJobThreads(merged);
    } catch (e: any) {
      Alert.alert("Messages error", e?.message ?? "Failed to load.");
      setJobThreads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const empty = useMemo(() => !loading && jobThreads.length === 0, [loading, jobThreads.length]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        data={jobThreads}
        keyExtractor={(t) => t.job_id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={{ paddingTop: 6 }}>
            <Text style={text.title}>Messages</Text>
            <Text style={{ ...text.muted, marginTop: 4 }}>
              Chats appear after a quote is accepted.
            </Text>

            {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} /> : null}

            {empty ? (
              <View style={[card, { padding: spacing.md, marginTop: spacing.lg }]}>
                <Text style={text.section}>No chats yet</Text>
                <Text style={{ ...text.muted, marginTop: 6 }}>
                  Accept a quote on a job to unlock messaging.
                </Text>
                <Pressable
                  onPress={() => router.push("/(customer)/(tabs)/jobs" as any)}
                  style={{
                    marginTop: spacing.md,
                    backgroundColor: colors.accent,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#fff" }}>GO TO JOBS</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ height: spacing.md }} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(customer)/messages/${item.job_id}` as any)}
            style={[card, { padding: spacing.md }]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={text.section}>{item.title}</Text>
                <Text style={{ ...text.muted, marginTop: 4 }} numberOfLines={1}>
                  {item.last_message ?? "—"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ ...text.muted }}>{fmtTime(item.updated_at)}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
