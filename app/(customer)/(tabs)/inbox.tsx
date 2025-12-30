import { useMemo, useState } from "react";
import { View, Pressable, Text } from "react-native";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import Messages from "./messages";
import Notifications from "./notifications";

export default function Inbox() {
  const [tab, setTab] = useState<"messages" | "alerts">("messages");
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const isMessagesTab = tab === "messages";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={["rgba(13,148,136,0.18)", "rgba(13,148,136,0.00)"]}
        style={{
          paddingTop: spacing.xl,
          paddingBottom: spacing.lg,
          paddingHorizontal: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ alignItems: "center", gap: spacing.xs }}>
          <Text style={[text.title, { fontSize: 28, fontWeight: "700" }]}>Inbox</Text>
          <Text style={[text.muted, { textAlign: "center", fontSize: 14, lineHeight: 20 }]}>
            Messages unlock after a quote is accepted.{"\n"}Alerts keep you updated on your jobs.
          </Text>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <View
            style={[
              card,
              {
                padding: 6,
                borderRadius: radius.md,
                flexDirection: "row",
                gap: 6,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Pressable
              onPress={() => setTab("messages")}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: radius.sm,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                backgroundColor: isMessagesTab ? colors.accent : "transparent",
              }}
            >
              <Ionicons
                name="chatbubbles"
                size={18}
                color={isMessagesTab ? "#000" : colors.textMuted}
              />
              <Text
                style={{
                  fontWeight: "900",
                  color: isMessagesTab ? "#000" : colors.textPrimary,
                }}
              >
                Messages
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setTab("alerts")}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: radius.sm,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                backgroundColor: !isMessagesTab ? colors.accent : "transparent",
              }}
            >
              <Ionicons
                name="notifications"
                size={18}
                color={!isMessagesTab ? "#000" : colors.textMuted}
              />
              <Text
                style={{
                  fontWeight: "900",
                  color: !isMessagesTab ? "#000" : colors.textPrimary,
                }}
              >
                Alerts
              </Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <View style={{ flex: 1 }}>
        {isMessagesTab ? <Messages /> : <Notifications />}
      </View>
    </View>
  );
}
