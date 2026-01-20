import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { AppButton } from "../../src/ui/components/AppButton";
import { configureGoogleSignIn, signInWithGoogle } from "../../src/lib/googleAuth";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function SignUp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, text, spacing, radius } = useTheme();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isGoogleAvailable, setIsGoogleAvailable] = useState(false);

  useEffect(() => {
    try {
      configureGoogleSignIn();
      setIsGoogleAvailable(true);
    } catch {
      setIsGoogleAvailable(false);
    }
  }, []);

  const emailClean = useMemo(() => email.trim(), [email]);
  const nameClean = useMemo(() => fullName.trim(), [fullName]);
  const canSubmit = useMemo(() => {
    return (
      !loading &&
      nameClean.length >= 2 &&
      isEmail(emailClean) &&
      password.length >= 6 &&
      password === confirmPassword
    );
  }, [loading, nameClean, emailClean, password, confirmPassword]);

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
    return { label: "Strong", score, color: colors.primary };
  }, [password, colors]);

  const handleSignUp = async () => {
    try {
      setErr(null);
      if (!nameClean || !emailClean || !password) {
        setErr("Fill out all fields.");
        return;
      }
      if (!isEmail(emailClean)) {
        setErr("Enter a valid email address.");
        return;
      }
      if (password.length < 6) {
        setErr("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErr("Passwords do not match.");
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: emailClean,
        password,
        options: { data: { full_name: nameClean } },
      });
      if (error) {
        setErr(error.message);
        return;
      }
      const user = data.user;
      const session = data.session;
      if (!user) {
        setErr("Account created but no user returned. Please try signing in.");
        return;
      }
      if (!session) {
        Alert.alert(
          "Check your email",
          "We sent you a confirmation link. Please verify your email before signing in."
        );
        router.replace("/(auth)/sign-in");
        return;
      }
      router.replace("/(auth)/choose-role");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setErr(null);
    setGoogleLoading(true);
    try {
      const res = await signInWithGoogle();
      const idToken = res?.idToken ?? null;
      if (res?.error) {
        setErr(res.error);
        return;
      }
      if (!idToken) {
        setErr("Failed to get ID token from Google");
        return;
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (error) {
        setErr(error.message);
        return;
      }
      const session = data?.session;
      const user = data?.user;
      if (!session || !user) {
        setErr("Google sign-up did not create a session.");
        return;
      }
      router.replace("/(auth)/choose-role");
    } catch (e: any) {
      Alert.alert("Google sign up failed", e?.message ?? "Try again.");
      setErr(e?.message ?? "Failed to sign up with Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <View style={{ width: 140, height: 140, marginBottom: spacing.md }}>
            <Image
              source={require("../../assets/checklist.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </View>
          <Text style={[text.title, { fontSize: 28, marginBottom: spacing.xs }]}>Join WrenchGo</Text>
          <Text style={[text.muted, { textAlign: "center" }]}>
            Create your account and start getting help fast.
          </Text>
        </View>

        {err && (
          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: `${colors.error}15`,
              borderWidth: 1,
              borderColor: `${colors.error}30`,
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: colors.error, fontWeight: "600" }}>{err}</Text>
          </View>
        )}

        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={[text.muted, { fontWeight: "600", marginLeft: 4 }]}>Full Name</Text>
            <TextInput
              placeholder="John Doe"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                fontSize: 16,
              }}
            />
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text style={[text.muted, { fontWeight: "600", marginLeft: 4 }]}>Email</Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                fontSize: 16,
              }}
            />
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text style={[text.muted, { fontWeight: "600", marginLeft: 4 }]}>Password</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                placeholder="Min 6 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={{
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            {password.length > 0 && (
              <View style={{ gap: 4, marginTop: spacing.xs }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.border,
                      overflow: "hidden",
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
                  <Text style={{ fontSize: 12, fontWeight: "600", color: strength.color }}>
                    {strength.label}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text style={[text.muted, { fontWeight: "600", marginLeft: 4 }]}>Confirm Password</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                placeholder="Re-enter password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={() => setShowConfirm(!showConfirm)}
                style={{
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={{ color: colors.error, fontSize: 12, marginLeft: 4 }}>
                Passwords don't match
              </Text>
            )}
          </View>

          <AppButton
            title="Create Account"
            onPress={handleSignUp}
            loading={loading}
            disabled={!canSubmit}
            fullWidth
          />

          {isGoogleAvailable && (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", marginVertical: spacing.sm }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={[text.muted, { marginHorizontal: spacing.md, fontSize: 12 }]}>OR</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>

              <AppButton
                title="Sign up with Google"
                onPress={handleGoogleSignUp}
                variant="outline"
                loading={googleLoading}
                fullWidth
                leftIcon={<Ionicons name="logo-google" size={18} color={colors.primary} />}
              />
            </>
          )}
        </View>

        <View style={{ alignItems: "center", marginTop: spacing.xl }}>
          <Text style={text.muted}>
            Already have an account?{" "}
            <Text
              onPress={() => router.replace("/(auth)/sign-in")}
              style={{ color: colors.primary, fontWeight: "700" }}
            >
              Sign in
            </Text>
          </Text>
        </View>

        <View style={{ alignItems: "center", marginTop: spacing.lg }}>
          <Text style={[text.muted, { fontSize: 12, textAlign: "center" }]}>
            By creating an account, you agree to our Terms & Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
