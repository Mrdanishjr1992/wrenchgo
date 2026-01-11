import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { getDisplayTitle } from "../../src/lib/format-symptom";

type Conversation = {
  id: string;
  job_id: string;
  title: string;
  other_party_name: string | null;
  last_message: string | null;
  last_message_time: string;
  unread_count: number;
};

type MessagesListViewProps = {
  role: "customer" | "mechanic";
};

const getInitials = (name: string | null) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const fmtTime = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Now";
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

export function MessagesListView({ role }: MessagesListViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Conversation[]>([]);
  const { colors, text, spacing, radius } = useTheme();

  const isCustomer = role === "customer";
  const otherPartyLabel = isCustomer ? "Mechanic" : "Customer";
  const chatRoute = isCustomer ? "/(customer)/messages" : "/(mechanic)/messages";

  const avatarColors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  ];

  const getAvatarColor = (name: string | null) => {
    if (!name) return avatarColors[0];
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return avatarColors[hash % avatarColors.length];
  };

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

      let query = supabase
        .from("jobs")
        .select("id, title, customer_id, accepted_mechanic_id, created_at")
        .in("status", ["accepted", "scheduled", "in_progress", "work_in_progress", "completed"])
        .order("created_at", { ascending: false });

      if (isCustomer) {
        query = query.eq("customer_id", userId).not("accepted_mechanic_id", "is", null);
      } else {
        query = query.eq("accepted_mechanic_id", userId);
      }

      const { data: jobs, error: jobsError } = await query;
      if (jobsError) throw jobsError;

      const otherPartyIds = [
        ...new Set(
          (jobs || []).map((j: any) =>
            isCustomer ? j.accepted_mechanic_id : j.customer_id
          )
        ),
      ].filter(Boolean);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", otherPartyIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.id, p.full_name])
      );

      const conversations: Conversation[] = await Promise.all(
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

          const otherPartyId = isCustomer ? job.accepted_mechanic_id : job.customer_id;

          return {
            id: job.id,
            job_id: job.id,
            title: getDisplayTitle(job.title) || "Untitled Job",
            other_party_name: profileMap.get(otherPartyId) || otherPartyLabel,
            last_message: lastMsg?.body || null,
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
  }, [isCustomer, otherPartyLabel]);

  useFocusEffect(
    useCallback(() => {
      load();
      let channel: any;

      (async () => {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;

        channel = supabase
          .channel("messages-list-" + userId)
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const unreadCount = useMemo(
    () => items.reduce((sum, item) => sum + item.unread_count, 0),
    [items]
  );

  const openConversation = useCallback(
    (conversation: Conversation) => {
      router.push(`${chatRoute}/${conversation.job_id}` as any);
    },
    [router, chatRoute]
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

  const empty = !loading && items.length === 0;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[text.muted, { marginTop: 12 }]}>Loading conversations...</Text>
      </View>
    );
  }

  if (empty) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.bg }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.accent + "12" }]}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.accent} />
        </View>
        <Text style={[text.title, { fontSize: 20, marginTop: 16 }]}>No messages yet</Text>
        <Text style={[text.muted, { textAlign: "center", marginTop: 8, paddingHorizontal: 40, lineHeight: 22 }]}>
          {isCustomer
            ? "Once you accept a quote, you'll be able to chat with your mechanic here"
            : "When a customer accepts your quote, you can message them here"}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {unreadCount > 0 && (
        <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.unreadBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
            <Text style={[text.body, { fontWeight: "600" }]}>unread</Text>
          </View>
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 14 }}>Mark all read</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        renderItem={({ item }) => {
          const hasUnread = item.unread_count > 0;
          const initials = getInitials(item.other_party_name);
          const avatarBg = getAvatarColor(item.other_party_name);

          return (
            <Pressable
              onPress={() => openConversation(item)}
              style={({ pressed }) => [
                styles.conversationRow,
                { 
                  backgroundColor: pressed ? colors.surface : colors.bg,
                  borderLeftColor: hasUnread ? colors.accent : "transparent",
                },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                <Text style={styles.avatarText}>{initials}</Text>
                {hasUnread && <View style={[styles.onlineDot, { borderColor: colors.bg, backgroundColor: colors.success }]} />}
              </View>

              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={[text.body, { fontWeight: "600", fontSize: 16 }]} numberOfLines={1}>
                    {item.other_party_name}
                  </Text>
                  <Text style={[text.muted, { fontSize: 13 }]}>{fmtTime(item.last_message_time)}</Text>
                </View>

                <Text style={[text.muted, { fontSize: 13, marginTop: 2 }]} numberOfLines={1}>
                  {item.title}
                </Text>

                <View style={styles.messagePreview}>
                  <Text
                    style={[
                      { fontSize: 14, flex: 1, color: hasUnread ? colors.textPrimary : colors.textMuted },
                      hasUnread && { fontWeight: "500" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.last_message ?? "No messages yet"}
                  </Text>
                  {hasUnread && (
                    <View style={[styles.countBadge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.countBadgeText}>{item.unread_count}</Text>
                    </View>
                  )}
                </View>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 76 }]} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 13,
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderLeftWidth: 3,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2,
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  messagePreview: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 11,
  },
  separator: {
    height: 1,
  },
});