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
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function ResetPassword() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = useMemo(() => {
    const p = password;
    if (!p) return { label: "—", score: 0 };
    const hasLen = p.length >= 8;
    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasNum = /\d/.test(p);
    const hasSym = /[^A-Za-z0-9]/.test(p);
    const score = [hasLen, hasUpper, hasLower, hasNum, hasSym].filter(Boolean).length;
    const label = score <= 2 ? "Weak" : score === 3 ? "Okay" : score === 4 ? "Good" : "Strong";
    return { label, score };
  }, [password]);

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
        Alert.alert("Doesn't match", "Passwords do not match.");
        return;
      }

      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      Alert.alert("Password updated", "You can now sign in.");
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
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
        <LinearGradient
          colors={["rgba(59,130,246,0.16)", "rgba(59,130,246,0.02)", "rgba(0,0,0,0)"]}
          style={{
            borderRadius: 24,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            overflow: "hidden",
          }}
        >
          <View style={{ alignItems: "center" }}>
            <View style={{ width: 190, height: 190, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
              <Image
                source={require("../../assets/wave.png")}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>
            <Text style={{ ...text.title, marginTop: spacing.sm }}>Set a new password</Text>
            <Text style={{ ...text.muted, marginTop: 6, textAlign: "center" }}>
              {hasRecoverySession === false
                ? "Open the reset link from your email on this device, then come back here."
                : "Enter your new password below."}
            </Text>
          </View>
        </LinearGradient>

        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              padding: spacing.md,
              gap: 10,
            }}
          >
            <Text style={text.section}>New password</Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <TextInput
                placeholder="New password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                }}
              />
              <Pressable
                onPress={() => setShowPass((v) => !v)}
                hitSlop={10}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.textPrimary }}>{showPass ? "HIDE" : "SHOW"}</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, height: 10, borderRadius: 999, overflow: "hidden", backgroundColor: colors.bg }}>
                <View
                  style={{
                    width: `${(strength.score / 5) * 100}%`,
                    height: "100%",
                    backgroundColor: colors.accent,
                  }}
                />
              </View>
              <Text style={{ ...text.muted, fontWeight: "800" }}>{strength.label}</Text>
            </View>

            <Text style={text.muted}>Tip: 8+ chars with a number and symbol is best.</Text>
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              padding: spacing.md,
              gap: 10,
            }}
          >
            <Text style={text.section}>Confirm password</Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <TextInput
                placeholder="Confirm new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirm}
                value={confirm}
                onChangeText={setConfirm}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                }}
              />
              <Pressable
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={10}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.textPrimary }}>{showConfirm ? "HIDE" : "SHOW"}</Text>
              </Pressable>
            </View>

            {confirm.length > 0 ? (
              <Text style={{ ...text.muted, fontWeight: "800", color: password === confirm ? colors.success : "#ef4444" }}>
                {password === confirm ? "Passwords match ✓" : "Passwords don't match"}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={updatePassword}
            disabled={!canSubmit}
            style={{
              backgroundColor: colors.accent,
              paddingVertical: 16,
              borderRadius: 18,
              alignItems: "center",
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontWeight: "900", color: "#fff" }}>
                {hasRecoverySession === false ? "OPEN RESET LINK FIRST" : "UPDATE PASSWORD"}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace("/(auth)/sign-in")} hitSlop={10} style={{ alignSelf: "center" }}>
            <Text style={{ ...text.muted }}>
              Back to <Text style={{ color: colors.accent, fontWeight: "900" }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
