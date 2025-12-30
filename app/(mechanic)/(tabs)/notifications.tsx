import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
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

const fmtShort = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (sameDay) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const chipFor = (n: Notif) => {
  const t = (n.type || "").toLowerCase();
  if (t.includes("quote")) return { label: "QUOTE", tone: "accent" as const };
  if (t.includes("job")) return { label: "JOB", tone: "muted" as const };
  return { label: "ALERT", tone: "muted" as const };
};

export default function Notifications() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notif[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
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

      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,type,entity_type,entity_id,is_read,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setItems((data as Notif[]) ?? []);
    } catch (e: any) {
      Alert.alert("Notifications error", e?.message ?? "Failed to load.");
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
          .channel("notifs-" + userId)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
            () => load()
          )
          .subscribe();
      })();

      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    }, [load])
  );

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const markRead = useCallback(async (id: string) => {
    // optimistic (snappy)
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_read: true } : x)));
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) {
      // revert on failure
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_read: false } : x)));
    }
  }, []);

  const open = useCallback(
    async (n: Notif) => {
      if (!n.is_read) await markRead(n.id);

      if (n.entity_type === "job" && n.entity_id) {
        router.push(`/(mechanic)/job/${n.entity_id}` as any);
        return;
      }
    },
    [markRead, router]
  );

  const markAllRead = useCallback(async () => {
    if (markingAll || unreadCount === 0) return;

    try {
      setMarkingAll(true);

      // optimistic (instant)
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) throw error;
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed.");
      load(); // resync if something went wrong
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadCount, load]);

  const Header = (
    <View style={{ paddingTop: 6, gap: spacing.md, marginBottom: spacing.md }}>
      {/* Header block */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 18,
          padding: spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={text.title}>Alerts</Text>
            <Text style={{ ...text.muted, marginTop: 4 }}>
              Unread{" "}
              <Text style={{ color: colors.accent, fontWeight: "900" }}>
                {unreadCount}
              </Text>
              {items.length > 0 ? (
                <Text style={{ color: colors.textMuted }}> � {items.length} total</Text>
              ) : null}
            </Text>
          </View>

          <Pressable
            onPress={markAllRead}
            disabled={markingAll || unreadCount === 0}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              {
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: colors.bg,
                opacity: markingAll || unreadCount === 0 ? 0.6 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "900" }}>
              {markingAll ? "MARKING�" : "Mark all"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Empty / loading */}
      {loading ? (
        <View style={{ alignItems: "center", marginTop: spacing.sm }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ marginTop: 10, ...text.muted }}>Loading�</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={[card, { padding: spacing.lg }]}>
          <Text style={text.section}>No alerts yet</Text>
          <Text style={{ marginTop: 6, ...text.body }}>
            You&apos;ll see updates here when jobs change status and customers accept quotes.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
        data={items}
        keyExtractor={(n) => n.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={Header}
        renderItem={({ item }) => {
          const chip = chipFor(item);
          const unread = !item.is_read;
          const emoji = chip.label === "QUOTE" ? "💬" : chip.label === "JOB" ? "🧰" : "🔔";

          return (
            <Pressable
              onPress={() => open(item)}
              style={({ pressed }) => [
                card,
                pressed && cardPressed,
                {
                  padding: spacing.lg,
                  borderColor: unread ? colors.accent : colors.border,
                  backgroundColor: colors.surface,
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
                    borderColor: unread ? "rgba(13,148,136,0.35)" : colors.border,
                    backgroundColor: colors.bg,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={text.section} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {unread ? (
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
                          NEW
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ marginLeft: "auto", ...text.muted }}>{fmtShort(item.created_at)}</Text>
                    )}
                  </View>

                  <Text style={{ ...text.muted, marginTop: 4 }} numberOfLines={2}>
                    {item.body ?? "Tap to view details."}
                  </Text>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "800", color: colors.textPrimary }}>
                        {chip.label}
                      </Text>
                    </View>

                    <Text style={{ ...text.muted }}>
                      {unread ? fmtShort(item.created_at) : ""}
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
    </View>
  );
}

