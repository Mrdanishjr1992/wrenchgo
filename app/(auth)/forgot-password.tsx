import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { AppButton } from "../../src/ui/components/AppButton";

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, text, radius } = useTheme();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }
    try {
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "wrenchgo://reset-password",
      });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      Alert.alert("Reset failed", e.message ?? "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: spacing.lg,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: `${colors.primary}15`,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.lg,
              }}
            >
              <Ionicons name="mail-outline" size={40} color={colors.primary} />
            </View>
            <Text style={[text.title, { fontSize: 24, textAlign: "center" }]}>Check your email</Text>
            <Text style={[text.muted, { textAlign: "center", marginTop: spacing.sm }]}>
              We sent a password reset link to
            </Text>
            <Text style={[text.body, { fontWeight: "700", color: colors.textPrimary, marginTop: 4 }]}>
              {email}
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
              <Text style={text.muted}>The link expires in 1 hour</Text>
            </View>

            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: `${colors.primary}10`,
                borderWidth: 1,
                borderColor: `${colors.primary}20`,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: spacing.sm,
              }}
            >
              <Ionicons name="bulb-outline" size={20} color={colors.primary} />
              <Text style={[text.muted, { flex: 1 }]}>
                If you don't see the email, check your spam folder.
              </Text>
            </View>

            <AppButton
              title="Resend email"
              onPress={handleReset}
              variant="secondary"
              loading={busy}
              fullWidth
            />

            <Pressable
              onPress={() => router.replace("/(auth)/sign-in")}
              style={{ alignSelf: "center", marginTop: spacing.md }}
            >
              <Text style={text.muted}>
                <Ionicons name="arrow-back" size={14} color={colors.textMuted} /> Back to{" "}
                <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: `${colors.primary}15`,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing.lg,
            }}
          >
            <Ionicons name="key-outline" size={40} color={colors.primary} />
          </View>
          <Text style={[text.title, { fontSize: 24 }]}>Reset password</Text>
          <Text style={[text.muted, { textAlign: "center", marginTop: spacing.sm }]}>
            Enter your email and we'll send you a link to reset your password
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={[text.muted, { fontWeight: "600", marginLeft: 4 }]}>Email address</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                fontSize: 16,
                color: colors.textPrimary,
              }}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
          </View>

          <AppButton
            title="Send reset link"
            onPress={handleReset}
            loading={busy}
            disabled={!email.trim()}
            fullWidth
          />

          <Pressable
            onPress={() => router.replace("/(auth)/sign-in")}
            style={{ alignSelf: "center", marginTop: spacing.md }}
          >
            <Text style={text.muted}>
              <Ionicons name="arrow-back" size={14} color={colors.textMuted} /> Back to{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
