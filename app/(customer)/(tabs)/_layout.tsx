import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter, usePathname } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Image, View, ActivityIndicator, Text, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";

export default function CustomerLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, text } = useTheme();
  const insets = useSafeAreaInsets();

  const [checking, setChecking] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [unread, setUnread] = useState<number>(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

      const { data, error } = await supabase.from("profiles").select("photo_url").eq("id", userId).single();
      if (!error && mountedRef.current) setPhotoUrl(data?.photo_url ?? null);
    } catch {
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

      if (!error && mountedRef.current) setUnread(count ?? 0);
    } catch {
    }
  }, []);

  const refreshHeaderStuff = useCallback(async () => {
    await Promise.all([loadAvatar(), loadUnread()]);
  }, [loadAvatar, loadUnread]);

  useEffect(() => {
    refreshHeaderStuff();
  }, [pathname, refreshHeaderStuff]);

  useFocusEffect(
    useCallback(() => {
      refreshHeaderStuff();
    }, [refreshHeaderStuff])
  );

  useEffect(() => {
    let channel: any;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      channel = supabase
        .channel("customer-notif-badge-" + userId)
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

  useEffect(() => {
    let active = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/");
        return;
      }
      if (active && mountedRef.current) setChecking(false);
      refreshHeaderStuff();
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/");
      else refreshHeaderStuff();
    });

    return () => {
      active = false;
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
      screenOptions={{
        tabBarHideOnKeyboard: true,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,

        headerLeft: () => (
          <View style={{ paddingLeft: 14 }}>
            <Image
              source={require("../../../assets/WrenchGo.png")}
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
