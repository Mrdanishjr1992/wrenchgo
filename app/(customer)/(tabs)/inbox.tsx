import React, { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { useTheme } from "../../../src/ui/theme-context";

import { MessagesListView } from "../../../components/inbox";
import Notifications from "./notifications";

export default function Inbox() {
  const [tab, setTab] = useState<"messages" | "alerts">("messages");
  const { colors, text, spacing } = useTheme();

  const isMessagesTab = tab === "messages";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          paddingTop: 54,
          paddingBottom: 16,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={[text.title, { fontSize: 28 }]}>Inbox</Text>

        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            backgroundColor: colors.bg,
            borderRadius: 12,
            padding: 4,
          }}
        >
          <Pressable
            onPress={() => setTab("messages")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: isMessagesTab ? colors.accent : "transparent",
            }}
          >
            <Text style={{ fontWeight: "700", color: isMessagesTab ? "#000" : colors.textMuted }}>
              Messages
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTab("alerts")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: !isMessagesTab ? colors.accent : "transparent",
            }}
          >
            <Text style={{ fontWeight: "700", color: !isMessagesTab ? "#000" : colors.textMuted }}>
              Notifications
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {isMessagesTab ? <MessagesListView role="customer" /> : <Notifications />}
      </View>
    </View>
  );
}