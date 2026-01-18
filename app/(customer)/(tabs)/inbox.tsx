import React, { useState, useEffect, useRef } from "react";
import { View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/ui/theme-context";
import { WalkthroughTarget, WALKTHROUGH_TARGET_IDS } from "../../../src/onboarding";
import { MessagesListView, SupportMessagesView } from "../../../components/inbox";
import Notifications from "./notifications";
import { getUnreadAdminMessageCount } from "../../../src/lib/admin-messages";

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
  const { colors, spacing, radius, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: isActive ? colors.primary : "transparent",
  }));

  const textStyle = useAnimatedStyle(() => ({
    color: isActive ? colors.white : colors.textMuted,
  }));

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
      }]}
    >
      <Ionicons 
        name={isActive ? icon : `${icon}-outline` as any} 
        size={18} 
        color={isActive ? colors.white : colors.textMuted} 
      />
      <Animated.Text style={[textStyle, {
        fontSize: 14,
        fontWeight: "600",
      }]}>{label}</Animated.Text>
      {badge !== undefined && badge > 0 && (
        <View style={{
          backgroundColor: isActive ? colors.white : colors.error,
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 2,
        }}>
          <Text style={{
            color: isActive ? colors.primary : colors.white,
            fontSize: 10,
            fontWeight: "800",
          }}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

export default function Inbox() {
  const [tab, setTab] = useState<TabType>("messages");
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();
  const [unreadSupport, setUnreadSupport] = useState(0);

  useEffect(() => {
    getUnreadAdminMessageCount()
      .then(setUnreadSupport)
      .catch(console.error);
  }, [tab]);

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
          <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.CUSTOMER_CHAT_BUTTON} style={{ flex: 1 }}>
            <TabButton
              label="Messages"
              icon="chatbubble"
              isActive={tab === "messages"}
              onPress={() => setTab("messages")}
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
          />
        </View>
      </Animated.View>

      <View style={{ flex: 1 }}>
        {tab === "messages" && <MessagesListView role="customer" />}
        {tab === "support" && <SupportMessagesView />}
        {tab === "alerts" && <Notifications />}
      </View>
    </View>
  );
}
