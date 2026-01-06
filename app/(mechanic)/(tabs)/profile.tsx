import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { DeleteAccountButton } from "../../../src/components/DeleteAccountButton";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { GoogleSignin } from "@react-native-google-signin/google-signin";

async function uriToArrayBuffer(uri: string) {
  const res = await fetch(uri);
  return await res.arrayBuffer();
}

function getExt(uri: string) {
  const m = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
  return (m?.[1] ?? "jpg").toLowerCase();
}

function contentTypeFromExt(ext: string) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function toTitleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function MechanicProfile() {
  const router = useRouter();
  const { mode, toggle, colors, spacing, radius, text } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [bio, setBio] = useState("");
  const [serviceRadius, setServiceRadius] = useState("15");
  const [availableNow, setAvailableNow] = useState(true);
  const [yearsExperience, setYearsExperience] = useState("");
  const [rating, setRating] = useState(0);
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const [homeLatitude, setHomeLatitude] = useState("");
  const [homeLongitude, setHomeLongitude] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [homeState, setHomeState] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [isMobile, setIsMobile] = useState(true);
  const [backgroundCheckStatus, setBackgroundCheckStatus] = useState("");

  const [allTools, setAllTools] = useState<any[]>([]);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [allSafety, setAllSafety] = useState<any[]>([]);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedSafety, setSelectedSafety] = useState<Set<string>>(new Set());
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [safetyExpanded, setSafetyExpanded] = useState(false);

  const [payoutAccount, setPayoutAccount] = useState<any>(null);
  const [loadingPayout, setLoadingPayout] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return router.replace("/(auth)/sign-in");

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          phone,
          avatar_url,
          home_lat,
          home_lng,
          city,
          state,
          theme_preference
        `)
        .eq("id", userId)
        .single();

      if (error) throw error;

      setProfile(data);

      const { data: mechProfile } = await supabase
        .from("mechanic_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      const { data: toolsData } = await supabase.from("tools").select("id,key,label,category").order("label");
      const { data: skillsData } = await supabase.from("skills").select("id,key,category").order("key");
      const { data: safetyData } = await supabase.from("safety_measures").select("id,key,label").order("label");

      const { data: mechSkills } = await supabase
        .from("mechanic_skills")
        .select("skill_id")
        .eq("mechanic_id", userId);

      setAllTools(toolsData || []);
      setAllSkills(skillsData || []);
      setAllSafety(safetyData || []);
      setSelectedTools(new Set());
      setSelectedSkills(new Set((mechSkills || []).map((s) => s.skill_id)));
      setSelectedSafety(new Set());

      setProfile(data);
      setFullName(data.full_name ? toTitleCase(data.full_name) : "");
      setPhone(data.phone ?? "");
      setHomeCity(data.city ?? "");
      setHomeState(data.state ?? "");

      if (data.home_lat !== null && data.home_lng !== null) {
        setHomeLatitude(data.home_lat.toString());
        setHomeLongitude(data.home_lng.toString());
      } else if (mechProfile?.base_location_lat !== null && mechProfile?.base_location_lng !== null) {
        setHomeLatitude(mechProfile.base_location_lat.toString());
        setHomeLongitude(mechProfile.base_location_lng.toString());
      } else {
        setHomeLatitude("");
        setHomeLongitude("");
      }

      if (mechProfile) {
        setShopName(mechProfile.business_name ?? "");
        setBio(mechProfile.bio ?? "");
        setServiceRadius(String(mechProfile.service_radius_km ?? 50));
        setAvailableNow(mechProfile.is_available ?? true);
        setYearsExperience(String(mechProfile.years_experience ?? ""));
        setRating(mechProfile.average_rating ?? 0);
        setJobsCompleted(mechProfile.jobs_completed ?? 0);
      }

      const { data: payoutData } = await supabase
        .from("mechanic_stripe_accounts")
        .select("*")
        .eq("mechanic_id", userId)
        .maybeSingle();

      setPayoutAccount(payoutData);
      setIsDirty(false);
    } catch (e: any) {
      console.error("Profile load error:", e);
      if (e?.message) {
        Alert.alert("Profile error", e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const changePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow access to your photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled) return;

      const uri = result.assets[0].uri;
      const ext = getExt(uri);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const buffer = await uriToArrayBuffer(uri);
      const path = `avatars/${userId}.${ext}`;

      await supabase.storage.from("avatars").upload(path, buffer, {
        contentType: contentTypeFromExt(ext),
        upsert: true,
      });

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase
        .from("profiles")
        .update({ avatar_url:  `${pub.publicUrl}?t=${Date.now()}` })
        .eq("id", userId)
;

      Alert.alert("Success", "Profile photo updated.");
      load();
    } catch (e: any) {
      Alert.alert("Photo error", e.message ?? "Failed to update photo.");
    }
  }, [load]);

  const save = async () => {
    try {
      setSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const lat = homeLatitude ? parseFloat(homeLatitude) : null;
      const lng = homeLongitude ? parseFloat(homeLongitude) : null;

      if (homeLatitude && isNaN(lat!)) {
        Alert.alert("Error", "Invalid latitude value");
        return;
      }
      if (homeLongitude && isNaN(lng!)) {
        Alert.alert("Error", "Invalid longitude value");
        return;
      }

      console.log("Saving profile data for user:", userId);

      const normalizedName = fullName.trim() ? toTitleCase(fullName) : null;
      const normalizedPhone = phone.trim() || null;
      const normalizedCity = homeCity.trim() ? toTitleCase(homeCity) : null;
      const normalizedState = homeState.trim() ? toTitleCase(homeState) : null;

      try {
        await supabase
          .from("profiles")
          .update({
            full_name: normalizedName,
            phone: normalizedPhone,
            home_lat: lat,
            home_lng: lng,
            city: normalizedCity,
            state: normalizedState,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
        console.log("Profile updated successfully");
      } catch (error) {
        console.error("Error updating profile:", error);
        throw error;
      }

      try {
        await supabase
          .from("mechanic_profiles")
          .upsert({
            id: userId,
            business_name: shopName.trim() ? toTitleCase(shopName) : null,
            bio: bio.trim() || null,
            service_radius_km: parseFloat(serviceRadius) || 50,
            is_available: availableNow,
            years_experience: yearsExperience ? parseInt(yearsExperience) : null,
            base_location_lat: lat,
            base_location_lng: lng,
            updated_at: new Date().toISOString(),
          });
        console.log("Mechanic profile upserted successfully");
      } catch (error) {
        console.error("Error upserting mechanic profile:", error);
        throw error;
      }

      await supabase.from("mechanic_skills").delete().eq("mechanic_id", userId);
      if (selectedSkills.size > 0) {
        await supabase
          .from("mechanic_skills")
          .insert(Array.from(selectedSkills).map((skill_id) => ({
            mechanic_id: userId,
            skill_id,
            level: 'intermediate'
          })));
      }

      Alert.alert("Saved", "Profile updated successfully.");
      setEditing(false);
      setIsDirty(false);
      load();
    } catch (e: any) {
      console.error("Save error:", e);
      Alert.alert("Save error", e.message ?? "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const fetchCurrentLocation = useCallback(async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please allow location access to use this feature.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      setHomeLatitude(lat.toString());
      setHomeLongitude(lng.toString());
      setIsDirty(true);

      try {
        const [geocode] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geocode) {
          setHomeCity(geocode.city || "");
          setHomeState(geocode.region || "");
        }
      } catch (geoErr) {
        console.warn("Geocoding failed:", geoErr);
      }

      Alert.alert('Success', 'Location captured. Save your profile to persist.');
    } catch (error: any) {
      console.error('Location error:', error);
      Alert.alert('Error', error.message || 'Failed to get location');
    } finally {
      setLoadingLocation(false);
    }
  }, []);

  const setupPayoutAccount = async () => {
    try {
      console.log("[SETUP] Starting payout account setup...");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "Not authenticated");
        return;
      }

      console.log("[SETUP] Got session, calling edge function...");

      const apiResponse = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stripe-connect-create-account-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
          },
        }
      );

      console.log("[SETUP] Response status:", apiResponse.status);

      const jsonData = await apiResponse.json();
      console.log("[SETUP] Response data:", jsonData);

      if (!apiResponse.ok) {
        throw new Error(jsonData.error || "Failed to create account link");
      }

      const onboardingUrl = jsonData.url;
      console.log("[SETUP] Extracted URL:", onboardingUrl);
      console.log("[SETUP] URL type:", typeof onboardingUrl);
      console.log("[SETUP] URL length:", onboardingUrl?.length);

      if (onboardingUrl) {
        console.log("[SETUP] Attempting to open URL...");
        const opened = await Linking.openURL(onboardingUrl);
        console.log("[SETUP] URL opened successfully:", opened);
      } else {
        console.error("[SETUP] URL is falsy:", onboardingUrl);
        Alert.alert("Error", "No URL received from server");
      }
    } catch (e: any) {
      console.error("[SETUP] Error:", e);
      Alert.alert("Setup failed", e.message ?? "Could not setup payout account.");
    }
  };

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      try { await GoogleSignin.signOut(); } catch {}
      router.replace("/(auth)/sign-in");
    } catch (e: any) {
      Alert.alert("Sign out failed", e.message ?? "Could not sign out.");
    }
  }, [router]);

  const handleCancelEditing = useCallback(() => {
    if (isDirty) {
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. Are you sure you want to discard them?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              setEditing(false);
              setIsDirty(false);
              load();
            },
          },
        ]
      );
    } else {
      setEditing(false);
    }
  }, [isDirty, load]);

  const handleFieldChange = useCallback((setter: (val: any) => void, value: any) => {
    setter(value);
    setIsDirty(true);
  }, []);

  const locationDisplay = useMemo(() => {
    if (homeCity && homeState) {
      return `${homeCity}, ${homeState}`;
    } else if (homeCity) {
      return homeCity;
    } else if (homeLatitude && homeLongitude) {
      return "Location set";
    }
    return "Not set";
  }, [homeCity, homeState, homeLatitude, homeLongitude]);

  const refreshPayoutStatus = useCallback(async (silent = false) => {
    try {
      setLoadingPayout(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stripe-connect-refresh-status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        await load();
        if (!silent) {
          Alert.alert("Success", "Payout account status updated");
        }
      } else {
        throw new Error(data.error || "Failed to refresh status");
      }
    } catch (e: any) {
      if (!silent) {
        Alert.alert("Refresh Error", e.message ?? "Failed to refresh payout status");
      }
    } finally {
      setLoadingPayout(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const handleDeepLink = (event: { url: string }) => {
        if (event.url.includes("stripe-connect-return") || event.url.includes("stripe-connect-refresh")) {
          refreshPayoutStatus(true);
        }
      };

      const subscription = Linking.addEventListener("url", handleDeepLink);

      Linking.getInitialURL().then((url) => {
        if (url && (url.includes("stripe-connect-return") || url.includes("stripe-connect-refresh"))) {
          refreshPayoutStatus(true);
        }
      });

      return () => {
        subscription.remove();
      };
    }, [refreshPayoutStatus])
  );

  const avatarSource = profile?.avatar_url
    ? { uri: profile.avatar_url }
    : require("../../../assets/profile.png");

  const displayName = fullName && fullName.trim().length > 0 ? fullName : "Mechanic Profile";
  const subtitle = shopName && shopName.trim().length > 0 ? shopName : "Professional";
  const isDark = mode === "dark";

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 10, ...text.muted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.xl,
          gap: spacing.md,
        }}
      >
        <LinearGradient
          colors={[colors.surface, colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            overflow: "hidden",
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -60,
              top: -50,
              width: 190,
              height: 190,
              borderRadius: 999,
              backgroundColor: `${colors.accent}1A`,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: -70,
              bottom: -80,
              width: 230,
              height: 230,
              borderRadius: 999,
              backgroundColor: `${colors.accent}10`,
            }}
          />

          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
              <Pressable
                onPress={changePhoto}
                style={{
                  width: 66,
                  height: 66,
                  borderRadius: 22,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Image
                  source={avatarSource}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    alignItems: "center",
                    paddingVertical: 2,
                  }}
                >
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={{ ...text.title, fontSize: 20 }}>{displayName}</Text>
                <Text style={{ ...text.muted, marginTop: 2 }}>{subtitle}</Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.bg,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: colors.textPrimary, fontSize: 11 }}>
                      MECHANIC
                    </Text>
                  </View>

                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: `${colors.accent}55`,
                      backgroundColor: `${colors.accent}18`,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: colors.accent, fontSize: 11 }}>
                      {isDark ? "DARK" : "LIGHT"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => editing ? handleCancelEditing() : setEditing(true)}
              style={({ pressed }) => [
                {
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: editing ? colors.accent : colors.surface,
                  opacity: pressed ? 0.9 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                },
              ]}
            >
              <Ionicons
                name={editing ? "close-outline" : "create-outline"}
                size={18}
                color={editing ? colors.black : colors.textPrimary}
              />
              <Text style={{ fontWeight: "900", color: editing ? colors.black  : colors.textPrimary }}>
                {editing ? "CANCEL EDITING" : "EDIT PROFILE"}
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        {!editing && (
          <>
            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Account Status</Text>
              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={text.muted}>Background check</Text>
                  <Text
                    style={{
                      ...text.body,
                      fontWeight: "700",
                      color:
                        backgroundCheckStatus === "approved"
                          ? "#10b981"
                          : backgroundCheckStatus === "rejected"
                          ? "#ef4444"
                          : colors.textMuted,
                    }}
                  >
                    {backgroundCheckStatus.charAt(0).toUpperCase() + backgroundCheckStatus.slice(1)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={text.muted}>Rating</Text>
                  <Text style={{ ...text.body, fontWeight: "700" }}>⭐ {rating.toFixed(1)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={text.muted}>Jobs completed</Text>
                  <Text style={{ ...text.body, fontWeight: "700" }}>{jobsCompleted}</Text>
                </View>
              </View>
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={text.section}>Payout Account</Text>
                {payoutAccount && (
                  <Pressable onPress={() => refreshPayoutStatus()} disabled={loadingPayout}>
                    <Ionicons
                      name="refresh"
                      size={20}
                      color={loadingPayout ? colors.textMuted : colors.accent}
                    />
                  </Pressable>
                )}
              </View>

              {!payoutAccount ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ ...text.body, lineHeight: 20 }}>
                    Set up your Stripe account to receive payments for completed jobs.
                  </Text>
                  <Pressable
                    onPress={setupPayoutAccount}
                    disabled={loadingPayout}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: radius.md,
                        backgroundColor: colors.accent,
                        opacity: pressed || loadingPayout ? 0.7 : 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      },
                    ]}
                  >
                    {loadingPayout ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={18} color={colors.black} />
                        <Text style={{ fontWeight: "900", color: colors.black }}>
                          SETUP STRIPE ACCOUNT
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.muted}>Status</Text>
                    <Text
                      style={{
                        ...text.body,
                        fontWeight: "700",
                        color:
                          payoutAccount.status === "active"
                            ? "#10b981"
                            : payoutAccount.status === "restricted" || payoutAccount.status === "rejected"
                            ? "#ef4444"
                            : colors.accent,
                      }}
                    >
                      {payoutAccount.status.charAt(0).toUpperCase() +
                       payoutAccount.status.slice(1)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.muted}>Charges enabled</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>
                      {payoutAccount.charges_enabled ? "✓ Yes" : "✗ No"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.muted}>Payouts enabled</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>
                      {payoutAccount.payouts_enabled ? "✓ Yes" : "✗ No"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.muted}>Details submitted</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>
                      {payoutAccount.details_submitted ? "✓ Yes" : "✗ No"}
                    </Text>
                  </View>

                  {payoutAccount.status !== "active" && (
                    <Pressable
                      onPress={setupPayoutAccount}
                      disabled={loadingPayout}
                      style={({ pressed }) => [
                        {
                          marginTop: spacing.xs,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: colors.accent,
                          backgroundColor: `${colors.accent}18`,
                          opacity: pressed || loadingPayout ? 0.7 : 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        },
                      ]}
                    >
                      {loadingPayout ? (
                        <ActivityIndicator color={colors.accent} size="small" />
                      ) : (
                        <>
                          <Ionicons name="arrow-forward" size={16} color={colors.accent} />
                          <Text style={{ fontWeight: "700", color: colors.accent, fontSize: 13 }}>
                            COMPLETE SETUP
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Business Info</Text>
              <View style={{ gap: spacing.xs }}>
                {shopName && (
                  <View>
                    <Text style={text.muted}>Shop name</Text>
                    <Text style={{ ...text.body, marginTop: 2 }}>{shopName}</Text>
                  </View>
                )}
                {bio && (
                  <View>
                    <Text style={text.muted}>Bio</Text>
                    <Text style={{ ...text.body, marginTop: 2, lineHeight: 20 }}>{bio}</Text>
                  </View>
                )}
                <View>
                  <Text style={text.muted}>Service radius</Text>
                  <Text style={{ ...text.body, marginTop: 2 }}>{serviceRadius} miles</Text>
                </View>
                {zipCode && (
                  <View>
                    <Text style={text.muted}>ZIP code</Text>
                    <Text style={{ ...text.body, marginTop: 2 }}>{zipCode}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Professional Info</Text>
              <View style={{ gap: spacing.xs }}>
                {yearsExperience && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.muted}>Experience</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>{yearsExperience} years</Text>
                  </View>
                )}
                {hourlyRate && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.muted}>Hourly rate</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>${hourlyRate}/hr</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={text.muted}>Mobile service</Text>
                  <Text style={{ ...text.body, fontWeight: "700" }}>{isMobile ? "Yes" : "No"}</Text>
                </View>
              </View>
            </View>

            {selectedTools.size > 0 && (
              <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
                <Text style={text.section}>Tools & Equipment</Text>
                <Text style={text.muted}>{selectedTools.size} tools selected</Text>
              </View>
            )}

            {selectedSkills.size > 0 && (
              <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
                <Text style={text.section}>Skills & Services</Text>
                <Text style={text.muted}>{selectedSkills.size} skills selected</Text>
              </View>
            )}

            {selectedSafety.size > 0 && (
              <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
                <Text style={text.section}>Safety Measures</Text>
                <Text style={text.muted}>{selectedSafety.size} measures selected</Text>
              </View>
            )}

            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Appearance</Text>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  backgroundColor: colors.bg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Ionicons name={isDark ? "moon" : "sunny"} size={18} color={colors.textPrimary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ ...text.body, fontWeight: "900", color: colors.textPrimary }}>
                      Dark mode
                    </Text>
                    <Text style={{ ...text.muted, marginTop: 3 }}>
                      Currently:{" "}
                      <Text style={{ color: colors.accent, fontWeight: "900" }}>
                        {mode.toUpperCase()}
                      </Text>
                    </Text>
                  </View>
                </View>

                <Switch
                  value={isDark}
                  onValueChange={toggle}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textPrimary}
                />
              </View>
            </View>

            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Security</Text>

              <Pressable
                onPress={() => router.push("/(modals)/change-password")}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  backgroundColor: colors.bg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textPrimary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ ...text.body, fontWeight: "900", color: colors.textPrimary }}>
                      Change Password
                    </Text>
                    <Text style={{ ...text.muted, marginTop: 3 }}>
                      Update your account password
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </>
        )}

        {editing && (
          <>
            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Basic Info</Text>

              <Text style={text.muted}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={(val) => handleFieldChange(setFullName, val)}
                placeholder="Enter your name"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                }}
              />

              <Text style={text.muted}>Phone</Text>
              <TextInput
                value={phone}
                onChangeText={(val) => handleFieldChange(setPhone, val)}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                }}
              />

              <Text style={[text.section, { marginTop: spacing.md }]}>Home Location</Text>
              <Text style={[text.muted, { fontSize: 12 }]}>
                Set your home location for faster service requests
              </Text>

              {(homeLatitude && homeLongitude) && (
                <View style={{ marginTop: spacing.xs, marginBottom: spacing.xs }}>
                  <Text style={{ ...text.body, fontWeight: "700", color: colors.textPrimary }}>
                    {locationDisplay}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={fetchCurrentLocation}
                disabled={loadingLocation}
                style={{
                  backgroundColor: colors.surface,
                  paddingVertical: 12,
                  borderRadius: radius.lg,
                  alignItems: "center",
                  marginTop: spacing.xs,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {loadingLocation ? (
                    <ActivityIndicator color={colors.accent} size="small" />
                  ) : (
                    <>
                      <Ionicons name="location" size={20} color={colors.accent} />
                      <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                        Use Current Location
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            </View>

            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Business Info</Text>

              <Text style={text.muted}>Shop name</Text>
              <TextInput
                value={shopName}
                onChangeText={(val) => handleFieldChange(setShopName, val)}
                placeholder="Your shop or business name"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                }}
              />

              <Text style={text.muted}>Bio</Text>
              <TextInput
                value={bio}
                onChangeText={(val) => handleFieldChange(setBio, val)}
                placeholder="Tell customers about yourself"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
              />

              <Text style={text.muted}>Service radius (miles)</Text>
              <TextInput
                value={serviceRadius}
                onChangeText={(val) => handleFieldChange(setServiceRadius, val)}
                keyboardType="numeric"
                placeholder="15"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                }}
              />

              <Text style={text.muted}>Years of experience</Text>
              <TextInput
                value={yearsExperience}
                onChangeText={(val) => handleFieldChange(setYearsExperience, val)}
                keyboardType="numeric"
                placeholder="5"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                }}
              />

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  backgroundColor: colors.bg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: spacing.xs,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.body, fontWeight: "900" }}>Available now</Text>
                  <Text style={{ ...text.muted, marginTop: 3 }}>
                    Show as available for new jobs
                  </Text>
                </View>
                <Switch
                  value={availableNow}
                  onValueChange={(val) => handleFieldChange(setAvailableNow, val)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textPrimary}
                />
              </View>
            </View>

            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Professional Info</Text>

              <Text style={text.muted}>Hourly rate ($)</Text>
              <TextInput
                value={hourlyRate}
                onChangeText={(val) => handleFieldChange(setHourlyRate, val)}
                keyboardType="numeric"
                placeholder="75"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                }}
              />

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  backgroundColor: colors.bg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: spacing.xs,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.body, fontWeight: "900" }}>Mobile service</Text>
                  <Text style={{ ...text.muted, marginTop: 3 }}>I can travel to customers</Text>
                </View>
                <Switch
                  value={isMobile}
                  onValueChange={(val) => handleFieldChange(setIsMobile, val)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textPrimary}
                />
              </View>
            </View>

            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Pressable
                onPress={() => setToolsExpanded(!toolsExpanded)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text style={text.section}>Tools & Equipment</Text>
                  <Text style={text.muted}>{selectedTools.size} selected</Text>
                </View>
                <Ionicons
                  name={toolsExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.accent}
                />
              </Pressable>

              {toolsExpanded && (
                <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                  {allTools.map((tool) => {
                    const isSelected = selectedTools.has(tool.id);
                    return (
                      <Pressable
                        key={tool.id}
                        onPress={() => {
                          const newSet = new Set(selectedTools);
                          if (isSelected) {
                            newSet.delete(tool.id);
                          } else {
                            newSet.add(tool.id);
                          }
                          handleFieldChange(setSelectedTools, newSet);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          padding: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.accent : colors.border,
                          backgroundColor: isSelected ? colors.accent + "11" : colors.bg,
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: isSelected ? colors.accent : colors.border,
                            backgroundColor: isSelected ? colors.accent : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isSelected && <Text style={{ color: "#fff", fontWeight: "900" }}>✓</Text>}
                        </View>
                        <Text style={[text.body, { flex: 1 }]}>{tool.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Pressable
                onPress={() => setSkillsExpanded(!skillsExpanded)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text style={text.section}>Skills & Services</Text>
                  <Text style={text.muted}>{selectedSkills.size} selected</Text>
                </View>
                <Ionicons
                  name={skillsExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.accent}
                />
              </Pressable>

              {skillsExpanded && (
                <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                  {allSkills.map((skill) => {
                    const isSelected = selectedSkills.has(skill.id);
                    return (
                      <Pressable
                        key={skill.id}
                        onPress={() => {
                          const newSet = new Set(selectedSkills);
                          if (isSelected) {
                            newSet.delete(skill.id);
                          } else {
                            newSet.add(skill.id);
                          }
                          handleFieldChange(setSelectedSkills, newSet);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          padding: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.accent : colors.border,
                          backgroundColor: isSelected ? colors.accent + "11" : colors.bg,
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: isSelected ? colors.accent : colors.border,
                            backgroundColor: isSelected ? colors.accent : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isSelected && <Text style={{ color: "#fff", fontWeight: "900" }}>✓</Text>}
                        </View>
                        <Text style={[text.body, { flex: 1 }]}>{skill.key}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Pressable
                onPress={() => setSafetyExpanded(!safetyExpanded)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text style={text.section}>Safety Measures</Text>
                  <Text style={text.muted}>{selectedSafety.size} selected</Text>
                </View>
                <Ionicons
                  name={safetyExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.accent}
                />
              </Pressable>

              {safetyExpanded && (
                <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                  {allSafety.map((safety) => {
                    const isSelected = selectedSafety.has(safety.id);
                    return (
                      <Pressable
                        key={safety.id}
                        onPress={() => {
                          const newSet = new Set(selectedSafety);
                          if (isSelected) {
                            newSet.delete(safety.id);
                          } else {
                            newSet.add(safety.id);
                          }
                          handleFieldChange(setSelectedSafety, newSet);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          padding: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.accent : colors.border,
                          backgroundColor: isSelected ? colors.accent + "11" : colors.bg,
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: isSelected ? colors.accent : colors.border,
                            backgroundColor: isSelected ? colors.accent : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isSelected && <Text style={{ color: "#fff", fontWeight: "900" }}>✓</Text>}
                        </View>
                        <Text style={[text.body, { flex: 1 }]}>{safety.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <Pressable
              onPress={save}
              disabled={saving}
              style={{
                backgroundColor: colors.accent,
                paddingVertical: 16,
                borderRadius: radius.lg,
                alignItems: "center",
                marginTop: spacing.sm,
                opacity: saving ? 0.7 : 1,
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.black }}>
                {saving ? "SAVING…" : "SAVE CHANGES"}
              </Text>
            </Pressable>
          </>
        )}

        <Pressable
          onPress={() => router.push("/(mechanic)/legal")}
          style={({ pressed }) => [
            {
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingVertical: 16,
              borderRadius: radius.lg,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
              flexDirection: "row",
              justifyContent: "center",
              gap: 10,
              marginBottom: spacing.md,
            },
          ]}
        >
          <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
          <Text style={{ fontWeight: "900", color: colors.textPrimary }}>LEGAL</Text>
        </Pressable>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => [
            {
              borderWidth: 1,
              borderColor: colors.black,
              backgroundColor: colors.accent,
              paddingVertical: 16,
              borderRadius: radius.lg,
              alignItems: "center",
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
              flexDirection: "row",
              justifyContent: "center",
              gap: 10,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.black} />
          <Text style={{ fontWeight: "900", color: colors.black }}>SIGN OUT</Text>
        </Pressable>

        <View style={{ marginTop: spacing.lg }}>
          <DeleteAccountButton variant="card" />
        </View>

        <Text style={{ ...text.muted, textAlign: "center", marginTop: 6 }}>
          WrenchGo • Mechanic
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
