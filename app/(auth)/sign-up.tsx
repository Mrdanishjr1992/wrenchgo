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

type Role = "customer" | "mechanic";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function SignUp() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const [role, setRole] = useState<Role>("customer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

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

  const handleSignUp = async () => {
  try {
    if (!nameClean || !emailClean || !password) {
      Alert.alert("Missing info", "Fill out all fields.");
      return;
    }
    if (!isEmail(emailClean)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: emailClean,
      password,
      options: {
        data: {
          full_name: nameClean,
          role: role,
        },
      },
    });

    if (error) throw error;

    // In many setups user may need email confirmation; still send them to sign-in
    Alert.alert("Account created", "You can now sign in.");
    router.replace("/(auth)/sign-in");
  } catch (e: any) {
    Alert.alert("Sign up failed", e?.message ?? "Unknown error");
  } finally {
    setLoading(false);
  }
};


  const RolePill = ({ r }: { r: Role }) => {
    const active = role === r;
    return (
      <Pressable
        onPress={() => setRole(r)}
        style={({ pressed }) => ({
          flex: 1,
          paddingVertical: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? colors.accent + "22" : colors.surface,
          alignItems: "center",
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Text style={{ fontWeight: "900", color: colors.textPrimary }}>
          {r === "customer" ? "CUSTOMER" : "MECHANIC"}
        </Text>
        <Text style={{ marginTop: 4, ...text.muted }}>
          {r === "customer" ? "Request service" : "Offer service"}
        </Text>
      </Pressable>
    );
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
        {/* Role */}
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Text style={text.section}>I am a…</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <RolePill r="customer" />
            <RolePill r="mechanic" />
          </View>
        </View>
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

          <View style={{ gap: 10 }}>
            <TextInput
              placeholder="Full name"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              returnKeyType="next"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 14,
                color: colors.textPrimary,
                backgroundColor: colors.bg,
              }}
            />

            <TextInput
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 14,
                color: colors.textPrimary,
                backgroundColor: colors.bg,
              }}
            />

            <TextInput
              placeholder="Password (min 6 chars)"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 14,
                color: colors.textPrimary,
                backgroundColor: colors.bg,
              }}
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
