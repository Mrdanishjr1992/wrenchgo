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
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { DeleteAccountButton } from "../../../src/components/DeleteAccountButton";
import { HelpSupportSection } from "../../../src/components/HelpSupportSection";
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
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);

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
          email,
          phone,
          avatar_url,
          home_lat,
          home_lng,
          city,
          state,
          theme_preference,
          created_at,
          payout_method_status
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

      const { data: toolsData } = await supabase.from("tools").select("key,label,category").order("label");
      const { data: skillsData } = await supabase.from("skills").select("key,label,category").order("label");
      const { data: safetyData } = await supabase.from("safety_measures").select("key,label").order("label");

      const { data: mechSkills } = await supabase
        .from("mechanic_skills")
        .select("skill_key")
        .eq("mechanic_id", userId);

      const { data: mechTools } = await supabase
        .from("mechanic_tools")
        .select("tool_key")
        .eq("mechanic_id", userId);

      const { data: mechSafety } = await supabase
        .from("mechanic_safety")
        .select("safety_key")
        .eq("mechanic_id", userId);

      setAllTools(toolsData || []);
      setAllSkills(skillsData || []);
      setAllSafety(safetyData || []);

      const skillKeys = new Set((mechSkills || []).map((s) => s.skill_key));
      const toolKeys = new Set((mechTools || []).map((t) => t.tool_key));
      const safetyKeys = new Set((mechSafety || []).map((s) => s.safety_key));

      setSelectedTools(toolKeys);
      setSelectedSkills(skillKeys);
      setSelectedSafety(safetyKeys);

      setProfile(data);
      setFullName(data.full_name ? toTitleCase(data.full_name) : "");
      setPhone(data.phone ?? "");
      setHomeCity(data.city ?? "");
      setHomeState(data.state ?? "");

      if (data.home_lat != null && data.home_lng != null) {
        setHomeLatitude(String(data.home_lat));
        setHomeLongitude(String(data.home_lng));
      } else if (mechProfile?.base_location_lat != null && mechProfile?.base_location_lng != null) {
        setHomeLatitude(String(mechProfile.base_location_lat));
        setHomeLongitude(String(mechProfile.base_location_lng));
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
        setRating(mechProfile.rating_avg ?? mechProfile.average_rating ?? 0);
        setJobsCompleted(mechProfile.jobs_completed ?? 0);
        setHourlyRate(mechProfile.hourly_rate_cents ? String(mechProfile.hourly_rate_cents / 100) : "");
        setIsMobile(mechProfile.mobile_service ?? true);
      }

      const { data: payoutData } = await supabase
        .from("mechanic_stripe_accounts")
        .select("*")
        .eq("mechanic_id", userId)
        .maybeSingle();

      setPayoutAccount(payoutData);

      const { data: reviewsData, count: totalReviewCount } = await supabase
        .from("reviews")
        .select(`
          id,
          overall_rating,
          comment,
          created_at,
          reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)
        `, { count: 'exact' })
        .eq("reviewee_id", userId)
        .eq("is_hidden", false)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      setReviews(reviewsData || []);
      setReviewCount(totalReviewCount || 0);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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

      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, buffer, {
        contentType: contentTypeFromExt(ext),
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const newAvatarUrl = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      Alert.alert("Success", "Profile photo updated.");
      await load();
    } catch (e: any) {
      console.error("Photo error:", e);
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
      } catch (error) {
        console.error("Error updating profile:", error);
        throw error;
      }

      try {
        await supabase
          .from("mechanic_profiles")
          .upsert({
            id: userId,

            bio: bio.trim() || null,
            service_radius_km: parseFloat(serviceRadius) || 50,
            is_available: availableNow,
            years_experience: yearsExperience ? parseInt(yearsExperience) : null,


            updated_at: new Date().toISOString(),
          });
      } catch (error) {
        console.error("Error upserting mechanic profile:", error);
        throw error;
      }

      await supabase.from("mechanic_skills").delete().eq("mechanic_id", userId);
      if (selectedSkills.size > 0) {
        await supabase
          .from("mechanic_skills")
          .insert(Array.from(selectedSkills).map((skill_key) => ({
            mechanic_id: userId,
            skill_key,
            
          })));
      }

      // Save tools
      await supabase.from("mechanic_tools").delete().eq("mechanic_id", userId);
      if (selectedTools.size > 0) {
        await supabase
          .from("mechanic_tools")
          .insert(Array.from(selectedTools).map((tool_key) => ({
            mechanic_id: userId,
            tool_key,
          })));
      }

      // Save safety measures
      await supabase.from("mechanic_safety").delete().eq("mechanic_id", userId);
      if (selectedSafety.size > 0) {
        await supabase
          .from("mechanic_safety")
          .insert(Array.from(selectedSafety).map((safety_key) => ({
            mechanic_id: userId,
            safety_key,
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "Not authenticated");
        return;
      }

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

      const jsonData = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(jsonData.error || "Failed to create account link");
      }

      const onboardingUrl = jsonData.url;

      if (onboardingUrl) {
        await Linking.openURL(onboardingUrl);
      } else {
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
      await load();
      if (!silent) {
        Alert.alert("Success", "Payout status refreshed");
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

  const displayName = fullName && fullName.trim().length > 0 ? fullName : "Mechanic";
  const subtitle = shopName && shopName.trim().length > 0 ? shopName : (profile?.email || "Professional Mechanic");
  const isDark = mode === "dark";

  const memberSince = useMemo(() => {
    if (!profile?.created_at) return "";
    return new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }, [profile?.created_at]);

  const initials = useMemo(() => {
    if (!displayName || displayName === "Mechanic") return "M";
    return displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }, [displayName]);

  const selectedSkillsList = useMemo(() => {
    return allSkills.filter(s => selectedSkills.has(s.key) || selectedSkills.has(s.id));
  }, [allSkills, selectedSkills]);

  const selectedToolsList = useMemo(() => {
    return allTools.filter(t => selectedTools.has(t.key) || selectedTools.has(t.id));
  }, [allTools, selectedTools]);

  const selectedSafetyList = useMemo(() => {
    return allSafety.filter(s => selectedSafety.has(s.key) || selectedSafety.has(s.id));
  }, [allSafety, selectedSafety]);

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
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
                  width: 72,
                  height: 72,
                  borderRadius: 24,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: colors.accent + "40",
                  backgroundColor: colors.surface,
                }}
              >
                {profile?.avatar_url ? (
                  <Image key={profile.avatar_url} source={avatarSource} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent + "20" }}>
                    <Text style={{ fontSize: 24, fontWeight: "700", color: colors.accent }}>{initials}</Text>
                  </View>
                )}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    alignItems: "center",
                    paddingVertical: 3,
                  }}
                >
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={{ ...text.title, fontSize: 20 }}>{displayName}</Text>
                {subtitle ? <Text style={{ ...text.muted, marginTop: 2 }} numberOfLines={1}>{subtitle}</Text> : null}

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: "#10b981" + "20",
                      gap: 4,
                    }}
                  >
                    <Ionicons name="construct" size={12} color="#10b981" />
                    <Text style={{ fontWeight: "800", color: "#10b981", fontSize: 11 }}>MECHANIC</Text>
                  </View>
                  {memberSince && (
                    <Text style={{ ...text.muted, fontSize: 12 }}>Since {memberSince}</Text>
                  )}
                </View>
              </View>
            </View>

            <View style={{
              flexDirection: "row",
              gap: spacing.md,
              paddingTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border + "40",
            }}>
              <View style={{ alignItems: "center", flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="star" size={16} color="#FFB800" />
                  <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textPrimary }}>{rating > 0 ? rating.toFixed(1) : "—"}</Text>
                </View>
                <Text style={{ ...text.muted, fontSize: 11 }}>Rating</Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border + "40" }} />
              <View style={{ alignItems: "center", flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#10b981" }}>{jobsCompleted}</Text>
                <Text style={{ ...text.muted, fontSize: 11 }}>Jobs Done</Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border + "40" }} />
              <View style={{ alignItems: "center", flex: 1 }}>
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: availableNow ? "#10b981" + "20" : "#ef4444" + "20",
                }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: availableNow ? "#10b981" : "#ef4444" }} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: availableNow ? "#10b981" : "#ef4444" }}>
                    {availableNow ? "ACTIVE" : "AWAY"}
                  </Text>
                </View>
                <Text style={{ ...text.muted, fontSize: 11, marginTop: 2 }}>Status</Text>
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
                  borderColor: editing ? colors.accent : colors.border,
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
              <Text style={{ fontWeight: "800", color: editing ? colors.black : colors.textPrimary }}>
                {editing ? "CANCEL EDITING" : "EDIT PROFESSIONAL PROFILE"}
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        {!editing && (
          <>
            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.accent + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="person-outline" size={16} color={colors.accent} />
                </View>
                <Text style={text.section}>Professional Info</Text>
              </View>
              <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                    <Text style={text.muted}>Email</Text>
                  </View>
                  <Text style={{ ...text.body, fontWeight: "600" }}>{profile?.email || "Not set"}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border + "40" }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                    <Text style={text.muted}>Phone</Text>
                  </View>
                  <Text style={{ ...text.body, fontWeight: "600", color: phone ? colors.textPrimary : colors.textMuted }}>
                    {phone || "Not set"}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border + "40" }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                    <Text style={text.muted}>Location</Text>
                  </View>
                  <Text style={{ ...text.body, fontWeight: "600", color: locationDisplay !== "Not set" ? colors.textPrimary : colors.textMuted }}>
                    {locationDisplay}
                  </Text>
                </View>
                {yearsExperience && (
                  <>
                    <View style={{ height: 1, backgroundColor: colors.border + "40" }} />
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="briefcase-outline" size={16} color={colors.textMuted} />
                        <Text style={text.muted}>Experience</Text>
                      </View>
                      <Text style={{ ...text.body, fontWeight: "600" }}>{yearsExperience} years</Text>
                    </View>
                  </>
                )}
                {serviceRadius && (
                  <>
                    <View style={{ height: 1, backgroundColor: colors.border + "40" }} />
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="navigate-outline" size={16} color={colors.textMuted} />
                        <Text style={text.muted}>Service Radius</Text>
                      </View>
                      <Text style={{ ...text.body, fontWeight: "600" }}>{serviceRadius} miles</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#635bff" + "20", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="card-outline" size={16} color="#635bff" />
                  </View>
                  <Text style={text.section}>Stripe Payouts</Text>
                </View>
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
                <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                  <Ionicons name="wallet-outline" size={36} color={colors.textMuted} />
                  <Text style={{ ...text.body, fontWeight: "600", marginTop: spacing.sm }}>Not connected</Text>
                  <Text style={{ ...text.muted, fontSize: 13, textAlign: "center", marginTop: 4 }}>
                    Connect Stripe to receive payments
                  </Text>
                  <Pressable
                    onPress={setupPayoutAccount}
                    disabled={loadingPayout}
                    style={({ pressed }) => ({
                      marginTop: spacing.md,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      borderRadius: radius.md,
                      backgroundColor: "#635bff",
                      opacity: pressed || loadingPayout ? 0.8 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    })}
                  >
                    {loadingPayout ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="add" size={18} color="#fff" />
                        <Text style={{ fontWeight: "700", color: "#fff" }}>Connect Stripe</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radius.md,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: payoutAccount.charges_enabled && payoutAccount.payouts_enabled ? "#10b981" + "20" : "#f59e0b" + "20",
                      }}
                    >
                      <Ionicons
                        name={payoutAccount.charges_enabled && payoutAccount.payouts_enabled ? "checkmark-circle" : "time"}
                        size={24}
                        color={payoutAccount.charges_enabled && payoutAccount.payouts_enabled ? "#10b981" : "#f59e0b"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                        {payoutAccount.charges_enabled && payoutAccount.payouts_enabled ? "Active" : "Setup Incomplete"}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
                        {payoutAccount.charges_enabled ? "✓ Charges" : "✗ Charges"} • {payoutAccount.payouts_enabled ? "✓ Payouts" : "✗ Payouts"}
                      </Text>
                    </View>
                  </View>
                  {!(payoutAccount.charges_enabled && payoutAccount.payouts_enabled) && (
                    <Pressable
                      onPress={setupPayoutAccount}
                      disabled={loadingPayout}
                      style={({ pressed }) => ({
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: "#635bff",
                        backgroundColor: "#635bff" + "10",
                        opacity: pressed || loadingPayout ? 0.7 : 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      })}
                    >
                      {loadingPayout ? (
                        <ActivityIndicator color="#635bff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="arrow-forward" size={16} color="#635bff" />
                          <Text style={{ fontWeight: "700", color: "#635bff", fontSize: 14 }}>
                            Complete Setup
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {(shopName || bio) && (
              <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#3b82f6" + "20", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="business-outline" size={16} color="#3b82f6" />
                  </View>
                  <Text style={text.section}>Business</Text>
                </View>
                <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                  {shopName && (
                    <View>
                      <Text style={{ ...text.muted, fontSize: 12 }}>SHOP NAME</Text>
                      <Text style={{ ...text.body, fontWeight: "600", marginTop: 2 }}>{shopName}</Text>
                    </View>
                  )}
                  {bio && (
                    <View>
                      <Text style={{ ...text.muted, fontSize: 12 }}>ABOUT</Text>
                      <Text style={{ ...text.body, marginTop: 2, lineHeight: 20 }}>{bio}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#f59e0b" + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="hammer-outline" size={16} color="#f59e0b" />
                </View>
                <Text style={text.section}>Skills</Text>
              </View>
              {selectedSkillsList.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                  <Ionicons name="construct-outline" size={32} color={colors.textMuted} />
                  <Text style={{ ...text.muted, fontSize: 13, textAlign: "center", marginTop: 8 }}>
                    No skills added yet
                  </Text>
                  <Text style={{ ...text.muted, fontSize: 12, textAlign: "center", marginTop: 2 }}>
                    Tap Edit to add your skills
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.xs }}>
                  {selectedSkillsList.slice(0, 8).map((skill) => (
                    <View
                      key={skill.key || skill.key}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: "#f59e0b" + "15",
                        borderWidth: 1,
                        borderColor: "#f59e0b" + "30",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#f59e0b" }}>
                        {skill.label || skill.key}
                      </Text>
                    </View>
                  ))}
                  {selectedSkillsList.length > 8 && (
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.muted }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
                        +{selectedSkillsList.length - 8} more
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#8b5cf6" + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="build-outline" size={16} color="#8b5cf6" />
                </View>
                <Text style={text.section}>Tools & Equipment</Text>
              </View>
              {selectedToolsList.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                  <Ionicons name="build-outline" size={32} color={colors.textMuted} />
                  <Text style={{ ...text.muted, fontSize: 13, textAlign: "center", marginTop: 8 }}>
                    No tools listed
                  </Text>
                  <Text style={{ ...text.muted, fontSize: 12, textAlign: "center", marginTop: 2 }}>
                    Tap Edit to add your tools
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.xs }}>
                  {selectedToolsList.slice(0, 6).map((tool) => (
                    <View
                      key={tool.key || tool.key}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: colors.textPrimary }}>
                        {tool.label || tool.key}
                      </Text>
                    </View>
                  ))}
                  {selectedToolsList.length > 6 && (
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.muted }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                        +{selectedToolsList.length - 6} more
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#10b981" + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#10b981" />
                </View>
                <Text style={text.section}>Safety Measures</Text>
              </View>
              {selectedSafetyList.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                  <Ionicons name="shield-outline" size={32} color={colors.textMuted} />
                  <Text style={{ ...text.muted, fontSize: 13, textAlign: "center", marginTop: 8 }}>
                    No safety measures added
                  </Text>
                  <Text style={{ ...text.muted, fontSize: 12, textAlign: "center", marginTop: 2 }}>
                    Tap Edit to add safety info
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8, marginTop: spacing.xs }}>
                  {selectedSafetyList.map((safety) => (
                    <View
                      key={safety.key || safety.key}
                      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#10b981" + "20", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="checkmark" size={12} color="#10b981" />
                      </View>
                      <Text style={{ fontSize: 14, color: colors.textPrimary }}>
                        {safety.label || safety.key}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#ec4899" + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={16} color="#ec4899" />
                </View>
                <Text style={text.section}>Appearance</Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: spacing.xs,
                  marginTop: spacing.xs,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ ...text.body, fontWeight: "700" }}>Dark mode</Text>
                  <Text style={{ ...text.muted, fontSize: 13, marginTop: 2 }}>
                    Currently: {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggle}
                  trackColor={{ false: colors.border, true: colors.accent }}
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

              <Pressable
                onPress={() => router.push("/(mechanic)/earnings")}
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
                      backgroundColor: "#10b981" + "15",
                    }}
                  >
                    <Ionicons name="wallet-outline" size={18} color="#10b981" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ ...text.body, fontWeight: "900", color: colors.textPrimary }}>
                      Earnings & Taxes
                    </Text>
                    <Text style={{ ...text.muted, marginTop: 3 }}>
                      View payouts and tax summaries
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>

              <Pressable
                onPress={() => router.push("/(mechanic)/invite")}
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
                      backgroundColor: "#f59e0b" + "15",
                    }}
                  >
                    <Ionicons name="gift-outline" size={18} color="#f59e0b" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ ...text.body, fontWeight: "900", color: colors.textPrimary }}>
                      Invite & Earn
                    </Text>
                    <Text style={{ ...text.muted, marginTop: 3 }}>
                      Refer friends, earn commission credits
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#FFB800" + "20", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="star-outline" size={16} color="#FFB800" />
                  </View>
                  <Text style={text.section}>My Reviews ({reviewCount})</Text>
                </View>
                {reviews.length > 0 && (
                  <Pressable onPress={() => router.push(`/profile/${profile?.id}`)}>
                    <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 13 }}>View All</Text>
                  </Pressable>
                )}
              </View>
              {reviews.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                  <Ionicons name="chatbubble-outline" size={32} color={colors.textMuted} />
                  <Text style={{ ...text.muted, fontSize: 13, textAlign: "center", marginTop: 8 }}>
                    No reviews yet
                  </Text>
                  <Text style={{ ...text.muted, fontSize: 12, textAlign: "center", marginTop: 2 }}>
                    Complete jobs to receive reviews
                  </Text>
                </View>
              ) : (
                <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
                  {reviews.slice(0, 3).map((review) => (
                    <View
                      key={review.id}
                      style={{
                        padding: spacing.sm,
                        borderRadius: radius.md,
                        backgroundColor: colors.bg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          {review.reviewer?.avatar_url ? (
                            <Image
                              source={{ uri: review.reviewer.avatar_url }}
                              style={{ width: 28, height: 28, borderRadius: 14 }}
                            />
                          ) : (
                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent + "20", alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
                                {(review.reviewer?.full_name || "U").charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <Text style={{ fontWeight: "600", color: colors.textPrimary, fontSize: 14 }}>
                            {review.reviewer?.full_name || "Customer"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="star" size={14} color="#FFB800" />
                          <Text style={{ fontWeight: "700", color: colors.textPrimary, fontSize: 14 }}>
                            {review.overall_rating}
                          </Text>
                        </View>
                      </View>
                      {review.comment && (
                        <Text style={{ ...text.muted, fontSize: 13, marginTop: 8, lineHeight: 18 }} numberOfLines={2}>
                          "{review.comment}"
                        </Text>
                      )}
                      <Text style={{ ...text.muted, fontSize: 11, marginTop: 6 }}>
                        {new Date(review.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
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

              <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#f59e0b" + "20", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="location-outline" size={16} color="#f59e0b" />
                  </View>
                  <Text style={{ ...text.muted, fontWeight: "600" }}>Home Location</Text>
                </View>
                <Text style={{ ...text.muted, fontSize: 13 }}>
                  Set your home location for faster service requests
                </Text>
                {homeLatitude && homeLongitude && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.xs }}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={{ ...text.body, fontWeight: "700", color: colors.textPrimary }}>
                      {locationDisplay}
                    </Text>
                  </View>
                )}
                <Pressable
                  onPress={fetchCurrentLocation}
                  disabled={loadingLocation}
                  style={({ pressed }) => ({
                    marginTop: spacing.xs,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    opacity: pressed || loadingLocation ? 0.7 : 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  })}
                >
                  {loadingLocation ? (
                    <ActivityIndicator color={colors.accent} size="small" />
                  ) : (
                    <>
                      <Ionicons name="navigate" size={18} color={colors.accent} />
                      <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                        {homeLatitude && homeLongitude ? "Update Location" : "Use Current Location"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>

            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Business Info</Text>

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
                    const isSelected = selectedTools.has(tool.key);
                    return (
                      <Pressable
                        key={tool.key}
                        onPress={() => {
                          const newSet = new Set(selectedTools);
                          if (isSelected) {
                            newSet.delete(tool.key);
                          } else {
                            newSet.add(tool.key);
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
                    const isSelected = selectedSkills.has(skill.key);
                    return (
                      <Pressable
                        key={skill.key}
                        onPress={() => {
                          const newSet = new Set(selectedSkills);
                          if (isSelected) {
                            newSet.delete(skill.key);
                          } else {
                            newSet.add(skill.key);
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
                    const isSelected = selectedSafety.has(safety.key);
                    return (
                      <Pressable
                        key={safety.key}
                        onPress={() => {
                          const newSet = new Set(selectedSafety);
                          if (isSelected) {
                            newSet.delete(safety.key);
                          } else {
                            newSet.add(safety.key);
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

        <HelpSupportSection variant="card" />

        <Pressable
          onPress={() => router.push("/(mechanic)/legal")}
          style={({ pressed }) => [
            card,
            {
              flexDirection: "row",
              alignItems: "center",
              padding: spacing.lg,
              borderRadius: radius.lg,
              gap: spacing.md,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.accent + "20",
              borderWidth: 1,
              borderColor: colors.accent + "30",
            }}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.accent} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>Legal</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
              Terms, privacy, refunds, payments
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => [
            card,
            {
              paddingVertical: 16,
              paddingHorizontal: 16,
              borderRadius: radius.lg,
              backgroundColor: colors.accent,
              opacity: pressed ? 0.9 : 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.black} />
          <Text style={{ fontWeight: "900", color: colors.black }}>SIGN OUT</Text>
        </Pressable>

        <View style={{ marginTop: spacing.sm }}>
          <DeleteAccountButton variant="card" />
        </View>

        <Text style={{ ...text.muted, textAlign: "center", marginTop: spacing.sm, fontSize: 12 }}>
          WrenchGo • Mechanic
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
