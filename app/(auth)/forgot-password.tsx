import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { LinearGradient } from "expo-linear-gradient";

export default function ForgotPassword() {
  const router = useRouter();
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
            padding: spacing.lg,
          }}
        >
          <LinearGradient
            colors={[`${colors.accent}22`, `${colors.accent}00`]}
            style={{
              borderRadius: radius.lg,
              padding: spacing.lg,
              alignItems: "center",
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
              <Ionicons name="mail-outline" size={56} color={colors.accent} />
            </View>
            <Text style={{ ...text.title, textAlign: "center" }}>Check your email</Text>
            <Text style={{ ...text.muted, textAlign: "center", marginTop: spacing.sm }}>
              We sent a password reset link to
            </Text>
            <Text style={{ ...text.body, fontWeight: "700", color: colors.textPrimary, marginTop: 4 }}>
              {email}
            </Text>
          </LinearGradient>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                <Text style={text.muted}>The link expires in 1 hour</Text>
              </View>
            </View>

            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: `${colors.accent}10`,
                borderWidth: 1,
                borderColor: `${colors.accent}20`,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <Ionicons name="bulb-outline" size={20} color={colors.accent} />
                <Text style={{ ...text.muted, flex: 1 }}>
                  If you don't see the email, check your spam folder. Some email providers take a minute to deliver.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleReset}
              disabled={busy}
              style={({ pressed }) => ({
                paddingVertical: 14,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {busy ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={{ ...text.body, fontWeight: "700" }}>Resend email</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.replace("/(auth)/sign-in")}
              hitSlop={10}
              style={{ marginTop: spacing.md }}
            >
              <Text style={{ textAlign: "center", ...text.muted }}>
                <Ionicons name="arrow-back" size={14} color={colors.textMuted} /> Back to{" "}
                <Text style={{ color: colors.accent, fontWeight: "700" }}>Sign in</Text>
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
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <LinearGradient
          colors={[`${colors.accent}22`, `${colors.accent}00`]}
          style={{
            paddingTop: spacing.xl * 2,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.lg,
            alignItems: "center",
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
            <Ionicons name="key-outline" size={56} color={colors.accent} />
          </View>
          <Text style={text.title}>Reset password</Text>
          <Text style={{ ...text.muted, textAlign: "center", marginTop: spacing.sm }}>
            Enter your email and we'll send you a link to reset your password
          </Text>
        </LinearGradient>

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...text.muted, fontWeight: "600", marginBottom: 4 }}>Email address</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: 14,
                fontSize: 16,
                color: colors.textPrimary,
              }}
              placeholder="your@email.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
          </View>

          <Pressable
            onPress={handleReset}
            disabled={busy || !email.trim()}
            style={({ pressed }) => ({
              paddingVertical: 16,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.md,
              backgroundColor: colors.accent,
              alignItems: "center",
              opacity: busy || !email.trim() ? 0.6 : pressed ? 0.8 : 1,
              marginTop: spacing.sm,
            })}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Send reset link</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace("/(auth)/sign-in")}
            hitSlop={10}
            style={{ marginTop: spacing.md }}
          >
            <Text style={{ textAlign: "center", ...text.muted }}>
              <Ionicons name="arrow-back" size={14} color={colors.textMuted} /> Back to{" "}
              <Text style={{ color: colors.accent, fontWeight: "700" }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
