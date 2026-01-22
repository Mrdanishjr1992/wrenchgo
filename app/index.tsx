import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import React from "react";

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const { data, error } = await supabase.rpc("get_app_entry_state");

        if (!mounted) return;

        if (error || !data) {
          console.error("Entry RPC error", error);
          router.replace("/(auth)/sign-in");
          return;
        }

        switch (data.status) {
          case "unauthenticated":
            router.replace("/(auth)/sign-in");
            break;

          case "needs_role":
            router.replace("/(auth)/choose-role");
            break;

          case "needs_service_area":
            router.replace("/(auth)/service-area");
            break;

          case "waitlisted":
            router.replace("/(auth)/waitlist");
            break;

          case "ready":
            if (data.role === "admin") {
              router.replace("/(admin)");
            } else if (data.role === "mechanic") {
              router.replace("/(mechanic)");
            } else {
              router.replace("/(customer)");
            }
            break;

          default:
            router.replace("/(auth)/sign-in");
        }
      } catch (err) {
        console.error("Index redirect error", err);
        router.replace("/(auth)/sign-in");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (!loading) return null;

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
