import React, { useState, useEffect, useCallback } from "react";
import { View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/ui/theme-context";
import { WalkthroughTarget, WALKTHROUGH_TARGET_IDS } from "../../../src/onboarding";
import { MessagesListView, SupportMessagesView } from "../../../components/inbox";
import Notifications from "./notifications";
import { getUnreadSupportThreadCount, type SupportThread } from "../../../src/lib/admin-messages";
import { getUnreadMessagesCount, getUnreadNotificationsCount, subscribeToUnreadCounts } from "../../../src/lib/inbox-counts";
import { supabase } from "../../../src/lib/supabase";

type TabType = "messages" | "support" | "alerts";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TabButton({
  label,
  icon,
  isActive,
  onPress,
  badge,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const { colors, spacing, radius } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatBadge = (count: number) => {
    if (count > 99) return "99+";
    if (count > 9) return String(count);
    return String(count);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      style={[animatedStyle, {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: isActive ? colors.primary : "transparent",
      }]}
    >
      <Ionicons
        name={isActive ? icon : `${icon}-outline` as any}
        size={18}
        color={isActive ? colors.white : colors.textMuted}
      />
      <Text style={{
        fontSize: 14,
        fontWeight: "600",
        color: isActive ? colors.white : colors.textMuted,
      }}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={{
          backgroundColor: isActive ? colors.white : colors.error,
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          paddingHorizontal: 4,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 2,
        }}>
          <Text style={{
            color: isActive ? colors.primary : colors.white,
            fontSize: 10,
            fontWeight: "800",
          }}>{formatBadge(badge)}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

export default function Inbox() {
  const [tab, setTab] = useState<TabType>("messages");
  const { colors, spacing, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadSupport, setUnreadSupport] = useState(0);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const refreshCounts = useCallback(async () => {
    const [messages, support, alerts] = await Promise.all([
      getUnreadMessagesCount(),
      getUnreadSupportThreadCount(),
      getUnreadNotificationsCount(),
    ]);
    setUnreadMessages(messages);
    setUnreadSupport(support);
    setUnreadAlerts(alerts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshCounts();
    }, [refreshCounts])
  );

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (userId) {
        unsubscribe = subscribeToUnreadCounts(
          userId,
          setUnreadMessages,
          setUnreadAlerts
        );
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleSupportThreadPress = useCallback((thread: SupportThread) => {
    router.push(`/(mechanic)/support-thread/${thread.thread_id}`);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.View 
        entering={FadeIn.duration(300)}
        style={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.bg,
        }}
      >
        <Text style={{
          fontSize: 28,
          fontWeight: "800",
          color: colors.textPrimary,
          letterSpacing: -0.5,
          marginBottom: spacing.lg,
        }}>Inbox</Text>

        <View style={{
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: 4,
          ...shadows.sm,
        }}>
          <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.MECHANIC_INBOX_TAB} style={{ flex: 1 }}>
            <TabButton
              label="Messages"
              icon="chatbubble"
              isActive={tab === "messages"}
              onPress={() => setTab("messages")}
              badge={unreadMessages}
            />
          </WalkthroughTarget>

          <TabButton
            label="Support"
            icon="headset"
            isActive={tab === "support"}
            onPress={() => setTab("support")}
            badge={unreadSupport}
          />

          <TabButton
            label="Alerts"
            icon="notifications"
            isActive={tab === "alerts"}
            onPress={() => setTab("alerts")}
            badge={unreadAlerts}
          />
        </View>
      </Animated.View>

      <View style={{ flex: 1 }}>
        {tab === "messages" && <MessagesListView role="mechanic" />}
        {tab === "support" && <SupportMessagesView onThreadPress={handleSupportThreadPress} />}
        {tab === "alerts" && <Notifications />}
      </View>
    </View>
  );
}