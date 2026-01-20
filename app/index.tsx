import React, { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, Image } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../src/lib/supabase";
import { AppButton } from "../src/ui/components/AppButton";
import { useTheme } from "../src/ui/theme-context";

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, text, spacing, radius } = useTheme();

  const [booting, setBooting] = useState(true);
  const bootingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      if (bootingRef.current) return;
      bootingRef.current = true;

      try {
        const { data: sessionData } = await supabase.auth.getSession();

        const user = sessionData.session?.user;

        if (!user) return;

        const { data: role } = await supabase.rpc("get_my_role");

        if (role) {
          const destination = role === "mechanic" ? "/(mechanic)/(tabs)/leads" : "/(customer)/(tabs)";
          router.replace(destination);
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileData?.role) {
          const destination = profileData.role === "mechanic" ? "/(mechanic)/(tabs)/leads" : "/(customer)/(tabs)";
          router.replace(destination);
          return;
        }

        if (profileData && profileData.role === null) {
          router.replace("/(auth)/choose-role");
          return;
        }

        if (!profileData) {
          const { error: insertErr } = await supabase
            .from("profiles")
            .upsert({
              id: user.id,
              email: user.email,
              role: "customer",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "id" });

          if (insertErr?.code === "23503") {
            await supabase.auth.signOut();
            return;
          }

          router.replace("/(customer)/(tabs)");
          return;
        }

        router.replace("/(customer)/(tabs)");
      } finally {
        bootingRef.current = false;
        if (mounted) setBooting(false);
      }
    };

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      if (mounted) setBooting(true);
      boot();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const features = [
    { icon: "flash-outline" as const, text: "Compare quotes fast" },
    { icon: "shield-checkmark-outline" as const, text: "Safer process (no contact until accepted)" },
    { icon: "chatbubbles-outline" as const, text: "Track jobs + Inbox" },
    { icon: "wallet-outline" as const, text: "Affordable and reliable services" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <View style={{ width: 160, height: 160, marginBottom: spacing.md }}>
            <Image
              source={require("../assets/wrench.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </View>
          <Text style={[text.title, { fontSize: 28, marginBottom: spacing.xs, textAlign: "center" }]}>
            Get quotes from trusted mechanics
          </Text>
          <Text style={[text.muted, { textAlign: "center" }]}>
            Book safely. Chat after acceptance.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={[text.section, { marginBottom: spacing.md }]}>Why WrenchGo?</Text>
          <View style={{ gap: spacing.md }}>
            {features.map((feature, index) => (
              <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: `${colors.primary}15`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={feature.icon} size={18} color={colors.primary} />
                </View>
                <Text style={[text.body, { flex: 1 }]}>{feature.text}</Text>
              </View>
            ))}
          </View>
          <Text
            onPress={() => router.push("/infopage")}
            style={{ color: colors.primary, fontWeight: "600", marginTop: spacing.md }}
          >
            Learn more
          </Text>
        </View>

        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          <AppButton
            title="Get started"
            onPress={() => router.replace("/(auth)/sign-up")}
            fullWidth
          />
          <AppButton
            title="Log in"
            variant="outline"
            onPress={() => router.replace("/(auth)/sign-in")}
            fullWidth
          />
        </View>

        <View style={{ alignItems: "center", marginTop: spacing.xl }}>
          <Text style={text.muted}>
            New to WrenchGo?{" "}
            <Text
              onPress={() => router.replace("/(auth)/sign-up")}
              style={{ color: colors.primary, fontWeight: "700" }}
            >
              Create an account
            </Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
