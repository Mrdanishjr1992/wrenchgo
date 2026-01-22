import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { getDisplayTitle } from "../../../src/lib/format-symptom";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

type NotifSection = {
  title: string;
  data: Notif[];
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
  body: string | null;
  created_at: string | null;
  sender_id: string | null;
};

type ReviewRow = {
  id: string;
  job_id: string;
  overall_rating: number | null;
  comment: string | null;
  created_at: string | null;
};

type PayoutRow = {
  id: string;
  job_id: string | null;
  amount_cents: number | null;
  status: string | null;
  created_at: string | null;
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

function getTimeGroup(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 24 && date.getDate() === now.getDate()) return "Today";
  if (diffDays < 2) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return "Earlier";
}

type TypeConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
};

function getTypeConfig(type: string, colors: any): TypeConfig {
  const t = (type || "").toLowerCase();
  if (t.includes("quote")) return { icon: "pricetag", color: colors.warning, label: "Quote" };
  if (t.includes("job")) return { icon: "briefcase", color: colors.primary, label: "Job" };
  if (t.includes("message")) return { icon: "chatbubble", color: colors.info, label: "Message" };
  if (t.includes("payment") || t.includes("payout")) return { icon: "card", color: colors.success, label: "Payment" };
  if (t.includes("lead")) return { icon: "flash", color: colors.accent, label: "Lead" };
  if (t.includes("dispute")) return { icon: "warning", color: colors.error, label: "Dispute" };
  return { icon: "notifications", color: colors.textMuted, label: "Update" };
}

function pgRelationMissing(err: any) {
  return err?.code === "42P01" || /relation .* does not exist/i.test(err?.message || "");
}

function safeIso(iso?: string | null) {
  return iso ?? new Date().toISOString();
}

function NotificationCard({
  notification,
  onPress,
  index,
}: {
  notification: Notif;
  onPress: () => void;
  index: number;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const isUnread = !notification.is_read;
  const typeConfig = getTypeConfig(notification.type, colors);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          flexDirection: "row",
          alignItems: "flex-start",
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          padding: spacing.md,
          backgroundColor: isUnread ? withAlpha(typeConfig.color, 0.06) : colors.surface,
          borderRadius: radius.xl,
          borderLeftWidth: isUnread ? 3 : 0,
          borderLeftColor: typeConfig.color,
          ...shadows.sm,
        }]}
      >
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: withAlpha(typeConfig.color, 0.12),
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Ionicons name={typeConfig.icon} size={20} color={typeConfig.color} />
        </View>

        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}>
            <Text style={{
              fontSize: 15,
              fontWeight: isUnread ? "700" : "600",
              color: colors.textPrimary,
              flex: 1,
            }} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={{
              fontSize: 12,
              color: isUnread ? typeConfig.color : colors.textMuted,
              fontWeight: isUnread ? "600" : "400",
              marginLeft: spacing.sm,
            }}>{timeAgo(notification.created_at)}</Text>
          </View>

          {notification.body && (
            <Text style={{
              fontSize: 14,
              color: isUnread ? colors.textPrimary : colors.textMuted,
              lineHeight: 20,
              fontWeight: isUnread ? "500" : "400",
            }} numberOfLines={2}>
              {notification.body}
            </Text>
          )}

          <View style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: spacing.sm,
            gap: spacing.sm,
          }}>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: withAlpha(typeConfig.color, 0.1),
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: radius.full,
            }}>
              <Ionicons name={typeConfig.icon} size={12} color={typeConfig.color} />
              <Text style={{
                fontSize: 11,
                fontWeight: "600",
                color: typeConfig.color,
              }}>{typeConfig.label}</Text>
            </View>

            {isUnread && (
              <View style={{
                backgroundColor: typeConfig.color,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: radius.full,
              }}>
                <Text style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: colors.white,
                }}>NEW</Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textMuted}
          style={{ marginLeft: spacing.xs, marginTop: 2 }}
        />
      </AnimatedPressable>
    </Animated.View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const { colors, spacing } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{
        fontSize: 13,
        fontWeight: "700",
        color: colors.textMuted,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}>{title}</Text>
    </Animated.View>
  );
}

function EmptyState() {
  const { colors, spacing, withAlpha } = useTheme();

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
        <Ionicons name="notifications" size={48} color={colors.primary} />
      </View>

      <Text style={{
        fontSize: 22,
        fontWeight: "700",
        color: colors.textPrimary,
        marginBottom: spacing.sm,
      }}>No notifications yet</Text>

      <Text style={{
        fontSize: 15,
        color: colors.textMuted,
        textAlign: "center",
        lineHeight: 22,
      }}>
        You'll see updates here when you receive new leads, quotes are accepted, or jobs change status.
      </Text>
    </Animated.View>
  );
}

function NotificationSkeleton() {
  const { colors, spacing, radius, withAlpha } = useTheme();

  const shimmer = {
    backgroundColor: withAlpha(colors.textMuted, 0.08),
  };

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "flex-start",
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
    }}>
      <View style={[shimmer, { width: 44, height: 44, borderRadius: 22 }]} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={[shimmer, { width: 180, height: 16, borderRadius: radius.sm, marginBottom: 8 }]} />
        <View style={[shimmer, { width: "100%", height: 14, borderRadius: radius.sm, marginBottom: 4 }]} />
        <View style={[shimmer, { width: "60%", height: 14, borderRadius: radius.sm, marginBottom: 8 }]} />
        <View style={[shimmer, { width: 60, height: 20, borderRadius: radius.full }]} />
      </View>
    </View>
  );
}

function LoadingSkeleton() {
  const { colors, spacing } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: spacing.md }}>
      <NotificationSkeleton />
      <NotificationSkeleton />
      <NotificationSkeleton />
      <NotificationSkeleton />
      <NotificationSkeleton />
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
        }}>unread {count === 1 ? "notification" : "notifications"}</Text>
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

export default function Notifications() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [usingNotificationsTable, setUsingNotificationsTable] = useState<boolean | null>(null);

  const localReadSetRef = useRef<Set<string>>(new Set());
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

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
    let quoteRows: QuoteRequestRow[] = [];
    let jobRows: JobRow[] = [];
    let messagesRows: MessageRow[] = [];
    let reviewRows: ReviewRow[] = [];
    let payoutRows: PayoutRow[] = [];

    try {
      const { data: quotes, error: qErr } = await supabase
        .from("quotes")
        .select("id,job_id,status,created_at,accepted_at,rejected_at,mechanic_id,price_cents")
        .eq("mechanic_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!qErr) quoteRows = (quotes as QuoteRequestRow[]) ?? [];
    } catch {}

    const jobIds = [...new Set(quoteRows.map((q) => q.job_id))];

    try {
      if (jobIds.length > 0) {
        const { data: jobs, error: jErr } = await supabase
          .from("jobs")
          .select("id,title,status,updated_at,created_at")
          .in("id", jobIds);

        if (!jErr) jobRows = (jobs as JobRow[]) ?? [];
      }
    } catch {}

    try {
      if (jobIds.length > 0) {
        const { data: msgs, error: mErr } = await supabase
          .from("messages")
          .select("id,job_id,body,created_at,sender_id")
          .in("job_id", jobIds)
          .neq("sender_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!mErr) messagesRows = (msgs as MessageRow[]) ?? [];
      }
    } catch {}

    try {
      const { data: reviews, error: rErr } = await supabase
        .from("reviews")
        .select("id,job_id,overall_rating,comment,created_at")
        .eq("mechanic_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!rErr) reviewRows = (reviews as ReviewRow[]) ?? [];
    } catch {}

    try {
      const { data: payouts, error: pErr } = await supabase
        .from("payouts")
        .select("id,job_id,amount_cents,status,created_at")
        .eq("mechanic_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!pErr) payoutRows = (payouts as PayoutRow[]) ?? [];
    } catch {}

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
        body: m.body ? m.body : "You received a message from a customer.",
        type: "message",
        entity_type: "job",
        entity_id: m.job_id,
        is_read: isRead,
        created_at: when,
        source: "generated",
      });
    }

    for (const r of reviewRows) {
      const when = safeIso(r.created_at);
      const id = `gen-review-${r.id}`;
      const isRead = localReadSetRef.current.has(id);
      const rating = r.overall_rating ?? 5;
      const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

      generated.push({
        id,
        title: "New review received!",
        body: r.comment ? `${stars} - "${r.comment}"` : `${stars} - Customer left a ${rating}-star review.`,
        type: "alert",
        entity_type: "job",
        entity_id: r.job_id,
        is_read: isRead,
        created_at: when,
        source: "generated",
      });
    }

    for (const p of payoutRows) {
      const when = safeIso(p.created_at);
      const id = `gen-payout-${p.id}`;
      const isRead = localReadSetRef.current.has(id);
      const status = (p.status || "").toLowerCase();
      const amount = p.amount_cents ? `$${(p.amount_cents / 100).toFixed(2)}` : "";

      let title = "Payout update";
      let body: string | null = null;

      if (status === "pending") {
        title = "Payout pending";
        body = amount ? `${amount} payout is being processed.` : "Your payout is being processed.";
      } else if (status === "processed" || status === "completed") {
        title = "Payout completed!";
        body = amount ? `${amount} has been sent to your account.` : "Your payout has been sent.";
      } else if (status === "failed") {
        title = "Payout failed";
        body = "There was an issue with your payout. Please check your payment details.";
      } else {
        title = "Payout update";
        body = amount ? `Payout of ${amount}: ${status}` : `Payout status: ${status}`;
      }

      generated.push({
        id,
        title,
        body,
        type: "payment",
        entity_type: p.job_id ? "job" : null,
        entity_id: p.job_id,
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
          try {
            const rows = await loadGenerated(userId);
            setUsingNotificationsTable(false);
            setItems(rows);
          } catch (genErr: any) {
            if (pgRelationMissing(genErr)) {
              setItems([]);
              setUsingNotificationsTable(false);
            } else {
              throw genErr;
            }
          }
        } else {
          throw err;
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to load.";
      if (pgRelationMissing(e)) {
        setItems([]);
      } else {
        Alert.alert("Notifications error", errorMessage);
      }
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

  const sections = useMemo(() => {
    const groups: Record<string, Notif[]> = {};
    const order = ["Today", "Yesterday", "This Week", "This Month", "Earlier"];

    items.forEach((item) => {
      const group = getTimeGroup(item.created_at);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });

    return order
      .filter((title) => groups[title]?.length > 0)
      .map((title) => ({ title, data: groups[title] }));
  }, [items]);

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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
        <LoadingSkeleton />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
        <EmptyState />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
        renderItem={({ item, index }) => (
          <NotificationCard
            notification={item}
            onPress={() => open(item)}
            index={index}
          />
        )}
        ListHeaderComponent={
          unreadCount > 0 ? (
            <UnreadHeader count={unreadCount} onMarkAllRead={markAllRead} />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.xxxl,
        }}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
