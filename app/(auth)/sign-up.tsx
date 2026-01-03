import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { LinearGradient } from "expo-linear-gradient";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function SignUp() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const emailClean = useMemo(() => email.trim(), [email]);
  const nameClean = useMemo(() => fullName.trim(), [fullName]);
  const canSubmit = useMemo(() => {
    return (
      !loading &&
      nameClean.length >= 2 &&
      isEmail(emailClean) &&
      password.length >= 6
    );
  }, [loading, nameClean, emailClean, password]);

  const inputStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      color: colors.textPrimary,
      backgroundColor: colors.bg,
    }),
    [colors]
  );

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

      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: emailClean,
        password,
        options: {
          data: {
            full_name: nameClean,
          },
        },
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
      console.error("Sign-up error:", e);
      setErr(e?.message ?? "Failed to create account");
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
          {/* Hero */}
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
                source={require("../../assets/checklist.png")}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>

            <Text style={{ ...text.title, fontSize: 26 }}>Join WrenchGo</Text>
            <Text style={{ ...text.muted, textAlign: "center", paddingHorizontal: spacing.md }}>
              Create your account and start getting help fast.
            </Text>
          </View>
        </LinearGradient>
        <View style={{ padding: spacing.lg, gap: spacing.md, flex: 1, justifyContent: "flex-start" }}>
          {/* Form card */}
          <View
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.surface,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              gap: spacing.md,
            }}
          >
            <View style={{ gap: 8 }}>
              <Text style={text.section}>Account details</Text>
              <Text style={text.muted}>
                Use a real email so you can recover your account later.
              </Text>
            </View>

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

            <View style={{ gap: 10 }}>
            <TextInput
              placeholder="Full name"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              returnKeyType="next"
              style={inputStyle}
            />

            <TextInput
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              style={inputStyle}
            />

            <TextInput
              placeholder="Password (min 6 chars)"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              style={inputStyle}
            />
          </View>

          {/* CTA */}
          <Pressable
            onPress={handleSignUp}
            disabled={!canSubmit}
            style={({ pressed }) => ({
              marginTop: 4,
              backgroundColor: colors.accent,
              paddingVertical: 16,
              borderRadius: 999,
              alignItems: "center",
              opacity: !canSubmit ? 0.55 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ fontWeight: "900", color: "#000" }}>CREATE ACCOUNT</Text>
            )}
          </Pressable>

          {/* Footer link */}
          <View style={{ alignItems: "center", marginTop: 6 }}>
            <Text style={{ ...text.muted, textAlign: "center" }}>
              Already have an account?
            </Text>
            <Pressable
              onPress={() => router.replace("/(auth)/sign-in")}
              hitSlop={10}
              style={({ pressed }) => ({
                marginTop: 8,
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: colors.accent, fontWeight: "900" }}>SIGN IN</Text>
            </Pressable>
          </View>
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
