import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Alert, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";

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

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const open = async (n: Notif) => {
    if (!n.is_read) await markRead(n.id);

    // simple routing: job notifications go to job details
    if (n.entity_type === "job" && n.entity_id) {
      // this will work for customer OR mechanic because each has their own routes;
      // if you want smarter routing, tell me your exact route structure and I’ll map it.
      router.push(`/job/${n.entity_id}` as any);
    }
  };

  const markAllRead = async () => {
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
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={text.title}>Notifications</Text>
          <Text style={text.muted}>
            Unread: <Text style={{ color: colors.accent, fontWeight: "900" }}>{unreadCount}</Text>
          </Text>
        </View>

        <Pressable
          onPress={markAllRead}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>Mark all read</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ marginTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ marginTop: 10, ...text.muted }}>Loading…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={text.section}>No notifications yet</Text>
          <Text style={{ marginTop: 6, ...text.body }}>
            You’ll see updates here when quotes are sent/accepted and when jobs change status.
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ marginTop: spacing.lg }}
          data={items}
          keyExtractor={(n) => n.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: item.is_read ? colors.border : colors.accent,
                gap: 6,
              }}
            >
              <Text style={text.section}>{item.title}</Text>
              {item.body ? <Text style={text.body}>{item.body}</Text> : null}
              <Text style={text.muted}>{new Date(item.created_at).toLocaleString()}</Text>

              {!item.is_read ? (
                <Text style={{ color: colors.accent, fontWeight: "900", marginTop: 6 }}>NEW</Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
