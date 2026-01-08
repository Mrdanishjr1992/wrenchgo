import React, { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { spacing } from "../src/ui/theme";
import { createCard, cardPressed } from "../src/ui/styles";
import { AppButton } from "../src/ui/components/AppButton";
import { useTheme } from "../src/ui/theme-context";

export default function Index() {
  const router = useRouter();
  const { colors, text } = useTheme();
  const card = createCard(colors);

  const [booting, setBooting] = useState(true);
  const bootingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      if (bootingRef.current) return;
      bootingRef.current = true;

      try {
        const { data: sessionData, error: sErr } = await supabase.auth.getSession();
        if (sErr && __DEV__) console.warn("boot getSession error:", sErr);

        const user = sessionData.session?.user;

        if (!user) return;

        // Use RPC to bypass potential RLS timing issues
        const { data: role, error: roleErr } = await supabase.rpc("get_my_role");

        if (roleErr && __DEV__) {
          console.warn("boot get_my_role error:", roleErr);
        }

        if (!role) {
          // Fallback: try direct profile query
          const { data: profileData } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (profileData?.role) {
            router.replace(profileData.role === "mechanic" ? "/(mechanic)/(tabs)/leads" : "/(customer)/(tabs)");
            return;
          }

          router.replace("/(auth)/choose-role");
          return;
        }

        router.replace(role === "mechanic" ? "/(mechanic)/(tabs)/leads" : "/(customer)/(tabs)");
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

  // Landing screen (only shows when NOT signed in)
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: 40,
        }}
      >
        <View style={{ justifyContent: "center", gap: spacing.xl }}>
          <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
            <View
              style={{
                width: 220,
                height: 220,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={require("../assets/wrench.png")}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>

            <Text style={[text.muted, { textAlign: "center" }]}>
              Get quotes from trusted mechanics. Book safely. Chat after acceptance.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/infopage")}
            style={({ pressed }) => [
              card,
              pressed && cardPressed,
              {
                padding: spacing.lg,
                marginBottom: spacing.md,
                overflow: "hidden",
                position: "relative",
                paddingRight: 120,
              },
            ]}
          >
            <Text style={text.section}>Why WrenchGo?</Text>
            <Text style={[text.body, { marginTop: 10 }]}>• Compare quotes fast</Text>
            <Text style={[text.body, { marginTop: 6 }]}>• Safer process (no contact until accepted)</Text>
            <Text style={[text.body, { marginTop: 6 }]}>• Track jobs + Inbox</Text>
            <Text style={[text.body, { marginTop: 6 }]}>• Affordable and reliable services</Text>
            <Text style={[text.title, { marginTop: 6, color: colors.accent }]}>Click For More Info</Text>

            <Image
              source={require("../assets/peaking.png")}
              style={{
                position: "absolute",
                right: -18,
                top: 10,
                width: 150,
                height: 150,
                resizeMode: "contain",
              }}
            />
          </Pressable>

          <AppButton title="Get started" variant="primary" onPress={() => router.replace("/(auth)/sign-up")} />
          <AppButton
            title="Log in"
            variant="outline"
            onPress={() => router.replace("/(auth)/sign-in")}
            style={{ marginTop: spacing.md }}
          />
          <AppButton
            title="New to WrenchGo? Create an account"
            variant="link"
            onPress={() => router.replace("/(auth)/sign-up")}
          />
        </View>
      </ScrollView>
    </View>
  );
}
