import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "../../src/lib/supabase";
import { colors, spacing, text } from "../../src/ui/theme";
import { Image } from "react-native";


export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const sendReset = async () => {
    try {
      setLoading(true);

      const redirectTo = Linking.createURL("/(auth)/reset-password");

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) throw error;

      Alert.alert(
        "Email sent",
        "Check your email for the password reset link. Open it on this device."
      );
      router.replace("/(auth)/sign-in");
    } catch (e: any) {
      Alert.alert("Reset failed", e?.message ?? "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
    <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
<View
  style={{
    width: 280,
    height: 280,
    borderRadius: 20,
    //backgroundColor: "transparent", // 🔑 important
    alignItems: "center",
    justifyContent: "center",
  }}
>
  <Image
    source={require("../../assets/logo.png")}
    style={{
      width: "100%",
      height: "100%",
    }}
    resizeMode="contain"
  />
</View>

  <Text style={{ ...text.title, marginTop: spacing.md }}>WrenchGo</Text>
  <Text style={{ ...text.muted, marginTop: 6 }}>Sign in to continue</Text>
</View>

      <Text style={text.title}>Forgot password</Text>
      <Text style={{ ...text.muted, marginTop: 6 }}>
        We’ll email you a reset link.
      </Text>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
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
            borderRadius: 14,
            padding: 14,
            color: colors.textPrimary,
          }}
        />

        <Pressable
          onPress={sendReset}
          disabled={loading}
          style={{
            backgroundColor: colors.accent,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ fontWeight: "900", color: "#000" }}>SEND RESET LINK</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
          <Text style={{ textAlign: "center", ...text.muted }}>
            Back to{" "}
            <Text style={{ color: colors.accent, fontWeight: "800" }}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
