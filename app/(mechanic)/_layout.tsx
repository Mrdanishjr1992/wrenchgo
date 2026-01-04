import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { supabase } from "../../src/lib/supabase";

export default function MechanicLayout() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("auth_id", session.user.id)
        .single();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
        router.replace("/(auth)/sign-in");
        return;
      }

      if (!profile?.role) {
        router.replace("/(auth)/choose-role");
        return;
      }

      const roleStr = typeof profile.role === 'string' ? profile.role : String(profile.role);

      if (roleStr !== "mechanic") {
        router.replace("/(customer)/(tabs)");
        return;
      }

      setAuthorized(true);
    } catch (e: any) {
      console.error("Auth check error:", e);
      router.replace("/(auth)/sign-in");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, color: "#666" }}>Loading...</Text>
      </View>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="job/[id]" options={{ headerTitle: "" }} />
      <Stack.Screen name="quote-composer/[id]" options={{ headerTitle: "" }} />
      <Stack.Screen name="quote-review" options={{ headerTitle: "" }} />
      <Stack.Screen name="quote-sent/[id]" options={{ headerTitle: "" }} />
      <Stack.Screen name="messages/[jobId]" options={{ headerShown: false }} />
      <Stack.Screen name="earnings/[jobId]" options={{ headerTitle: "Earnings" }} />
      <Stack.Screen name="stripe-onboarding/index" options={{ headerTitle: "Payout Setup" }} />
      <Stack.Screen name="legal" options={{ headerTitle: "Legal" }} />
    </Stack>
  );
}