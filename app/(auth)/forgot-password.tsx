/* eslint-disable react/no-unescaped-entities */
import { useState } from "react";
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
  const { colors, spacing, text } = useTheme();
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
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: spacing.xl,
            paddingTop: spacing.xl,
            justifyContent: "center",
          }}
        >
        <LinearGradient
          colors={["rgba(13,148,136,0.22)", "rgba(13,148,136,0.00)"]}
          style={{
            paddingTop: spacing.xl,
            paddingBottom: spacing.lg,
            paddingHorizontal: spacing.lg,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 220,
                height: 220,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <Image
                source={require("../../assets/forgot.png")}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
              </View>
              <Text style={text.title}>Check your email</Text>
              <Text style={text.muted}>
                We sent a password reset link to 
                <Text style={{ fontWeight: "900" }}>{email}</Text>
              </Text>
            
            </View>
            </LinearGradient>

            <View>
              <Pressable
                onPress={handleReset}
                style={{
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: spacing.md,
                }}
              >
                <Text style={{ ...text.body, fontWeight: "900" }}>Resend email</Text>
              </Pressable>

              <Text
                style={{
                  textAlign: "center",
                  color: colors.textMuted,
                  fontSize: 13,
                }}
              >
                Didn't receive it?
              </Text>
            </View>

            <View
              style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ ...text.muted, textAlign: "center" }}>
                The link expires in 1 hour. If you don't see the email, check your spam folder.
              </Text>
            </View>

            <View
              style={{
                marginTop: 4,
                padding: 12,
                borderRadius: 14,
                backgroundColor: "rgba(13,148,136,0.08)",
                borderWidth: 1,
                borderColor: "rgba(13,148,136,0.18)",
              }}
            >
              <Text style={{ ...text.muted }}>
                Tip: If you don't see it, check Spam/Junk. Some email apps take a minute to deliver.
              </Text>
            </View>

          <Pressable onPress={() => router.replace("/(auth)/sign-in")} hitSlop={10}>
            <Text style={{ textAlign: "center", ...text.muted }}>
              ← Back to{" "}
              <Text style={{ color: colors.accent, fontWeight: "900" }}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.bg }}
      >
      <LinearGradient
          colors={["rgba(13,148,136,0.22)", "rgba(13,148,136,0.00)"]}
          style={{
            paddingTop: spacing.xl,
            paddingBottom: spacing.lg,
            paddingHorizontal: spacing.lg,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 220,
                height: 220,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <Image
                source={require("../../assets/forgot.png")}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
              </View>
            <View >
            <Text style={text.title}>Reset password</Text>
            <Text style={text.muted}>Enter your email to receive a reset link</Text>
          </View>
          </View>
            </LinearGradient>
          <View>
            <View style={{ padding: spacing.lg, gap: spacing.md, flex: 1, justifyContent: "flex-start" }}>
            <Text style={{ ...text.body, marginBottom: spacing.sm, fontWeight: "600" }}>Email</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: spacing.md,
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
          

          <Pressable
            onPress={handleReset}
            disabled={busy}
            style={{
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderRadius: 14,
              backgroundColor: busy ? colors.border : colors.accent,
              alignItems: "center",
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Send reset link</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace("/(auth)/sign-in")} hitSlop={10}>
            <Text style={{ textAlign: "center", ...text.muted }}>
              ← Back to{" "}
              <Text style={{ color: colors.accent, fontWeight: "900" }}>Sign in</Text>
            </Text>
          </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
