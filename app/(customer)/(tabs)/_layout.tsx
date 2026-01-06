import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter, usePathname } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Image, View, ActivityIndicator, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";

export default function CustomerLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, mode } = useTheme(); // ✅ add mode
  const insets = useSafeAreaInsets();

  const [checking, setChecking] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [unread, setUnread] = useState<number>(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const avatarSource = useMemo(
    () => (avatarUrl ? { uri: avatarUrl } : require("../../../assets/profile.png")),
    [avatarUrl]
  );

  const getUserId = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.user?.id ?? null;
  }, []);

  const loadAvatar = useCallback(async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;

      // ✅ use maybeSingle so no-row doesn't throw
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (error) return;

      // ✅ correct column name
      if (mountedRef.current) setAvatarUrl(data?.avatar_url ?? null);
    } catch {
      // ignore
    }
  }, [getUserId]);

  const loadUnread = useCallback(async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;

      // ⚠️ notifications table may not exist yet - gracefully handle
      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false);

        if (!error && mountedRef.current) {
          setUnread(count ?? 0);
        }
      } catch (notifError) {
        // Table doesn't exist - set unread to 0
        if (mountedRef.current) setUnread(0);
      }
    } catch {
      // ignore
    }
  }, [getUserId]);

  const refreshHeaderStuff = useCallback(async () => {
    await Promise.all([loadAvatar(), loadUnread()]);
  }, [loadAvatar, loadUnread]);

  // Refresh header when route changes (fine)
  useEffect(() => {
    refreshHeaderStuff();
  }, [pathname, refreshHeaderStuff]);

  useFocusEffect(
    useCallback(() => {
      refreshHeaderStuff();
    }, [refreshHeaderStuff])
  );

  // Realtime badge update - only subscribe if notifications table exists
  useEffect(() => {
    let channel: any;

    (async () => {
      const userId = await getUserId();
      if (!userId) return;

      try {
        channel = supabase
          .channel("customer-notif-badge-" + userId)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
            () => loadUnread()
          )
          .subscribe();
      } catch {
        // Notifications table doesn't exist - skip realtime
      }
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [getUserId, loadUnread]);

  // ✅ Auth guard: redirect ONLY when truly signed out
  useEffect(() => {
    let alive = true;

    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (alive && mountedRef.current) setChecking(false);
        return;
      }

      if (!data.session) {
        router.replace("/(auth)/sign-in");
        return;
      }

      if (alive && mountedRef.current) setChecking(false);
      refreshHeaderStuff();
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // ✅ only kick user out on explicit sign-out events
      if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        router.replace("/(auth)/sign-in");
        return;
      }

      // session exists → refresh header
      if (session) refreshHeaderStuff();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router, refreshHeaderStuff]);

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Tabs
      key={mode} // ✅ force header + tab bar to refresh when theme flips
      screenOptions={{
        tabBarHideOnKeyboard: true,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,

        headerLeft: () => (
          <View style={{ paddingLeft: 14 + insets.left }}>
            <Image
              source={require("../../../assets/wrenchgo.png")}
              style={{ width: 120, height: 60 }}
              resizeMode="contain"
            />
          </View>
        ),

        headerRight: () => (
          <Pressable
            onPress={() => router.push("/(customer)/(tabs)/account")}
            hitSlop={12}
            style={{
              paddingRight: 14 + insets.right,
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
        name="index"
        options={{
          title: "Home",
          headerTitle: "",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          headerTitle: "",
          tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: "Jobs",
          headerTitle: "",
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
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

      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen
        name="account"
        options={{
          href: null,
          headerTitle: "",
          headerRight: () => null,
        }}
      />
    </Tabs>
  );
}
