import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Image } from "react-native";
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
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.xl,alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 100, marginBottom: spacing.xl}}> 404 </Text>
         {/* Buttons */}
        <AppButton
          title="Back"
          variant="primary"
          onPress={() => router.push("/")}
          style={{ width: 150, height:100}}
        />
    </View>
  );
}
