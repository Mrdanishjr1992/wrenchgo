import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard, cardPressed } from "../../../src/ui/styles";

type Msg = {
  id: string;
  job_id: string;
  title: string;
  customer_name: string | null;
  last_message: string | null;
  last_message_time: string;
  unread_count: number;
};

const fmtTime = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

export default function Messages() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Msg[]>([]);
  const { colors, text, spacing } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const userId = userData.user?.id;
      if (!userId) {
        setItems([]);
        return;
      }

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select(`
          id,
          title,
          customer_id,
          created_at
        `)
        .eq("accepted_mechanic_id", userId)
        .in("status", ["accepted", "work_in_progress", "completed"])
        .order("created_at", { ascending: false });

      if (jobsError) throw jobsError;

      // Fetch customer profiles separately
      const customerIds = [...new Set((jobs || []).map((j: any) => j.customer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("auth_id, full_name")
        .in("auth_id", customerIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.auth_id, p.full_name])
      );

      const conversations: Msg[] = await Promise.all(
        (jobs || []).map(async (job: any) => {
          const { data: messages } = await supabase
            .from("messages")
            .select("body, created_at, sender_id")
            .eq("job_id", job.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const lastMsg = messages?.[0];

          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("job_id", job.id)
            .neq("sender_id", userId)
            .is("read_at", null);

          return {
            id: job.id,
            job_id: job.id,
            title: job.title || "Untitled Job",
            customer_name: profileMap.get(job.customer_id) || "Customer",
            last_message: lastMsg?.body || "No messages yet",
            last_message_time: lastMsg?.created_at || job.created_at,
            unread_count: count || 0,
          };
        })
      );

      setItems(conversations);
    } catch (e: any) {
      Alert.alert("Messages error", e?.message ?? "Failed to load.");
      setItems([]);
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
          .channel("messages-" + userId)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "messages" },
            () => load()
          )
          .subscribe();
      })();

      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    }, [load])
  );

  const unreadCount = useMemo(() => items.reduce((sum, item) => sum + item.unread_count, 0), [items]);

  const open = useCallback(
    async (conversation: Msg) => {
      router.push(`/(mechanic)/messages/${conversation.job_id}` as any);
    },
    [router]
  );

  const markAllRead = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      for (const conversation of items) {
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("job_id", conversation.job_id)
          .neq("sender_id", userId)
          .is("read_at", null);
      }

      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed.");
    }
  }, [items, load]);

  const Header = (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ gap: 1 }}>
          <Text style={text.title}>Messages</Text>
          <Text style={text.muted}>
            Unread{" "}
            <Text style={{ color: colors.accent, fontWeight: "900" }}>
              {unreadCount}
            </Text>
            {items.length ? ` • Total ${items.length}` : ""}
          </Text>
        </View>

        <Pressable
          onPress={markAllRead}
          disabled={unreadCount === 0}
          style={({ pressed }) => [
            card,
            pressed && cardPressed,
            {
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderColor: unreadCount === 0 ? colors.border : colors.accent,
              opacity: unreadCount === 0 ? 0.6 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "900" }}>
            Mark all read
          </Text>
        </Pressable>
      </View>

      {!loading && items.length > 0 ? (
        <View
          style={{
            backgroundColor: "rgba(13,148,136,0.10)",
            borderWidth: 1,
            borderColor: "rgba(13,148,136,0.25)",
            borderRadius: 14,
            padding: spacing.md,
            flexDirection: "row",
            gap: 1,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 18 }}>💬</Text>
          <Text style={{ ...text.body, flex: 1, opacity: 0.95 }}>
            Tap any conversation to open the chat.
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
        {Header}
        <View style={{ marginTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ marginTop: 10, ...text.muted }}>Loading...</Text>
        </View>
      </View>
    );
  }

  const empty = items.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {empty ? (
        <View style={{ padding: spacing.md, marginTop: spacing.lg }}>
          {Header}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.lg,
              gap: 8,
            }}
          >
            <Text style={text.section}>No conversations yet</Text>
            <Text style={{ ...text.muted }}>
              When you accept a job, you&apos;ll be able to chat with the customer here.
            </Text>
            <View style={{ height: 6 }} />
            <View
              style={{
                backgroundColor: "rgba(13,148,136,0.10)",
                borderColor: "rgba(13,148,136,0.25)",
                borderWidth: 1,
                borderRadius: 14,
                padding: spacing.md,
              }}
            >
              <Text style={{ ...text.body }}>
                Tip: Keep your notifications on so you don&apos;t miss new messages. 🔔
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
          ListHeaderComponent={Header}
          renderItem={({ item }) => {
            const hasUnread = item.unread_count > 0;

            return (
              
              <Pressable
                onPress={() => open(item)}
                style={({ pressed }) => [
                  card,
                  pressed && cardPressed,
                  {
                    padding: spacing.lg,
                    borderColor: hasUnread ? colors.accent : colors.border,
                    backgroundColor: hasUnread ? "rgba(13,148,136,0.06)" : colors.surface,
                    gap: 10,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: hasUnread ? "rgba(13,148,136,0.35)" : colors.border,
                      backgroundColor: colors.bg,
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>💬</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={text.section} numberOfLines={1}>
                        {item.customer_name}
                      </Text>
                      {hasUnread && (
                        <View
                          style={{
                            marginLeft: "auto",
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 999,
                            backgroundColor: colors.accent + "22",
                            borderWidth: 1,
                            borderColor: colors.accent + "55",
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "900", color: colors.accent }}>
                            {item.unread_count}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={{ ...text.muted, marginTop: 4 }} numberOfLines={2}>
                      {item.last_message ?? "No messages yet"}
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                      <Text style={{ ...text.muted, fontSize: 12 }}>
                        {fmtTime(item.last_message_time)}
                      </Text>

                      <Text style={{ marginLeft: "auto", color: colors.accent, fontWeight: "900" }}>
                        Open →
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
