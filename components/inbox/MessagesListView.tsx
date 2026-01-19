import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Alert,
  Pressable,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

const avatarColors = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

const getAvatarColor = (name: string | null) => {
  if (!name) return avatarColors[0];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
};

function ConversationCard({
  conversation,
  onPress,
  index,
}: {
  conversation: Conversation;
  onPress: () => void;
  index: number;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const hasUnread = conversation.unread_count > 0;
  const initials = getInitials(conversation.other_party_name);
  const avatarBg = getAvatarColor(conversation.other_party_name);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInRight.delay(index * 50).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: hasUnread ? withAlpha(colors.primary, 0.05) : colors.surface,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          padding: spacing.md,
          borderRadius: radius.xl,
          borderLeftWidth: hasUnread ? 3 : 0,
          borderLeftColor: colors.primary,
          ...shadows.sm,
        }]}
      >
        <View style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: avatarBg,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}>
          <Text style={{
            color: colors.white,
            fontWeight: "700",
            fontSize: 18,
          }}>{initials}</Text>
          {hasUnread && (
            <View style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: colors.success,
              borderWidth: 2,
              borderColor: colors.surface,
            }} />
          )}
        </View>

        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: hasUnread ? "700" : "600",
              color: colors.textPrimary,
              flex: 1,
            }} numberOfLines={1}>
              {conversation.other_party_name || "Unknown"}
            </Text>
            <Text style={{
              fontSize: 12,
              color: hasUnread ? colors.primary : colors.textMuted,
              fontWeight: hasUnread ? "600" : "400",
              marginLeft: spacing.sm,
            }}>{fmtTime(conversation.last_message_time)}</Text>
          </View>

          <Text style={{
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 4,
          }} numberOfLines={1}>
            {conversation.title}
          </Text>

          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}>
            <Text style={{
              fontSize: 14,
              color: hasUnread ? colors.textPrimary : colors.textMuted,
              fontWeight: hasUnread ? "500" : "400",
              flex: 1,
            }} numberOfLines={1}>
              {conversation.last_message ?? "No messages yet"}
            </Text>
            {hasUnread && (
              <View style={{
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
              }}>
                <Text style={{
                  color: colors.white,
                  fontWeight: "800",
                  fontSize: 11,
                }}>{conversation.unread_count > 9 ? "9+" : conversation.unread_count}</Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textMuted}
          style={{ marginLeft: spacing.sm }}
        />
      </AnimatedPressable>
    </Animated.View>
  );
}

function EmptyState({ isCustomer }: { isCustomer: boolean }) {
  const { colors, spacing, radius, withAlpha } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(400)}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xxxl,
      }}
    >
      <View style={{
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: withAlpha(colors.primary, 0.1),
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
      }}>
        <Ionicons name="chatbubbles" size={48} color={colors.primary} />
      </View>

      <Text style={{
        fontSize: 22,
        fontWeight: "700",
        color: colors.textPrimary,
        marginBottom: spacing.sm,
      }}>No messages yet</Text>

      <Text style={{
        fontSize: 15,
        color: colors.textMuted,
        textAlign: "center",
        lineHeight: 22,
      }}>
        {isCustomer
          ? "Once you accept a quote, you'll be able to chat with your mechanic here"
          : "When a customer accepts your quote, you can message them here"}
      </Text>
    </Animated.View>
  );
}

function ConversationSkeleton() {
  const { colors, spacing, radius, withAlpha } = useTheme();

  const shimmer = {
    backgroundColor: withAlpha(colors.textMuted, 0.08),
  };

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
    }}>
      <View style={[shimmer, { width: 56, height: 56, borderRadius: 28 }]} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={[shimmer, { width: 140, height: 18, borderRadius: radius.sm, marginBottom: 8 }]} />
        <View style={[shimmer, { width: 100, height: 14, borderRadius: radius.sm, marginBottom: 6 }]} />
        <View style={[shimmer, { width: 180, height: 14, borderRadius: radius.sm }]} />
      </View>
    </View>
  );
}

function LoadingSkeleton() {
  const { colors, spacing } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: spacing.md }}>
      <ConversationSkeleton />
      <ConversationSkeleton />
      <ConversationSkeleton />
      <ConversationSkeleton />
      <ConversationSkeleton />
    </View>
  );
}

function UnreadHeader({
  count,
  onMarkAllRead,
}: {
  count: number;
  onMarkAllRead: () => void;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        padding: spacing.md,
        backgroundColor: withAlpha(colors.primary, 0.08),
        borderRadius: radius.xl,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Text style={{
            color: colors.white,
            fontWeight: "800",
            fontSize: 14,
          }}>{count > 99 ? "99+" : count}</Text>
        </View>
        <Text style={{
          fontSize: 15,
          fontWeight: "600",
          color: colors.textPrimary,
        }}>unread {count === 1 ? "message" : "messages"}</Text>
      </View>

      <Pressable
        onPress={onMarkAllRead}
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{
          fontSize: 14,
          fontWeight: "600",
          color: colors.primary,
        }}>Mark all read</Text>
      </Pressable>
    </Animated.View>
  );
}

export function MessagesListView({ role }: MessagesListViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Conversation[]>([]);
  const { colors, spacing } = useTheme();

  const isCustomer = role === "customer";
  const otherPartyLabel = isCustomer ? "Mechanic" : "Customer";
  const chatRoute = isCustomer ? "/(customer)/messages" : "/(mechanic)/messages";

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
            .eq("recipient_id", userId)
            .is("read_at", null)
            .is("deleted_at", null);

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

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState isCustomer={isCustomer} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxxl }}
        ListHeaderComponent={
          unreadCount > 0 ? (
            <UnreadHeader count={unreadCount} onMarkAllRead={markAllRead} />
          ) : null
        }
        renderItem={({ item, index }) => (
          <ConversationCard
            conversation={item}
            onPress={() => openConversation(item)}
            index={index}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
