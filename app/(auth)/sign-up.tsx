import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { colors, spacing, text } from "../../src/ui/theme";
import { Image } from "react-native";

type Role = "customer" | "mechanic";

export default function SignUp() {
  const router = useRouter();

  // ✅ hooks ONLY here (top-level)
  const [role, setRole] = useState<Role>("customer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ handler has NO hooks
  const handleSignUp = async () => {
    try {
      setLoading(true);

      if (!fullName.trim() || !email.trim() || !password) {
        Alert.alert("Missing info", "Fill out all fields.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error("User not created");

      const { error: pErr } = await supabase.from("profiles").insert({
        id: userId,
        full_name: fullName.trim(),
        role,
      });
      if (pErr) throw pErr;

      Alert.alert("Account created", "You can now sign in.");
      router.replace("/(auth)/sign-in");
    } catch (e: any) {
      Alert.alert("Sign up failed", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{backgroundColor: colors.bg, padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}>
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
    <Text style={{ ...text.muted}}>Join WrenchGo</Text>
</View>

      <Text style={{ ...text.muted, marginTop: 6 }}>Create your account</Text>



      <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.lg }}>
        {(["customer", "mechanic"] as Role[]).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRole(r)}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: role === r ? colors.accent : colors.border,
              backgroundColor: role === r ? colors.accent + "22" : colors.surface,
              alignItems: "center",
            }}
          >
            <Text style={{ fontWeight: "800", color: colors.textPrimary }}>
              {r.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <TextInput
          placeholder="Full name"
          placeholderTextColor={colors.textMuted}
          value={fullName}
          onChangeText={setFullName}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 14,
            color: colors.textPrimary,
          }}
        />

        <TextInput
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
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

        <TextInput
          placeholder="Password (min 6 chars)"
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

        <Pressable
          onPress={handleSignUp}
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
            <Text style={{ fontWeight: "900", color: "#000" }}>CREATE ACCOUNT</Text>
          )}
        </Pressable>

       
          <Text style={{ gap: spacing.md, textAlign: "center", ...text.muted }}>
            Already have an account?{" "}
            <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
             <Text style={{ marginLeft: spacing.lg, marginTop: spacing.md, color: colors.accent, fontWeight: "500" }}>Sign in</Text>
            </Pressable>
          </Text>

      </View>
    </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
