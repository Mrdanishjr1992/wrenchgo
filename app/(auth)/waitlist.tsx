import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { AppButton } from "../../src/ui/components/AppButton";

type HubInfo = {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  zip?: string;
  active_radius_miles?: number;
  max_radius_miles?: number;
  lat?: number;
  lng?: number;
};

type NearestHubResult = {
  id: string;
  name: string;
  slug: string;
  zip: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  active_radius_miles: number;
  max_radius_miles: number;
  within_active_radius: boolean;
  within_max_radius: boolean;
  distance_miles: number;
  boundary_status: string;
};

type WaitlistRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  zip: string | null;
  city: string | null;
  state: string | null;
  user_type: string | null;
  hub_id: string | null;
  status: string | null;
  created_at: string;
  invited_at: string | null;
  accepted_at: string | null;
};

export default function WaitlistScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [nearest, setNearest] = useState<NearestHubResult | null>(null);
  const [waitlistRow, setWaitlistRow] = useState<WaitlistRow | null>(null);

  const canTryAgain = useMemo(() => Boolean(profile?.service_lat && profile?.service_lng && profile?.service_zip), [profile]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData?.user?.email) {
          router.replace("/(auth)/sign-in");
          return;
        }

        const userEmail = userData.user.email;
        if (!cancelled) setEmail(userEmail);

        // Get profile service coords
        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("id, role, full_name, service_zip, service_lat, service_lng, hub_id")
          .eq("id", userData.user.id)
          .single();
        if (pErr) throw pErr;
        if (!cancelled) setProfile(p);

        if (!p?.service_lat || !p?.service_lng) {
          router.replace("/(auth)/service-area");
          return;
        }

        const { data: hubRow, error: hubErr } = await supabase.rpc("get_nearest_hub", {
          check_lat: p.service_lat,
          check_lng: p.service_lng,
        });
        if (hubErr) throw hubErr;
        if (!cancelled) setNearest(hubRow as NearestHubResult);

        // Best-effort: get user's waitlist entry by email
        const { data: wl, error: wlErr } = await supabase
          .from("waitlist")
          .select(
            "id,email,full_name,phone,zip,city,state,user_type,hub_id,status,created_at,invited_at,accepted_at"
          )
          .eq("email", userEmail)
          .order("created_at", { ascending: false })
          .maybeSingle();
        if (wlErr) {
          // If RLS blocks, just ignore — the app can still display nearest hub info.
          console.warn("waitlist read failed:", wlErr);
        }
        if (!cancelled) setWaitlistRow((wl as WaitlistRow) ?? null);
      } catch (err: any) {
        console.error("Waitlist load error:", err);
        Alert.alert("Error", err?.message || "Failed to load service area status");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleUpdateLocation = () => {
    router.push("/(auth)/service-area");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/sign-in");
  };

  const handleRetry = async () => {
    // Re-run the flow by sending the user back through service-area.
    router.replace("/(auth)/service-area");
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hubLabel = nearest
    ? `${nearest.name} (${nearest.city}, ${nearest.state})`
    : profile?.hub_id
      ? "Your nearest hub"
      : "Nearest hub";

  const statusLabel = waitlistRow?.status ?? "waiting";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: spacing.sm }}>
        You’re outside our active service area
      </Text>
      <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: spacing.lg }}>
        We’ve saved your location and added you to the waitlist. We’ll notify you when we expand into your area.
      </Text>

      <View
        style={{
          padding: spacing.md,
          borderRadius: 12,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.lg,
        }}
      >
        <Text style={{ fontSize: 14, color: colors.textSecondary }}>Account</Text>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.sm }}>
          {email ?? ""}
        </Text>

        <Text style={{ fontSize: 14, color: colors.textSecondary }}>Nearest hub</Text>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.sm }}>
          {hubLabel}
        </Text>

        {nearest ? (
          <>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Distance</Text>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: spacing.sm }}>
              {nearest.distance_miles.toFixed(1)} miles — {nearest.boundary_status}
            </Text>
          </>
        ) : null}

        <Text style={{ fontSize: 14, color: colors.textSecondary }}>Waitlist status</Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{statusLabel}</Text>
      </View>

      <AppButton title="Update my location" onPress={handleUpdateLocation} style={{ marginBottom: spacing.md }} />
      <AppButton
        title="Retry setup"
        onPress={handleRetry}
        variant="secondary"
        style={{ marginBottom: spacing.md }}
        disabled={!canTryAgain}
      />
	  <AppButton
	    title="View hub coverage map"
	    onPress={() => router.push('/hubs')}
	    variant="secondary"
	    style={{ marginBottom: spacing.md }}
	  />
      <AppButton title="Sign out" onPress={handleSignOut} variant="ghost" />
    </ScrollView>
  );
}
