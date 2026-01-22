import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { zipToLocation, checkServiceArea } from "../../src/lib/service-area";
import { useTheme } from "../../src/ui/theme-context";
import { AppButton } from "../../src/ui/components/AppButton";

type ServiceAreaPreview = {
  zip: string;
  lat: number;
  lng: number;
  inRange: boolean;
  withinMaxRadius: boolean;
  distanceMiles: number;
  boundaryStatus: string;
  hub?: {
    id: string;
    name: string;
    slug?: string;
    activeRadiusMiles?: number;
    maxRadiusMiles?: number;
  };
};

function normalizeZip(raw: string): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 5);
}

export default function ServiceAreaScreen() {
  const router = useRouter();
  const { theme, colors } = useTheme();

  const [role, setRole] = useState<string | null>(null);
  const [zip, setZip] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const [preview, setPreview] = useState<ServiceAreaPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const zipClean = useMemo(() => normalizeZip(zip), [zip]);

  useEffect(() => {
    let cancelled = false;

    async function loadRoleAndMaybePrefillZip() {
      try {
        const { data: roleData, error: roleError } = await supabase.rpc("get_my_role");
        if (roleError) throw roleError;

        const nextRole = typeof roleData === "string" ? roleData : null;
        if (!cancelled) setRole(nextRole);

        // Prefill zip if user already has one
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("service_zip")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) return;
        if (!cancelled && profile?.service_zip) {
          setZip(String(profile.service_zip));
        }
      } catch (e: any) {
        console.warn("Failed to load role/zip:", e?.message || e);
        if (!cancelled) setRole(null);
      }
    }

    loadRoleAndMaybePrefillZip();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheck = async () => {
    if (zipClean.length != 5) {
      Alert.alert("Invalid ZIP", "Please enter a 5-digit ZIP code.");
      return;
    }

    setChecking(true);
    setPreview(null);

    try {
      const loc = await zipToLocation(zipClean);
      if (!loc) {
        Alert.alert("ZIP not found", "We couldn't find that ZIP in the database.");
        return;
      }

      const svc = await checkServiceArea(loc.lat, loc.lng);

      setPreview({
        zip: zipClean,
        lat: loc.lat,
        lng: loc.lng,
        inRange: svc.inRange,
        withinMaxRadius: svc.withinMaxRadius,
        distanceMiles: svc.distanceMiles,
        boundaryStatus: svc.boundaryStatus,
        hub: svc.hub,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to check service area.");
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    if (zipClean.length != 5) {
      Alert.alert("Invalid ZIP", "Please enter a 5-digit ZIP code.");
      return;
    }

    setSaving(true);

    try {
      const loc = await zipToLocation(zipClean);
      if (!loc) {
        Alert.alert("ZIP not found", "We couldn't find that ZIP in the database.");
        return;
      }

      // Persist the user's service area + hub assignment (and waitlist when out of range)
      const { data, error } = await supabase.rpc("set_my_service_area", {
        p_zip: zipClean,
        p_lat: loc.lat,
        p_lng: loc.lng,
      });
      if (error) throw error;

      // Best-effort referral redemption
      const code = referralCode.trim();
      if (code.length > 0) {
        const { error: inviteErr } = await supabase.rpc("accept_invitation", {
          p_invite_code: code,
        });
        if (inviteErr) {
          console.warn("Referral code not applied:", inviteErr.message);
        }
      }

      const inRange = Boolean(data?.in_range);

      if (!inRange) {
        router.replace("/(auth)/waitlist");
        return;
      }

      // Go back to index; it will route the user to the correct app stack.
      router.replace("/");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save service area.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.card,
    }),
    [colors]
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 8 }}>
          Set your service area
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 18, lineHeight: 20 }}>
          Enter a ZIP code to link you to the nearest hub. If you're outside the active service radius, we’ll
          place you on the waitlist for that hub.
        </Text>

        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 }}>ZIP code</Text>
        <TextInput
          placeholder="e.g. 90210"
          placeholderTextColor={colors.textSecondary}
          value={zip}
          onChangeText={setZip}
          keyboardType="number-pad"
          maxLength={5}
          style={inputStyle}
        />

        <View style={{ height: 12 }} />

        <AppButton title="Check availability" onPress={handleCheck} disabled={checking || zipClean.length !== 5} />

        {checking ? (
          <View style={{ paddingVertical: 14 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {preview ? (
          <View
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>
              {preview.inRange ? "✅ In service area" : "⏳ Outside active radius"}
            </Text>
            <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
              Nearest hub: {preview.hub?.name ?? "Unknown"}
            </Text>
            <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
              Distance: {Number(preview.distanceMiles).toFixed(1)} miles ({preview.boundaryStatus})
            </Text>
            {!preview.inRange ? (
              <Text style={{ color: colors.textSecondary, lineHeight: 20, marginTop: 8 }}>
                You can still set your service area to join the waitlist. We'll notify you when this hub
                expands.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: 18 }} />

        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 8 }}>
          Referral code (optional)
        </Text>
        <TextInput
          placeholder="Enter a referral code"
          placeholderTextColor={colors.textSecondary}
          value={referralCode}
          onChangeText={setReferralCode}
          autoCapitalize="characters"
          style={inputStyle}
        />

        <View style={{ height: 18 }} />

        <AppButton
          title={saving ? "Saving…" : "Save & Continue"}
          onPress={handleSave}
          disabled={saving || zipClean.length !== 5}
        />

        <View style={{ height: 16 }} />

        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
          Current role: {role ?? "(not set)"}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
