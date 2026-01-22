import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/ui/theme-context";
import { AppButton } from "../src/ui/components/AppButton";

export default function AccountDeleted() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, text, spacing, radius } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: `${colors.primary}15`,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.lg,
          }}
        >
          <Ionicons name="checkmark-circle-outline" size={56} color={colors.primary} />
        </View>

        <Text style={[text.title, { fontSize: 24, textAlign: "center", marginBottom: spacing.sm }]}>
          Account Deleted
        </Text>

        <Text style={[text.muted, { textAlign: "center", marginBottom: spacing.xl }]}>
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
          <Text style={[text.muted, { textAlign: "center" }]}>
            Thank you for using WrenchGo. We hope to see you again!
          </Text>
        </View>

        <AppButton
          title="Back to Home"
          onPress={() => router.replace("/")}
          fullWidth
        />
      </ScrollView>
    </View>
  );
}
