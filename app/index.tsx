import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const redirect = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!session?.user) {
          router.replace("/(auth)/sign-in");
          return;
        }

        const userId = session.user.id;

        // Prefer reading role + service area from profiles, since the app
        // needs a hub/service ZIP before unlocking the main flows.
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, hub_id, service_zip, home_lat, home_lng")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) {
          console.error("Index profile load error", profileError);
          router.replace("/(auth)/choose-role");
          return;
        }

        const role = profile?.role ?? null;

        if (!role) {
          router.replace("/(auth)/choose-role");
          return;
        }
        // Require a service ZIP before unlocking the main app.
        // We intentionally use a *radius check* instead of `hub_id IS NULL` because
        // the backend may still assign the nearest hub even when the user is out-of-range
        // (so we can keep hub context for metrics / waitlist operations).
        if (!profile?.service_zip || profile.home_lat == null || profile.home_lng == null) {
          router.replace("/(auth)/service-area");
          return;
        }

        const { data: inRange, error: inRangeError } = await supabase.rpc("check_user_service_area", {
          p_user_id: userId,
        });

        if (!inRangeError && inRange === false) {
          router.replace("/(auth)/waitlist");
          return;
        }

        // Fallback for older accounts that may not have been assigned a hub yet.
        if (!profile?.hub_id) {
          router.replace("/(auth)/waitlist");
          return;
        }

        if (role === "admin") {
          router.replace("/(admin)");
        } else if (role === "mechanic") {
          router.replace("/(mechanic)");
        } else {
          router.replace("/(customer)");
        }
      } catch (e) {
        console.error("Index redirect error", e);
        router.replace("/(auth)/sign-in");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    redirect();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!loading) return null;

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
