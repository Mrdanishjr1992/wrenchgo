import { Tabs, useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Image, View, Text, Platform } from "react-native";
import { useTheme } from "../../../src/ui/theme-context";
import { supabase } from "../../../src/lib/supabase";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";

export default function MechanicTabsLayout() {
    const { colors, text } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [unread, setUnread] = useState<number>(0);

  const avatarSource = useMemo(
    () => (photoUrl ? { uri: photoUrl } : require("../../../assets/profile.png")),
    [photoUrl]
  );

  const loadAvatar = useCallback(async () => {
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const userId = userData.user?.id;
      if (!userId) return;

      const { data, error } = await supabase.from("profiles").select("avatar_url").eq("auth_id", userId)
.single();
      if (!error) setPhotoUrl(data?.photo_url ?? null);
    } catch {
      // silent fallback
    }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const userId = userData.user?.id;
      if (!userId) return;

      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (!error) setUnread(count ?? 0);
    } catch {
      // silent
    }
  }, []);

  const refreshHeaderStuff = useCallback(async () => {
    await Promise.all([loadAvatar(), loadUnread()]);
  }, [loadAvatar, loadUnread]);

  // refresh when switching tabs/routes
  useEffect(() => {
    refreshHeaderStuff();
  }, [pathname, refreshHeaderStuff]);

  // refresh when screen gains focus
  useFocusEffect(
    useCallback(() => {
      refreshHeaderStuff();
    }, [refreshHeaderStuff])
  );

  // realtime unread badge updates
  useEffect(() => {
    let channel: any;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      channel = supabase
        .channel("mechanic-notif-badge-" + userId)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => loadUnread()
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadUnread]);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,

        headerLeft: () => (
          <View style={{ paddingLeft: 14 }}>
            <Image
              source={require("../../../assets/wrenchgo.png")}
              style={{ width: 120, height: 60 }}
              resizeMode="contain"
            />
          </View>
        ),

        // a little more "alive": avatar chip + unread dot
        headerRight: () => (
          <Pressable
            onPress={() => router.push("/(mechanic)/(tabs)/profile")}
            hitSlop={12}
            style={{
              paddingRight: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            {unread > 0 ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: colors.accent + "22",
                  borderWidth: 1,
                  borderColor: colors.accent + "55",
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.accent, fontSize: 12 }}>
                  {unread} new
                </Text>
              </View>
            ) : null}

            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                padding: 2,
                backgroundColor: colors.accent + "22",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Image
                source={avatarSource}
                style={{ width: "100%", height: "100%", borderRadius: 17 }}
                resizeMode="cover"
              />
              {/* tiny dot = online feel (purely visual) */}
              <View
                style={{
                  position: "absolute",
                  right: 1,
                  bottom: 1,
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: colors.accent,
                  borderWidth: 2,
                  borderColor: colors.bg,
                }}
              />
            </View>
          </Pressable>
        ),

        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom || 12,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "800" },
      }}
    >
      <Tabs.Screen
        name="leads"
        options={{
          headerTitle: "",
          tabBarIcon: ({ color, size }) => <Ionicons name="flash" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          headerTitle: "",
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          headerTitle: "",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="mail" color={color} size={size} />
              {unread > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -10,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 5,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.accent,
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                >
                  <Text style={{ color: "#000", fontWeight: "900", fontSize: 10 }}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />

      {/* hidden routes */}
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          headerTitle: "",
          headerRight: () => null,
        }}
      />
    </Tabs>
  );
}
