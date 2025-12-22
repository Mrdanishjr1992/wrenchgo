import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { colors, spacing, text } from "../../src/ui/theme";
import { Image } from "react-native";

export default function signIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const signIn = async () => {
    setErr(null);
    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return setErr(error.message);
      router.replace("/"); // root layout will route by role
      // role routing happens in your root layout / auth listener
    } catch (e: any) {
      Alert.alert("Sign in failed", e.message);
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

      <Text style={{ ...text.muted, marginTop: 6 }}>
        Sign in to continue
      </Text>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
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
          placeholder="Password"
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
        <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
  <Text style={{ ...text.muted, textAlign: "right" }}>
    <Text style={{ color: colors.accent, fontWeight: "800" }}>Forgot password?</Text>
  </Text>
</Pressable>

        <Pressable
          onPress={signIn}
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
            <Text style={{ fontWeight: "900", color: "#000" }}>
              SIGN IN
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push("/(auth)/sign-up")}>
          <Text style={{ textAlign: "center", ...text.muted }}>
            Don’t have an account?{" "}
            <Text style={{ color: colors.accent, fontWeight: "800" }}>
              Sign up
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
