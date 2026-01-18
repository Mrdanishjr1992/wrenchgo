import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { supabase } from "../../src/lib/supabase";
import { TermsModal } from "../../components/legal/TermsModal";
import { useTerms } from "../../src/hooks/useTerms";

export default function MechanicLayout() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const { checkTermsAccepted } = useTerms('mechanic');

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
        .eq("id", session.user.id)
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

      // Check if platform terms are accepted
      const termsStatus = await checkTermsAccepted();
      if (termsStatus.requires_acceptance) {
        setShowTermsModal(true);
      }

      setAuthorized(true);
    } catch (e: any) {
      console.error("Auth check error:", e);
      router.replace("/(auth)/sign-in");
    } finally {
      setLoading(false);
    }
  }

  const handleTermsAccepted = () => {
    setShowTermsModal(false);
  };

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
    <>
      <TermsModal
        visible={showTermsModal}
        role="mechanic"
        onAccepted={handleTermsAccepted}
        dismissable={false}
      />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job-detail/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="job-details/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="quote-composer/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="quote-review" options={{ headerShown: false }} />
        <Stack.Screen name="quote-sent/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="messages/[jobId]" options={{ headerShown: false }} />
        <Stack.Screen name="earnings" options={{ headerShown: false }} />
        <Stack.Screen name="earnings/[jobId]" options={{ headerTitle: "Earnings" }} />

        <Stack.Screen name="payout-details/[jobId]" options={{ headerShown: false }} />
        <Stack.Screen name="stripe-onboarding/index" options={{ headerTitle: "Payout Setup" }} />
        <Stack.Screen name="legal" options={{ headerTitle: "Legal" }} />
      </Stack>
    </>
  );
}
