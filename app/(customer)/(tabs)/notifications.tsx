import React, { useCallback, useMemo, useState } from "react";
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

type Notif = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

type TypeMeta = {
  emoji: string;
  label: string;
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
    return new Date(iso).toLocaleDateString(undefined, { 
      month: "short", 
      day: "numeric" 
    });
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
        borderRadius: radius.full,
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

export default function Notifications() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const { colors, text, spacing, radius } = useTheme();
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

      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,type,entity_type,entity_id,is_read,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      
      setItems((data as Notif[]) ?? []);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to load.";
      Alert.alert("Notifications error", errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();

      let channel: ReturnType<typeof supabase.channel> | null = null;
      
      (async () => {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;

        channel = supabase
          .channel(`notifs-${userId}`)
          .on(
            "postgres_changes",
            { 
              event: "*", 
              schema: "public", 
              table: "notifications", 
              filter: `user_id=eq.${userId}` 
            },
            () => load()
          )
          .subscribe();
      })();

      return () => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.is_read).length, 
    [items]
  );
  
  const empty = useMemo(
    () => !loading && items.length === 0, 
    [loading, items.length]
  );

  const markRead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      
      if (error) throw error;
      
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to mark as read.";
      Alert.alert("Error", errorMessage);
    }
  }, []);

  const open = useCallback(
    async (n: Notif) => {
      if (!n.is_read) {
        await markRead(n.id);
      }

      if (n.entity_type === "job" && n.entity_id) {
        router.push(`/job/${n.entity_id}` as any);
      }
    },
    [markRead, router]
  );

  const markAllRead = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      
      if (error) throw error;
      
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to mark all as read.";
      Alert.alert("Error", errorMessage);
    }
  }, []);

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
              <Text style={[text.muted, { marginTop: 2 }]}>
                {timeAgo(item.created_at)}
              </Text>
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

  const ItemSeparator = useCallback(
    () => <View style={{ height: spacing.md }} />,
    [spacing.md]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.md, paddingTop: spacing.lg }}>
        <View style={{ 
          flexDirection: "row", 
          justifyContent: "space-between", 
          alignItems: "center" 
        }}>
          <View style={{ flex: 1 }}>
            <Text style={text.title}>Notifications</Text>
            <Text style={[text.muted, { marginTop: 4 }]}>
              Unread: <Text style={{ color: colors.accent, fontWeight: "900" }}>
                {unreadCount}
              </Text>
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
              <Text style={{ color: colors.textPrimary, fontWeight: "900" }}>
                Mark all read
              </Text>
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
              You'll see updates here when quotes are sent/accepted and when jobs change status.
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
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={colors.accent} 
            />
          }
        />
      )}
    </View>
  );
}
