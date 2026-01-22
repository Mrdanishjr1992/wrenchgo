import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { AppButton } from "../../src/ui/components/AppButton";
import { configureGoogleSignIn, signInWithGoogle } from "../../src/lib/googleAuth";

type AnyUser = any;

export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, text, spacing, radius } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [isGoogleAvailable, setIsGoogleAvailable] = useState(false);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && !loading;
  }, [email, password, loading]);

  const isNewUser = async (authId: string) => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return !profile;
  };

  const ensureProfileAndRoute = async (user: AnyUser) => {
    const authId = user.id;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data: role, error } = await supabase.rpc("get_my_role");
      if (error) {
        await sleep(250);
        continue;
      }
      if (role) {
        router.replace("/");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", authId)
        .maybeSingle();
      if (profile) {
        router.replace("/(auth)/choose-role");
        return;
      }
      await sleep(250);
    }
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      (user.email ? user.email.split("@")[0] : "User");
    const { error: insErr } = await supabase.from("profiles").insert({
      id: authId,
      email: user.email ?? null,
      full_name: fullName,
      role: null,
      updated_at: new Date().toISOString(),
    });
    if (insErr && !insErr.message.includes("duplicate")) {
      throw new Error(insErr.message);
    }
    router.replace("/(auth)/choose-role");
  };

  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem("@saved_email");
        if (savedEmail) setEmail(savedEmail);
      } catch {}
    };
    loadSavedCredentials();
    try {
      configureGoogleSignIn();
      setIsGoogleAvailable(true);
    } catch {
      setIsGoogleAvailable(false);
    }
  }, []);

  const onSignIn = async () => {
    setErr(null);
    const emailClean = email.trim().toLowerCase();
    if (!emailClean || !password) {
      setErr("Enter your email and password.");
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailClean,
        password,
      });
      if (error) {
        setErr(error.message);
        return;
      }
      const user = data.user;
      if (!user) {
        setErr("Signed in, but no user returned.");
        return;
      }
      if (rememberMe) {
        await AsyncStorage.setItem("@saved_email", emailClean);
      } else {
        await AsyncStorage.removeItem("@saved_email");
      }
      await ensureProfileAndRoute(user);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (idToken: string) => {
    try {
      setErr(null);
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
        setErr("Google sign-in did not create a session.");
        return;
      }
      if (rememberMe) {
        await AsyncStorage.setItem("@saved_email", user.email || "");
      } else {
        await AsyncStorage.removeItem("@saved_email");
      }
      const brandNew = await isNewUser(user.id);
      if (brandNew) {
        router.replace("/(auth)/choose-role");
        return;
      }
      await ensureProfileAndRoute(user);
    } catch (e: any) {
      Alert.alert("Google sign in failed", e?.message ?? "Try again.");
      setErr(e?.message ?? "Failed to sign in with Google");
    }
  };

  const onGoogleSignIn = async () => {
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
      await handleGoogleSignIn(idToken);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to sign in with Google");
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
              source={require("../../assets/wave.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: colors.textPrimary,
              marginBottom: spacing.xs,
              textAlign: "center",
            }}
          >
            Welcome back
          </Text>
          <Text style={[text.muted, { textAlign: "center" }]}>
            Sign in to continue to WrenchGo.
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
            <Text style={[text.muted, { fontWeight: "600", marginLeft: 4 }]}>Email</Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
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
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Pressable
              onPress={() => setRememberMe(!rememberMe)}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: rememberMe ? colors.primary : colors.border,
                  backgroundColor: rememberMe ? colors.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={text.body}>Remember me</Text>
            </Pressable>

            <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Forgot password?</Text>
            </Pressable>
          </View>

          <AppButton
            title="Sign In"
            onPress={onSignIn}
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
                title="Continue with Google"
                onPress={onGoogleSignIn}
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
            Don't have an account?{" "}
            <Text
              onPress={() => router.replace("/(auth)/sign-up")}
              style={{ color: colors.primary, fontWeight: "700" }}
            >
              Create account
            </Text>
          </Text>
        </View>

        <View style={{ alignItems: "center", marginTop: spacing.lg }}>
          <Text style={[text.muted, { fontSize: 12, textAlign: "center" }]}>
            By continuing, you agree to our Terms & Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
