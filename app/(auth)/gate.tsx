import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import React from "react";

export default function Index() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;

        if (!userId) {
          router.replace("/(auth)/sign-in");
          return;
        }

        const { data: p } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        const role = p?.role;

        if (!role) {
          router.replace("/(auth)/choose-role");
          return;
        }

        router.replace(role === "mechanic" ? "/(mechanic)/(tabs)/leads" : "/(customer)/(tabs)");
      } catch (error) {
        router.replace("/(auth)/sign-in");
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
