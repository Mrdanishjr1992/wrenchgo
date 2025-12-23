import { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { colors, spacing, text } from "../../../src/ui/theme";
import Messages from "./messages"; // reuse your existing screen
import Notifications from "./notifications"; // reuse existing alerts screen

export default function Inbox() {
  const [tab, setTab] = useState<"messages" | "alerts">("messages");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Segmented control */}
      <View
        style={{
          flexDirection: "row",
          margin: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <Pressable
          onPress={() => setTab("messages")}
          style={{
            flex: 1,
            paddingVertical: 12,
            backgroundColor: tab === "messages" ? colors.accent : "transparent",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "900", color: tab === "messages" ? "#fff" : colors.text }}>
            Messages
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setTab("alerts")}
          style={{
            flex: 1,
            paddingVertical: 12,
            backgroundColor: tab === "alerts" ? colors.accent : "transparent",
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "900", color: tab === "alerts" ? "#fff" : colors.text }}>
            Alerts
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === "messages" ? <Messages /> : <Notifications />}
      </View>
    </View>
  );
}
