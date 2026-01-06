import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { configureGoogleSignIn, signInWithGoogle } from "../../src/lib/googleAuth";

type AnyUser = any;

export default function SignIn() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rememberMe, setRememberMe] = useState(true);
  const [isGoogleAvailable, setIsGoogleAvailable] = useState(false);

  // ---------- helpers ----------
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const inputStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    }),
    [colors]
  );

  const isNewUser = async (authId: string) => {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !profile; // no profile row yet => brand new
};


  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && !loading;
  }, [email, password, loading]);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem("@saved_email");
      if (savedEmail) setEmail(savedEmail);
    } catch {
      // ignore
    }
  };

  /**
   * Ensures a profile row exists for this auth user and routes:
   * - role null -> choose-role
   * - role set  -> "/" (Index will route to correct tabs)
   */
  const ensureProfileAndRoute = async (user: AnyUser) => {
    const authId = user.id;

    // Use RPC to bypass RLS timing issues
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data: role, error } = await supabase.rpc("get_my_role");

      console.log(`[AUTH] get_my_role attempt ${attempt}`, { role, error });

      if (error) {
        console.warn("[AUTH] get_my_role error:", error.message);
        await sleep(250);
        continue;
      }

      if (role) {
        router.replace("/");
        return;
      }

      // Role is null but profile might exist - check if we need to create profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", authId)
        .maybeSingle();

      if (profile) {
        // Profile exists but role is null
        router.replace("/(auth)/choose-role");
        return;
      }

      await sleep(250);
    }

    // Still no profile -> insert minimal profile row (fallback)
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

    console.log("[AUTH] fallback insert profile err:", insErr);

    if (insErr && !insErr.message.includes("duplicate")) {
      throw new Error(insErr.message);
    }

    router.replace("/(auth)/choose-role");
  };

  // ---------- lifecycle ----------
  useEffect(() => {
    loadSavedCredentials();

    try {
      configureGoogleSignIn();
      setIsGoogleAvailable(true);
    } catch (error) {
      console.log("Google Sign-In not available (likely running in Expo Go):", error);
      setIsGoogleAvailable(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- email/password ----------
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
      console.error("Sign-in error:", e);
      setErr(e?.message ?? "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  // ---------- google ----------
 const handleGoogleSignIn = async (idToken: string) => {
  try {
    setErr(null);

    // Safe JWT decode for debug only (handles base64url + padding + missing atob)
    if (__DEV__) {
      try {
        const parts = idToken.split(".");
        if (parts.length >= 2) {
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

          const atobFn: ((s: string) => string) | undefined =
            // @ts-ignore
            typeof globalThis?.atob === "function" ? globalThis.atob : typeof atob === "function" ? atob : undefined;

          if (atobFn) {
            const decoded = atobFn(padded);

            // Convert binary string -> UTF-8 safely
            const json = decodeURIComponent(
              decoded
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
            );

            const payload = JSON.parse(json);
            console.log("🔍 ID Token Audience (aud):", payload?.aud);
            console.log("🔍 ID Token Issuer (iss):", payload?.iss);
            console.log("🔍 ID Token Email:", payload?.email);
          } else {
            console.log("ℹ️ atob not available in this runtime; skipping token decode");
          }
        } else {
          console.log("ℹ️ Token does not look like a JWT; skipping decode");
        }
      } catch (decodeErr) {
        console.warn("Could not decode token for debugging:", decodeErr);
      }
    }
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
        });

        console.log("🔎 signInWithIdToken result:", {
          hasSession: !!data?.session,
          hasUser: !!data?.user,
          error: error?.message,
        });

        if (error) {
          console.error("❌ Supabase signInWithIdToken error:", {
            message: error.message,
            status: (error as any)?.status,
            name: (error as any)?.name,
          });
          setErr(error.message);
          return;
        }

        const session = data?.session;
        const user = data?.user;

        if (!session || !user) {
          console.error("❌ Google sign-in missing session/user:", {
            hasSession: !!session,
            hasUser: !!user,
            userId: user?.id,
            userEmail: user?.email,
          });
          setErr("Google sign-in did not create a session. Check Supabase + Google config.");
          return;
        }

        console.log("✅ Google sign-in successful:", { userId: user.id, email: user.email });


        // remember email
        if (rememberMe) {
          await AsyncStorage.setItem("@saved_email", user.email || "");
        } else {
          await AsyncStorage.removeItem("@saved_email");
        }

        // If this is a brand-new user, go straight to choose-role.
        // Otherwise let ensureProfileAndRoute route them normally.
        const brandNew = await isNewUser(user.id);

        if (brandNew) {
          router.replace("/(auth)/choose-role");
          return;
        }

        await ensureProfileAndRoute(user);

      } catch (e: any) {
        console.error("❌ Google Sign-In error:", {
          message: e?.message,
          code: e?.code,
          name: e?.name,
        });

        Alert.alert("Google sign in failed", e?.message ?? "Try again.");
        setErr(e?.message ?? "Failed to sign in with Google");
      }
    };

  const onGoogleSignIn = async () => {
    setErr(null);
    setLoading(true);

    try {
      const res = await signInWithGoogle();
      const idToken = res?.idToken ?? null;

      if (res?.error) {
        console.error("❌ Google SDK error:", res.error);
        setErr(res.error);
        return;
      }

      if (!idToken) {
        console.error("❌ No ID token returned from Google");
        setErr("Failed to get ID token from Google");
        return;
      }

      console.log("✅ Got Google ID token, length:", idToken.length);
      await handleGoogleSignIn(idToken);
    } catch (e: any) {
      console.error("❌ Google Sign-In exception:", {
        message: e?.message,
        code: e?.code,
        statusCode: e?.statusCode,
      });
      setErr(e?.message ?? "Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  // ---------- UI ----------
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.bg }}>
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
              <Image source={require("../../assets/wave.png")} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
            </View>

            <Text style={{ ...text.title, marginTop: 10 }}>Welcome back</Text>
            <Text style={{ ...text.muted, marginTop: 6 }}>Log in to continue</Text>
          </View>
        </LinearGradient>

        <View style={{ padding: spacing.lg, gap: spacing.md, flex: 1, justifyContent: "flex-start" }}>
          {err && (
            <View
              style={{
                padding: spacing.md,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(239,68,68,0.45)",
                backgroundColor: "rgba(239,68,68,0.10)",
              }}
            >
              <Text style={{ color: "#ef4444", fontWeight: "900" }}>{err}</Text>
            </View>
          )}

          <View style={{ gap: 8 }}>
            <Text style={text.muted}>Email</Text>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={inputStyle}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={text.muted}>Password</Text>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={inputStyle}
            />
          </View>

          <Pressable
            onPress={() => setRememberMe((v) => !v)}
            hitSlop={10}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: rememberMe ? colors.accent : colors.border,
                backgroundColor: rememberMe ? colors.accent : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {rememberMe && <Text style={{ color: "#000", fontSize: 14, fontWeight: "900" }}>✓</Text>}
            </View>
            <Text style={{ ...text.body, fontSize: 14 }}>Remember me</Text>
          </Pressable>

          <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={10} style={{ alignSelf: "flex-end" }}>
            <Text style={{ color: colors.accent, fontWeight: "900" }}>Forgot password?</Text>
          </Pressable>

          <Pressable
            onPress={onSignIn}
            disabled={!canSubmit}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              paddingVertical: 16,
              borderRadius: 999,
              alignItems: "center",
              opacity: !canSubmit ? 0.55 : pressed ? 0.85 : 1,
            })}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: "900", color: "#fff", letterSpacing: 0.6 }}>LOG IN</Text>}
          </Pressable>

          {isGoogleAvailable && (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", marginVertical: spacing.md }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ ...text.muted, marginHorizontal: spacing.md, fontSize: 12 }}>OR</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>

              <Pressable
                onPress={onGoogleSignIn}
                disabled={loading}
                style={({ pressed }) => ({
                  backgroundColor: colors.surface,
                  paddingVertical: 16,
                  borderRadius: 999,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 12,
                  opacity: loading ? 0.55 : pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 20 }}>🔍</Text>
                <Text style={{ fontWeight: "900", color: colors.textPrimary, letterSpacing: 0.6 }}>Continue with Google</Text>
              </Pressable>
            </>
          )}

          <View style={{ alignItems: "center", marginTop: 6 }}>
            <Text style={text.muted}>
              Don't have an account?{" "}
              <Text onPress={() => router.replace("/(auth)/sign-up")} style={{ color: colors.accent, fontWeight: "900" }}>
                Create account
              </Text>
            </Text>
          </View>

          <View style={{ marginTop: spacing.lg, alignItems: "center" }}>
            <Text style={{ ...text.muted, fontSize: 12 }}>By continuing, you agree to our Terms & Privacy Policy.</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
