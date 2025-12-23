import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/ui/theme";

export default function Index() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        if (!userId) {
          router.replace("/(auth)/sign-in");
          return;
        }

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
    };

    run();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (!booting) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
