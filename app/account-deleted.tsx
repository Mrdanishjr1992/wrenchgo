import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/ui/theme-context";
import { LinearGradient } from "expo-linear-gradient";

export default function AccountDeleted() {
  const router = useRouter();
  const { colors, text, spacing, radius } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={[`${colors.accent}22`, `${colors.accent}00`]}
        style={{
          flex: 1,
          paddingHorizontal: spacing.lg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: `${colors.accent}15`,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.lg,
          }}
        >
          <Ionicons name="checkmark-circle-outline" size={64} color={colors.accent} />
        </View>

        <Text style={{ ...text.title, textAlign: "center", marginBottom: spacing.sm }}>
          Account Deleted
        </Text>

        <Text style={{ ...text.muted, textAlign: "center", marginBottom: spacing.xl }}>
          Your account has been successfully deleted.
        </Text>

        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.xl,
          }}
        >
          <Text style={{ ...text.muted, textAlign: "center" }}>
            Thank you for using WrenchGo. We hope to see you again!
          </Text>
        </View>

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => ({
            backgroundColor: colors.accent,
            paddingVertical: 16,
            paddingHorizontal: spacing.xl * 2,
            borderRadius: radius.md,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
            Back to Home
          </Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}
