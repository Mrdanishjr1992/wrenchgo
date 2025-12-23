import React, { useState } from "react";
import { View,
Text, 
TextInput, 
Pressable, 
Alert, 
ActivityIndicator, 
Image,
ScrollView,
KeyboardAvoidingView,
Platform,} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { colors, spacing, text } from "../../src/ui/theme";
import { card } from "../../src/ui/styles";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSignIn = async () => {
    setErr(null);
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setErr(error.message);

      // ✅ If "/" auto-routes signed-in users by role, keep this:
      router.replace("/");

      // If "/" is pure landing with NO redirect logic, use instead:
      // router.replace("/(auth)/gate");
    } catch (e: any) {
      Alert.alert("Sign in failed", e?.message ?? "Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
    <ScrollView contentContainerStyle={{ backgroundColor: colors.bg}}>
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" }}>
      {/* Logo + Title */}
      <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <View style={{ width: 260, height: 260, borderRadius: 24, alignItems: "center", justifyContent: "center" }}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>
        <Text style={{ ...text.muted, marginTop: 6 }}>Log in to continue</Text>
      </View>

      {/* Form */}
      <View style={{ gap: spacing.md }}>
        {err ? (
          <View style={[card, { padding: spacing.md, borderColor: "rgba(239,68,68,0.45)" }]}>
            <Text style={{ color: "#ef4444", fontWeight: "800" }}>{err}</Text>
          </View>
        ) : null}

        <TextInput
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 14,
            color: colors.textPrimary,
            backgroundColor: colors.surface,
          }}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 14,
            color: colors.textPrimary,
            backgroundColor: colors.surface,
          }}
        />

        <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={10} style={{ alignSelf: "flex-end" }}>
          <Text style={{ color: colors.accent, fontWeight: "900" }}>Forgot password?</Text>
        </Pressable>

        {/* Primary CTA */}
        <Pressable
          onPress={onSignIn}
          disabled={loading}
          style={{
            backgroundColor: colors.accent, // hims-style: black primary
            paddingVertical: 16,
            borderRadius: 999,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: "900", color: "#fff" }}>LOG IN</Text>}
        </Pressable>
         {/* Secondary CTA */}
        <Text style={{ gap: spacing.md, textAlign: "center", ...text.muted }}>
        Dont have an account?{" "}
        <Pressable onPress={() => router.replace("/(auth)/sign-up")}>
            <Text style={{ marginLeft: spacing.lg, marginTop: spacing.md, color: colors.accent, fontWeight: "500" }}>Create account</Text>
        </Pressable>
        </Text> 
      </View>

    </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
