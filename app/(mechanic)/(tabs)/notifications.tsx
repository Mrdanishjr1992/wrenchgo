import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { getDisplayTitle } from "../../../src/lib/format-symptom";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
  source: "notifications_table" | "generated";
};

type TypeMeta = {
  emoji: string;
  label: string;
};

type QuoteRequestRow = {
  id: string;
  job_id: string;
  status: string | null;
  created_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  mechanic_id: string | null;
  price_cents: number | null;
};

type JobRow = {
  id: string;
  title: string | null;
  status: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type MessageRow = {
  id: string;
  job_id: string;
  content: string | null;
  created_at: string | null;
  sender_id: string | null;
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.floor((now - t) / 1000));

  if (s < 60) return "Just now";

  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;

  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;

  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function typeMeta(type: string): TypeMeta {
  const t = (type || "").toLowerCase();
  if (t.includes("quote")) return { emoji: "💬", label: "Quote" };
  if (t.includes("job")) return { emoji: "🧰", label: "Job" };
  if (t.includes("message")) return { emoji: "✉️", label: "Message" };
  if (t.includes("payment")) return { emoji: "💳", label: "Payment" };
  if (t.includes("alert")) return { emoji: "🔔", label: "Alert" };
  return { emoji: "📌", label: "Update" };
}

const TypePill = React.memo(({ type }: { type: string }) => {
  const { colors, radius } = useTheme();
  const meta = typeMeta(type);

  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ fontSize: 12 }}>{meta.emoji}</Text>
      <Text style={{ fontSize: 12, fontWeight: "900", color: colors.textPrimary }}>
        {meta.label}
      </Text>
    </View>
  );
});
TypePill.displayName = "TypePill";

function pgRelationMissing(err: any) {
  return err?.code === "42P01" || /relation .* does not exist/i.test(err?.message || "");
}

function safeIso(iso?: string | null) {
  return iso ?? new Date().toISOString();
}

export default function Notifications() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [usingNotificationsTable, setUsingNotificationsTable] = useState<boolean | null>(null);

  const localReadSetRef = useRef<Set<string>>(new Set());

  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const loadFromNotificationsTable = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,body,type,entity_type,entity_id,is_read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const rows = ((data as any[]) ?? []).map((n) => ({
      ...n,
      source: "notifications_table" as const,
    })) as Notif[];

    return rows;
  }, []);

  const loadGenerated = useCallback(async (userId: string) => {
    const { data: quotes, error: qErr } = await supabase
      .from("quotes")
      .select("id,job_id,status,created_at,accepted_at,rejected_at,mechanic_id,price_cents")
      .eq("mechanic_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (qErr) throw qErr;

    const quoteRows = (quotes as QuoteRequestRow[]) ?? [];
    const jobIds = [...new Set(quoteRows.map((q) => q.job_id))];

    const { data: jobs, error: jErr } = jobIds.length > 0
      ? await supabase
          .from("jobs")
          .select("id,title,status,updated_at,created_at")
          .in("id", jobIds)
      : { data: [], error: null };

    if (jErr) throw jErr;

    const jobRows = (jobs as JobRow[]) ?? [];

    const { data: msgs, error: mErr } = jobIds.length > 0
      ? await supabase
          .from("messages")
          .select("id,job_id,content,created_at,sender_id")
          .in("job_id", jobIds)
          .neq("sender_id", userId)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [], error: null };

    const messagesRows = mErr ? ([] as MessageRow[]) : ((msgs as MessageRow[]) ?? []);

    const jobTitleById = new Map<string, string>();
    jobRows.forEach((j) => jobTitleById.set(j.id, getDisplayTitle(j.title) || "Job"));

    const generated: Notif[] = [];

    for (const q of quoteRows) {
      const status = (q.status || "").toLowerCase();
      const titleBase = jobTitleById.get(q.job_id) || "Job";
      const when = safeIso(q.accepted_at || q.rejected_at || q.created_at);

      let title = "Quote update";
      let body: string | null = null;

      if (status === "pending") {
        title = "Quote sent";
        body = `Your quote for ${titleBase} is pending customer review.`;
      } else if (status === "accepted") {
        title = "Quote accepted!";
        body = `Customer accepted your quote for ${titleBase}. Messaging is now unlocked.`;
      } else if (status === "rejected") {
        title = "Quote declined";
        body = `Your quote for ${titleBase} was not accepted.`;
      } else if (status) {
        title = "Quote updated";
        body = `Quote status: ${status} for ${titleBase}.`;
      }

      const id = `gen-quote-${q.id}`;
      const isRead = localReadSetRef.current.has(id);

      generated.push({
        id,
        title,
        body,
        type: "quote",
        entity_type: "job",
        entity_id: q.job_id,
        is_read: isRead,
        created_at: when,
        source: "generated",
      });
    }

    for (const j of jobRows) {
      const when = safeIso(j.updated_at || j.created_at);
      const titleBase = j.title?.trim() ? j.title : "Job";
      const status = (j.status || "").toLowerCase();

      const id = `gen-job-${j.id}-${when}`;
      const isRead = localReadSetRef.current.has(id);

      generated.push({
        id,
        title: "Job updated",
        body: status ? `${titleBase} is now: ${status}` : `${titleBase} was updated.`,
        type: "job",
        entity_type: "job",
        entity_id: j.id,
        is_read: isRead,
        created_at: when,
        source: "generated",
      });
    }

    for (const m of messagesRows) {
      const when = safeIso(m.created_at);
      const id = `gen-msg-${m.id}`;
      const isRead = localReadSetRef.current.has(id);

      generated.push({
        id,
        title: "New message",
        body: m.content ? m.content : "You received a message.",
        type: "message",
        entity_type: "job",
        entity_id: m.job_id,
        is_read: isRead,
        created_at: when,
        source: "generated",
      });
    }

    generated.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

    return generated.slice(0, 100);
  }, []);

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

      try {
        const rows = await loadFromNotificationsTable(userId);
        setUsingNotificationsTable(true);
        setItems(rows);
      } catch (err: any) {
        if (pgRelationMissing(err)) {
          const rows = await loadGenerated(userId);
          setUsingNotificationsTable(false);
          setItems(rows);
        } else {
          throw err;
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to load.";
      Alert.alert("Notifications error", errorMessage);
    } finally {
      setLoading(false);
    }
  }, [loadFromNotificationsTable, loadGenerated]);

  useFocusEffect(
    useCallback(() => {
      let channel: ReturnType<typeof supabase.channel> | null = null;

      load();

      (async () => {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;

        if (usingNotificationsTable !== true) return;

        channel = supabase
          .channel(`notifs-${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            () => load()
          )
          .subscribe();
      })();

      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    }, [load, usingNotificationsTable])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);
  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  const markRead = useCallback(
    async (n: Notif) => {
      if (n.source === "notifications_table") {
        const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
        if (error) throw error;
      } else {
        localReadSetRef.current.add(n.id);
      }

      setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)));
    },
    []
  );

  const open = useCallback(
    async (n: Notif) => {
      try {
        if (!n.is_read) await markRead(n);

        if (n.entity_type === "job" && n.entity_id) {
          router.push(`/(mechanic)/job-details/${n.entity_id}` as any);
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to open notification.");
      }
    },
    [markRead, router]
  );

  const markAllRead = useCallback(async () => {
    try {
      if (usingNotificationsTable) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;

        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", userId)
          .eq("is_read", false);

        if (error) throw error;
      } else {
        items.forEach((i) => localReadSetRef.current.add(i.id));
      }

      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to mark all as read.");
    }
  }, [items, usingNotificationsTable]);

  const keyExtractor = useCallback((n: Notif) => n.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Notif }) => {
      const unread = !item.is_read;

      return (
        <Pressable
          onPress={() => open(item)}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: unread ? colors.accent : colors.border,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={text.section} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[text.muted, { marginTop: 2 }]}>{timeAgo(item.created_at)}</Text>
            </View>

            <TypePill type={item.type} />
          </View>

          {item.body ? (
            <Text style={[text.body, { marginTop: spacing.sm }]} numberOfLines={2}>
              {item.body}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.sm }}>
            <Text style={{ color: colors.accent, fontWeight: "900" }}>
              {unread ? "NEW • Tap to open →" : "Tap to open →"}
            </Text>
          </View>

          {unread ? (
            <View
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: 6,
                backgroundColor: colors.accent,
                opacity: 0.25,
              }}
            />
          ) : null}
        </Pressable>
      );
    },
    [open, spacing.sm, colors, text, card, radius.sm]
  );

  const ItemSeparator = useCallback(() => <View style={{ height: spacing.md }} />, [spacing.md]);

  const headerHint = useMemo(() => {
    if (usingNotificationsTable === null) return "";
    return usingNotificationsTable
      ? "Live notifications enabled"
      : "Showing generated alerts (no notifications table yet)";
  }, [usingNotificationsTable]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.md, paddingTop: spacing.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={text.title}>Notifications</Text>

            <Text style={[text.muted, { marginTop: 4 }]}>
              Unread:{" "}
              <Text style={{ color: colors.accent, fontWeight: "900" }}>{unreadCount}</Text>
              {headerHint ? <Text style={{ color: colors.textMuted }}> • {headerHint}</Text> : null}
            </Text>
          </View>

          {unreadCount > 0 && (
            <Pressable
              onPress={markAllRead}
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
              <Text style={{ color: colors.textPrimary, fontWeight: "900" }}>Mark all read</Text>
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ marginTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[text.muted, { marginTop: 10 }]}>Loading…</Text>
        </View>
      ) : empty ? (
        <View style={{ padding: spacing.md }}>
          <View style={[card, { padding: spacing.lg }]}>
            <Text style={text.section}>No notifications yet</Text>
            <Text style={[text.body, { marginTop: 6 }]}>
              You'll see updates here when customers accept quotes and when jobs change status.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
          data={items}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={ItemSeparator}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        />
      )}
    </View>
  );
}
