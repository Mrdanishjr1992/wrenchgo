import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView, Image } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { colors, spacing, text } from "../src/ui/theme";
import { card } from "../src/ui/styles";
import { AppButton } from "../src/ui/components/AppButton";

export default function Index() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;

        // ✅ Not signed in → show landing
        if (!userId) return;

        // ✅ Signed in → route by role
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
      <ScrollView contentContainerStyle={{backgroundColor: colors.bg, padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}>
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl, justifyContent: "center" }}>
      {/* Hero */}
      <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <View style={{ width: 260, height: 260, borderRadius: 24, alignItems: "center", justifyContent: "center" }}>
          <Image
            source={require("../assets/logo.png")}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>
        <Text style={[text.muted, {textAlign: "center" }]}>
          Get quotes from trusted mechanics. Book safely. Chat after acceptance.
        </Text>
      </View>

      {/* Value props */}
      <View style={[card, { padding: spacing.md, marginBottom: spacing.md }]}>
        <Text style={ text.section}>Why WrenchGo?</Text>
        <Text style={[text.body, { marginTop: 10 }]}>• Compare quotes fast</Text>
        <Text style={[text.body, { marginTop: 6 }]}>• Safer process (no contact until accepted)</Text>
        <Text style={[text.body, { marginTop: 6 }]}>• Track jobs + Inbox</Text>
        <AppButton
          title="Click For More Info"
          variant="link"
          onPress={() => router.push("./404")}
        />
      </View>

         {/* Buttons */}
        <AppButton
          title="Get started"
          variant="primary"
          onPress={() => router.push("/(auth)/sign-up")}
        />

        <AppButton
          title="Log in"
          variant="outline"
          onPress={() => router.push("/(auth)/sign-in")}
          style={{ marginTop: spacing.md }}
        />
        <AppButton
          title="New to WrenchGo? Create an account"
          variant="link"
          onPress={() => router.push("/(auth)/sign-up")}
        />

    </View>
      </ScrollView>
  );
}
