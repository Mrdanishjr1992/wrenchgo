// app/(customer)/_layout.tsx
import React, { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useTheme } from "../../src/ui/theme-context";
import { supabase } from "../../src/lib/supabase";
import { TermsModal } from "../../components/legal/TermsModal";
import { useTerms } from "../../src/hooks/useTerms";

export default function CustomerLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const { checkTermsAccepted } = useTerms('customer');

  useEffect(() => {
    let mounted = true;

    const verifyRole = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          router.replace("/(auth)/sign-in");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          router.replace("/(auth)/sign-in");
          return;
        }

        const role = profile.role as string | null;

        if (!role) {
          router.replace("/(auth)/choose-role");
          return;
        }

        if (role !== "customer") {
          router.replace("/(mechanic)/(tabs)/leads");
          return;
        }

        // Check if platform terms are accepted
        const termsStatus = await checkTermsAccepted();
        if (termsStatus.requires_acceptance) {
          if (mounted) setShowTermsModal(true);
        }

        if (mounted) setChecking(false);
      } catch (error) {
        console.warn("Customer layout role check error:", error);
        if (mounted) setChecking(false);
      }
    };

    verifyRole();

    return () => {
      mounted = false;
    };
  }, [router, checkTermsAccepted]);

  const handleTermsAccepted = () => {
    setShowTermsModal(false);
  };

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <TermsModal
        visible={showTermsModal}
        role="customer"
        onAccepted={handleTermsAccepted}
        dismissable={false}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="education" />
        <Stack.Screen
          name="legal"
          options={{
            headerShown: true,
            title: "Legal",
          }}
        />

        <Stack.Screen name="request-service" />
        <Stack.Screen name="garage" />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="messages/[jobId]" />
        <Stack.Screen name="payment/[jobId]" />
      </Stack>
    </>
  );
}
