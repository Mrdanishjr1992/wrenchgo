import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { colors, spacing, text } from "../../src/ui/theme";
import { Image } from "react-native";


export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // When user opens the reset link, Supabase sets a recovery session.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Optional: you can show a message when PASSWORD_RECOVERY fires
      // console.log("AUTH EVENT:", event);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const updatePassword = async () => {
    try {
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

      <Text style={text.title}>Set a new password</Text>
      <Text style={{ ...text.muted, marginTop: 6 }}>
        Enter your new password below.
      </Text>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <TextInput
          placeholder="New password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 14,
            color: colors.textPrimary,
          }}
        />

        <TextInput
          placeholder="Confirm new password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 14,
            color: colors.textPrimary,
          }}
        />

        <Pressable
          onPress={updatePassword}
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
            <Text style={{ fontWeight: "900", color: "#000" }}>UPDATE PASSWORD</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
