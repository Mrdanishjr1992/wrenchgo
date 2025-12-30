import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { spacing } from "../src/ui/theme";
import { createCard, cardPressed } from "../src/ui/styles";
import { AppButton } from "../src/ui/components/AppButton";
import { useTheme } from "../src/ui/theme-context";
import React from "react";

export default function Index() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);

  const { colors, text } = useTheme();
  const card = createCard(colors);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;

        if (!userId) return;

        const { data: p } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        const role = p?.role ?? "customer";
        router.replace(role === "mechanic" ? "/(mechanic)/(tabs)/leads" : "/(customer)/(tabs)");
      } finally {
        if (mounted) setBooting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

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
                source={require("../assets/WrenchGo.png")}
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
            <Text style={[text.body, { marginTop: 6 }]}>
              • Safer process (no contact until accepted)
            </Text>
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

          <AppButton
            title="Get started"
            variant="primary"
            onPress={() => router.replace("/(auth)/sign-up")}
          />
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
