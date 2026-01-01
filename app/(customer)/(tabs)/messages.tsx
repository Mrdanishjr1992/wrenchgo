import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard, cardPressed } from "../../../src/ui/styles";

type JobThread = {
  job_id: string;
  title: string;
  updated_at: string;
  last_message: string | null;
};

type JobRow = {
  id: string;
  title: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type QuoteRequestRow = {
  job_id: string;
  status: string | null;
  accepted_at: string | null;
  created_at: string | null;
};

type MessageRow = {
  job_id: string;
  content: string | null;
  created_at: string | null;
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function fmtTimeLong(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function Messages() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jobThreads, setJobThreads] = useState<JobThread[]>([]);
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

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

      // 1) Find jobs that have an ACCEPTED quote request (chat unlocked rule)
      const { data: acceptedQuotes, error: qErr } = await supabase
        .from("quote_requests")
        .select("job_id,status,accepted_at,created_at")
        .eq("customer_id", userId)
        .eq("status", "accepted")
        .order("accepted_at", { ascending: false });

      if (qErr) throw qErr;

      const accepted = (acceptedQuotes as QuoteRequestRow[]) ?? [];
      const jobIds = Array.from(new Set(accepted.map((q) => q.job_id))).filter(Boolean);

      if (jobIds.length === 0) {
        setJobThreads([]);
        return;
      }

      // 2) Load jobs for titles + timestamps
      const { data: jobs, error: jErr } = await supabase
        .from("jobs")
        .select("id,title,updated_at,created_at")
        .in("id", jobIds);

      if (jErr) throw jErr;

      const jobMap = new Map<string, JobRow>();
      ((jobs as JobRow[]) ?? []).forEach((j) => jobMap.set(j.id, j));

      // 3) Load last message per job (messages.content)
      const { data: msgs, error: mErr } = await supabase
        .from("messages")
        .select("job_id, content, created_at")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });

      if (mErr) throw mErr;

      const lastByJob = new Map<string, { content: string | null; created_at: string }>();
      for (const m of ((msgs as MessageRow[]) ?? [])) {
        const jid = m.job_id;
        if (!jid) continue;
        if (!lastByJob.has(jid)) {
          lastByJob.set(jid, {
            content: m.content ?? null,
            created_at: m.created_at ?? new Date().toISOString(),
          });
        }
      }

      // 4) Merge + sort by most recent activity
      const merged: JobThread[] = jobIds
        .map((jobId) => {
          const job = jobMap.get(jobId);
          const jobTitle = job?.title?.trim() ? job.title : "Job";
          const jobTime = job?.updated_at ?? job?.created_at ?? new Date().toISOString();

          const last = lastByJob.get(jobId);
          return {
            job_id: jobId,
            title: jobTitle,
            last_message: last?.content ?? "Chat unlocked — say hi 👋",
            updated_at: last?.created_at ?? jobTime,
          };
        })
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));

      setJobThreads(merged);
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : "Failed to load.";
      Alert.alert("Messages error", errorMessage);
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

  const subtitle = useMemo(() => {
    if (loading) return "Loading your chats…";
    if (jobThreads.length === 0) return "Chats appear after a quote is accepted.";
    return `${jobThreads.length} chat${jobThreads.length === 1 ? "" : "s"} • Tap one to open`;
  }, [loading, jobThreads.length]);

  const keyExtractor = useCallback((t: JobThread) => t.job_id, []);

  const ItemSeparator = useCallback(() => <View style={{ height: spacing.md }} />, [spacing.md]);

  const renderItem = useCallback(
    ({ item }: { item: JobThread }) => (
      <Pressable
        onPress={() => router.push(`/(customer)/messages/${item.job_id}` as any)}
        style={({ pressed }) => [
          card,
          pressed && cardPressed,
          {
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: radius.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.accent,
                  opacity: 0.9,
                }}
              />
              <Text style={text.section} numberOfLines={1}>
                {item.title}
              </Text>
            </View>

            <Text style={text.muted} numberOfLines={1}>
              {item.last_message ?? "—"}
            </Text>

            <Text style={[text.muted, { fontSize: 12 }]}>{fmtTimeLong(item.updated_at)}</Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={text.muted}>{fmtTime(item.updated_at)}</Text>
            <Text style={{ marginTop: 6, color: colors.accent, fontWeight: "900" }}>Open →</Text>
          </View>
        </View>
      </Pressable>
    ),
    [router, colors, text, card, radius.sm]
  );

  const ListHeaderComponent = useMemo(
    () => (
      <View style={{ paddingTop: 2 }}>
        {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} /> : null}

        {empty ? (
          <View style={[card, { padding: spacing.lg, gap: spacing.sm }]}>
            <Text style={text.section}>No chats yet</Text>
            <Text style={text.muted}>
              Accept a quote on a job to unlock messaging, then you&apos;ll see it here.
            </Text>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Pressable
                onPress={() => router.push("/(customer)/(tabs)/jobs" as any)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: colors.accent,
                    paddingVertical: 12,
                    borderRadius: radius.sm,
                    alignItems: "center",
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>GO TO JOBS</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/(customer)/(tabs)/explore" as any)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 12,
                    borderRadius: radius.sm,
                    alignItems: "center",
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Text style={{ fontWeight: "900", color: colors.textPrimary }}>FIND MECHANICS</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={{ height: spacing.md }} />
      </View>
    ),
    [loading, empty, colors, text, spacing, router, card, radius.sm]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Image
              source={require("../../../assets/mail.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={text.title}>Messages</Text>
            <Text style={[text.muted, { marginTop: 4 }]}>{subtitle}</Text>
          </View>

          <Pressable
            onPress={load}
            disabled={loading}
            hitSlop={12}
            style={({ pressed }) => [
              {
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: loading ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={{ fontWeight: "900", color: colors.textPrimary }}>{loading ? "…" : "Refresh"}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 200 }}
        data={jobThreads}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={renderItem}
      />
    </View>
  );
}
