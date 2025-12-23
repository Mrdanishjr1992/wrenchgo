import { useCallback, useMemo, useState } from "react";
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
import { colors, spacing, text } from "../../../src/ui/theme";
import { card } from "../../../src/ui/styles";

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

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
};

export default function Notifications() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notif[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const userId = userData.user?.id;
      if (!userId) return;

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
    }, [load])
  );

  const unreadCount = useMemo(
    () => items.filter((n) => !n.is_read).length,
    [items]
  );

  const markRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }, []);

  const open = useCallback(
    async (n: Notif) => {
      if (!n.is_read) await markRead(n.id);

      // ✅ Mechanic job route
      if (n.entity_type === "job" && n.entity_id) {
        router.push(`/(mechanic)/job/${n.entity_id}` as any);
        return;
      }

      // Add more mappings later if needed
    },
    [markRead, router]
  );

  const markAllRead = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed.");
    }
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        data={items}
        keyExtractor={(n) => n.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={{ paddingTop: 6 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={text.title}>Alerts</Text>
                <Text style={{ ...text.muted, marginTop: 4 }}>
                  Unread:{" "}
                  <Text style={{ color: colors.accent, fontWeight: "900" }}>
                    {unreadCount}
                  </Text>
                </Text>
              </View>

              <Pressable
                onPress={markAllRead}
                style={[
                  card,
                  {
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                  Mark all read
                </Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={{ marginTop: spacing.lg, alignItems: "center" }}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ marginTop: 10, ...text.muted }}>Loading…</Text>
              </View>
            ) : items.length === 0 ? (
              <View style={[card, { marginTop: spacing.lg, padding: spacing.md }]}>
                <Text style={text.section}>No alerts yet</Text>
                <Text style={{ marginTop: 6, ...text.body }}>
                  You’ll see updates here when jobs change status and customers accept quotes.
                </Text>
              </View>
            ) : null}

            <View style={{ height: spacing.md }} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            style={[
              card,
              {
                padding: spacing.md,
                borderColor: item.is_read ? colors.border : colors.accent,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={text.section}>{item.title}</Text>
                {item.body ? (
                  <Text style={{ ...text.body, marginTop: 6 }}>{item.body}</Text>
                ) : null}
                <Text style={{ ...text.muted, marginTop: 8 }}>{fmt(item.created_at)}</Text>
              </View>

              {!item.is_read ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: colors.accent,
                    marginTop: 4,
                  }}
                />
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
