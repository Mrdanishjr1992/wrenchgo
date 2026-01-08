import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { LinearGradient } from "expo-linear-gradient";

export default function ResetPassword() {
  const router = useRouter();
  const { colors, text, spacing, radius } = useTheme();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = useMemo(() => {
    const p = password;
    if (!p) return { label: "", score: 0, color: colors.border };
    const hasLen = p.length >= 8;
    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasNum = /\d/.test(p);
    const hasSym = /[^A-Za-z0-9]/.test(p);
    const score = [hasLen, hasUpper, hasLower, hasNum, hasSym].filter(Boolean).length;
    
    if (score <= 2) return { label: "Weak", score, color: "#ef4444" };
    if (score === 3) return { label: "Fair", score, color: "#f59e0b" };
    if (score === 4) return { label: "Good", score, color: "#10b981" };
    return { label: "Strong", score, color: colors.accent };
  }, [password, colors]);

  const canSubmit = useMemo(() => {
    const pOk = password.length >= 6;
    const match = password.length > 0 && password === confirm;
    return !!hasRecoverySession && pOk && match && !loading;
  }, [password, confirm, loading, hasRecoverySession]);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasRecoverySession(!!data.session);
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasRecoverySession(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const updatePassword = async () => {
    try {
      if (!hasRecoverySession) {
        Alert.alert("Open the reset link", "Please open the password reset link from your email on this device.");
        return;
      }
      if (!password || password.length < 6) {
        Alert.alert("Weak password", "Use at least 6 characters.");
        return;
      }
      if (password !== confirm) {
        Alert.alert("Passwords don't match", "Please make sure both passwords are the same.");
        return;
      }

      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      Alert.alert("Password updated", "Your password has been changed. You can now sign in with your new password.");
      await supabase.auth.signOut();
      router.replace("/(auth)/sign-in");
    } catch (e: any) {
      Alert.alert("Update failed", e?.message ?? "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

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
            <Ionicons name="lock-closed-outline" size={56} color={colors.accent} />
          </View>
          <Text style={text.title}>Set new password</Text>
          <Text style={{ ...text.muted, textAlign: "center", marginTop: spacing.sm }}>
            {hasRecoverySession === false
              ? "Open the reset link from your email first"
              : "Create a strong password for your account"}
          </Text>
        </LinearGradient>

        {hasRecoverySession === false && (
          <View
            style={{
              margin: spacing.lg,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: "#fef3c7",
              borderWidth: 1,
              borderColor: "#f59e0b40",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Ionicons name="warning-outline" size={20} color="#d97706" />
              <Text style={{ ...text.body, flex: 1, color: "#92400e" }}>
                Please open the password reset link from your email on this device, then return here.
              </Text>
            </View>
          </View>
        )}

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Text style={{ ...text.muted, fontWeight: "600" }}>New password</Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <TextInput
                placeholder="Enter new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                editable={hasRecoverySession !== false}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={() => setShowPass((v) => !v)}
                hitSlop={10}
                style={{
                  padding: 12,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                }}
              >
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {password.length > 0 && (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      overflow: "hidden",
                      backgroundColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: `${(strength.score / 5) * 100}%`,
                        height: "100%",
                        backgroundColor: strength.color,
                      }}
                    />
                  </View>
                  <Text style={{ ...text.muted, fontWeight: "700", color: strength.color, minWidth: 50 }}>
                    {strength.label}
                  </Text>
                </View>
                <Text style={{ ...text.muted, fontSize: 12 }}>
                  Use 8+ characters with uppercase, numbers, and symbols
                </Text>
              </View>
            )}
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Text style={{ ...text.muted, fontWeight: "600" }}>Confirm password</Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <TextInput
                placeholder="Confirm new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirm}
                value={confirm}
                onChangeText={setConfirm}
                editable={hasRecoverySession !== false}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={10}
                style={{
                  padding: 12,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                }}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {confirm.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons
                  name={password === confirm ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={password === confirm ? "#10b981" : "#ef4444"}
                />
                <Text
                  style={{
                    ...text.muted,
                    fontWeight: "600",
                    color: password === confirm ? "#10b981" : "#ef4444",
                  }}
                >
                  {password === confirm ? "Passwords match" : "Passwords don't match"}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={updatePassword}
            disabled={!canSubmit}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              paddingVertical: 16,
              borderRadius: radius.md,
              alignItems: "center",
              opacity: canSubmit ? (pressed ? 0.8 : 1) : 0.5,
              marginTop: spacing.sm,
            })}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontWeight: "900", color: "#fff", fontSize: 16 }}>
                {hasRecoverySession === false ? "Open reset link first" : "Update password"}
              </Text>
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
