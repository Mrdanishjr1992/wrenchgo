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
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { DeleteAccountButton } from "../../../src/components/DeleteAccountButton";
import * as ImagePicker from "expo-image-picker";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useStripe } from "@stripe/stripe-react-native";

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

export default function CustomerAccount() {
  const router = useRouter();
  const { mode, toggle, colors, spacing, radius, text } = useTheme();
  const insets = useSafeAreaInsets();
  const card = useMemo(() => createCard(colors), [colors]);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [homeState, setHomeState] = useState("");
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [settingUpPayment, setSettingUpPayment] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [jobStats, setJobStats] = useState({ active: 0, completed: 0 });
  const [ratingStats, setRatingStats] = useState({ avg: 0, count: 0 });

  const isDark = mode === "dark";
  const goToLegal = () => router.push("/(customer)/legal");

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
          created_at
        `)
        .eq("id", userId)
        .single();

      if (error) throw error;

      setProfile(data);
      setFullName(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setHomeLat(data.home_lat ?? null);
      setHomeLng(data.home_lng ?? null);
      setHomeCity(data.city ?? "");
      setHomeState(data.state ?? "");

      const { data: paymentData } = await supabase
        .from("customer_payment_methods")
        .select("stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year")
        .eq("customer_id", data.id)
        .maybeSingle();

      setPaymentMethod(paymentData);

      const { data: vehiclesData } = await supabase
        .from("vehicles")
        .select("id, year, make, model")
        .eq("customer_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      setVehicles(vehiclesData || []);

      const { count: activeCount } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", userId)
        .not("status", "in", '("completed","cancelled")')
        .is("deleted_at", null);

      const { count: completedCount } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", userId)
        .eq("status", "completed")
        .is("deleted_at", null);

      setJobStats({ active: activeCount || 0, completed: completedCount || 0 });

      const { data: reviewsData } = await supabase
        .from("reviews")
        .select(`
          id,
          overall_rating,
          performance_rating,
          timing_rating,
          cost_rating,
          comment,
          created_at,
          reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)
        `)
        .eq("reviewee_id", data.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setReviews(reviewsData || []);

      const reviewCount = reviewsData?.length || 0;
      const avgRating = reviewCount > 0
        ? reviewsData!.reduce((sum: number, r: any) => sum + (r.overall_rating || 0), 0) / reviewCount
        : 0;
      setRatingStats({ avg: avgRating, count: reviewCount });

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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return router.replace("/(auth)/sign-in");

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      const ext = getExt(uri);
      const buffer = await uriToArrayBuffer(uri);
      const path = `avatars/${userId}.${ext}`;

      const up = await supabase.storage.from("avatars").upload(path, buffer, {
        contentType: contentTypeFromExt(ext),
        upsert: true,
      });
      if (up.error) throw up.error;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;

      const upd = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (upd.error) throw upd.error;

      Alert.alert("Success", "Profile photo updated.");
      await load();
    } catch (e: any) {
      console.error("Photo error:", e);
      Alert.alert("Photo error", e?.message ?? "Failed to update photo.");
    }
  }, [load, router]);

  const saveProfile = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setSaving(true);

      const normalizedName = fullName.trim() ? toTitleCase(fullName) : null;
      const normalizedPhone = phone.trim() || null;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: normalizedName,
          phone: normalizedPhone,
          home_lat: homeLat,
          home_lng: homeLng,
          city: homeCity.trim() || null,
          state: homeState.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      Alert.alert("Success", "Profile updated successfully");
      setEditing(false);
      setIsDirty(false);
      await load();
    } catch (e: any) {
      console.error("Save error:", e);
      Alert.alert("Error", e?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [profile, fullName, phone, homeLat, homeLng, homeCity, homeState, load]);

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

      setHomeLat(lat);
      setHomeLng(lng);

      let city = "";
      let region = "";
      try {
        const [geocode] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geocode) {
          city = geocode.city || "";
          region = geocode.region || "";
          setHomeCity(city);
          setHomeState(region);
        }
      } catch (geoErr) {
        console.warn("Geocoding failed:", geoErr);
      }

      if (profile?.id) {
        const { error } = await supabase
          .from("profiles")
          .update({
            home_lat: lat,
            home_lng: lng,
            city: city || null,
            state: region || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);

        if (error) throw error;

        Alert.alert('Success', 'Location saved successfully');
        await load();
      }
    } catch (error: any) {
      console.error('Location error:', error);
      Alert.alert('Error', error.message || 'Failed to get location');
    } finally {
      setLoadingLocation(false);
    }
  }, [profile, load]);

  const setupPaymentMethod = useCallback(async () => {
    try {
      setSettingUpPayment(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "Please sign in to add a payment method");
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/customer-setup-payment-method`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to setup payment method");
      }

      const setupIntentId = data.clientSecret.split('_secret_')[0];

      const { error: initError } = await initPaymentSheet({
        setupIntentClientSecret: data.clientSecret,
        merchantDisplayName: "WrenchGo",
        customerId: data.customerId,
        returnURL: "wrenchgo://customer/account",
      });

      if (initError) {
        throw new Error(initError.message);
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== "Canceled") {
          throw new Error(presentError.message);
        }
        return;
      }

      const saveResponse = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/customer-save-payment-method`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({ setupIntentId }),
        }
      );

      if (!saveResponse.ok) {
        console.error("Failed to save payment method, but payment was successful");
      }

      Alert.alert("Success", "Payment method added successfully");
      await load();
    } catch (error: any) {
      console.error("Payment setup error:", error);
      Alert.alert("Error", error.message || "Failed to setup payment method");
    } finally {
      setSettingUpPayment(false);
    }
  }, [initPaymentSheet, presentPaymentSheet, load]);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      try { await GoogleSignin.signOut(); } catch {}
      router.replace("/(auth)/sign-in");
    } catch (e: any) {
      Alert.alert("Sign out failed", e?.message ?? "Could not sign out.");
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

  const handleFieldChange = useCallback((setter: (val: string) => void, value: string) => {
    setter(value);
    setIsDirty(true);
  }, []);

  const avatarSource = profile?.avatar_url
    ? { uri: profile.avatar_url }
    : require("../../../assets/profile.png");

  const displayName = fullName && fullName.trim().length > 0 ? fullName : "Customer";
  const subtitle = profile?.email ? profile.email : "";

  const locationDisplay = useMemo(() => {
    if (homeCity && homeState) {
      return `${homeCity}, ${homeState}`;
    } else if (homeCity) {
      return homeCity;
    } else if (homeLat && homeLng) {
      return "Location set";
    }
    return "Not set";
  }, [homeCity, homeState, homeLat, homeLng]);

  const memberSince = useMemo(() => {
    if (!profile?.created_at) return "";
    return new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }, [profile?.created_at]);

  const initials = useMemo(() => {
    if (!displayName || displayName === "Customer") return "C";
    return displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }, [displayName]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
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
          paddingLeft: spacing.md + insets.left,
          paddingRight: spacing.md + insets.right,
          paddingBottom: spacing.xl + insets.bottom,
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
                      backgroundColor: colors.accent + "20",
                      gap: 4,
                    }}
                  >
                    <Ionicons name="person" size={12} color={colors.accent} />
                    <Text style={{ fontWeight: "800", color: colors.accent, fontSize: 11 }}>CUSTOMER</Text>
                  </View>
                  {memberSince && (
                    <Text style={{ ...text.muted, fontSize: 12 }}>Since {memberSince}</Text>
                  )}
                </View>
              </View>
            </View>

            {(jobStats.active > 0 || jobStats.completed > 0) && (
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
                    <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textPrimary }}>
                      {ratingStats.avg > 0 ? ratingStats.avg.toFixed(1) : "—"}
                    </Text>
                  </View>
                  <Text style={{ ...text.muted, fontSize: 11 }}>Rating ({ratingStats.count})</Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.border + "40" }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: colors.accent }}>{jobStats.active}</Text>
                  <Text style={{ ...text.muted, fontSize: 11 }}>Active Jobs</Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.border + "40" }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: "#10b981" }}>{jobStats.completed}</Text>
                  <Text style={{ ...text.muted, fontSize: 11 }}>Completed</Text>
                </View>
              </View>
            )}

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
                {editing ? "CANCEL EDITING" : "EDIT PROFILE"}
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
                <Text style={text.section}>Contact Information</Text>
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
              </View>
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#3b82f6" + "20", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="car-sport-outline" size={16} color="#3b82f6" />
                  </View>
                  <Text style={text.section}>My Vehicles</Text>
                </View>
                {vehicles.length > 0 && (
                  <Pressable
                    onPress={() => router.push("/(customer)/garage/add")}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                    <Text style={{ fontWeight: "700", color: colors.accent, fontSize: 13 }}>Add</Text>
                  </Pressable>
                )}
              </View>
              {vehicles.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
                  <Ionicons name="car-outline" size={40} color={colors.textMuted} />
                  <Text style={{ ...text.body, fontWeight: "600", marginTop: spacing.sm }}>No vehicles added</Text>
                  <Text style={{ ...text.muted, fontSize: 13, textAlign: "center", marginTop: 4 }}>
                    Add your vehicles for faster service requests
                  </Text>
                  <Pressable
                    onPress={() => router.push("/(customer)/garage/add")}
                    style={({ pressed }) => ({
                      marginTop: spacing.md,
                      paddingVertical: 10,
                      paddingHorizontal: 20,
                      borderRadius: radius.md,
                      backgroundColor: colors.accent,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ fontWeight: "700", color: colors.black }}>Add Vehicle</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                  {vehicles.slice(0, 3).map((vehicle, index) => (
                    <Pressable
                      key={vehicle.id}
                      onPress={() => router.push(`/(customer)/garage/${vehicle.id}`)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingVertical: 10,
                        borderTopWidth: index > 0 ? 1 : 0,
                        borderTopColor: colors.border + "40",
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
                        <Ionicons name="car-sport" size={20} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...text.body, fontWeight: "700" }}>
                          {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Unknown Vehicle"}
                        </Text>
                        {vehicle.make && <Text style={{ ...text.muted, fontSize: 12 }}>{vehicle.make}</Text>}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  ))}
                  {vehicles.length > 3 && (
                    <Pressable
                      onPress={() => router.push("/(customer)/garage")}
                      style={{ alignItems: "center", paddingVertical: 8 }}
                    >
                      <Text style={{ fontWeight: "600", color: colors.accent, fontSize: 13 }}>
                        View all {vehicles.length} vehicles
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#8b5cf6" + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={16} color="#8b5cf6" />
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

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.xs }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#10b981" + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="card-outline" size={16} color="#10b981" />
                </View>
                <Text style={text.section}>Payment Method</Text>
              </View>
              {paymentMethod?.stripe_payment_method_id ? (
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radius.md,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Ionicons name="card" size={22} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                        {paymentMethod.card_brand?.toUpperCase() || "Card"} •••• {paymentMethod.card_last4}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
                        Expires {paymentMethod.card_exp_month}/{paymentMethod.card_exp_year}
                      </Text>
                    </View>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#10b981" + "20", borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: "800", color: "#10b981" }}>DEFAULT</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={setupPaymentMethod}
                    disabled={settingUpPayment}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      opacity: pressed || settingUpPayment ? 0.7 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    })}
                  >
                    {settingUpPayment ? (
                      <ActivityIndicator color={colors.textPrimary} size="small" />
                    ) : (
                      <>
                        <Ionicons name="swap-horizontal-outline" size={16} color={colors.textPrimary} />
                        <Text style={{ fontWeight: "700", color: colors.textPrimary, fontSize: 14 }}>
                          Change Card
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                  <Ionicons name="card-outline" size={36} color={colors.textMuted} />
                  <Text style={{ ...text.body, fontWeight: "600", marginTop: spacing.sm }}>No payment method</Text>
                  <Text style={{ ...text.muted, fontSize: 13, textAlign: "center", marginTop: 4 }}>
                    Add a card for quick checkout
                  </Text>
                  <Pressable
                    onPress={setupPaymentMethod}
                    disabled={settingUpPayment}
                    style={({ pressed }) => ({
                      marginTop: spacing.md,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      borderRadius: radius.md,
                      backgroundColor: colors.accent,
                      opacity: pressed || settingUpPayment ? 0.8 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    })}
                  >
                    {settingUpPayment ? (
                      <ActivityIndicator color={colors.black} size="small" />
                    ) : (
                      <>
                        <Ionicons name="add" size={18} color={colors.black} />
                        <Text style={{ fontWeight: "700", color: colors.black }}>Add Card</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>



            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#FFB800" + "20", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="star-outline" size={16} color="#FFB800" />
                  </View>
                  <Text style={text.section}>My Reviews ({ratingStats.count})</Text>
                </View>
                {reviews.length > 0 && profile?.id && (
                  <Pressable onPress={() => router.push(`/profile/${profile.id}`)}>
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
                  {reviews.slice(0, 3).map((review: any) => (
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
                                {(review.reviewer?.full_name || "M").charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <Text style={{ fontWeight: "600", color: colors.textPrimary, fontSize: 14 }}>
                            {review.reviewer?.full_name || "Mechanic"}
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
          <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.md }]}>
            <Text style={text.section}>Edit Profile</Text>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...text.muted, fontSize: 13 }}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={(val) => handleFieldChange(setFullName, val)}
                placeholder="Enter your name"
                placeholderTextColor={colors.textMuted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                  fontSize: 15,
                }}
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...text.muted, fontSize: 13 }}>Phone</Text>
              <TextInput
                value={phone}
                onChangeText={(val) => handleFieldChange(setPhone, val)}
                placeholder="(555) 555-5555"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 12,
                  color: colors.textPrimary,
                  backgroundColor: colors.bg,
                  fontSize: 15,
                }}
              />
            </View>

            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#f59e0b" + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="location-outline" size={16} color="#f59e0b" />
                </View>
                <Text style={{ ...text.muted, fontSize: 13, fontWeight: "600" }}>Home Location</Text>
              </View>
              <Text style={{ ...text.muted, fontSize: 13 }}>
                Set your home location for faster service requests
              </Text>
              {homeLat && homeLng && (
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
                      {homeLat && homeLng ? "Update Location" : "Use Current Location"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            <Pressable
              onPress={saveProfile}
              disabled={saving}
              style={({ pressed }) => [
                {
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: radius.md,
                  backgroundColor: colors.accent,
                  opacity: pressed || saving ? 0.7 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: spacing.sm,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.black} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.black} />
                  <Text style={{ fontWeight: "900", color: colors.black }}>
                    SAVE CHANGES
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={goToLegal}
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
          onPress={() => router.push("/(customer)/invite")}
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
              backgroundColor: "#10B981" + "20",
              borderWidth: 1,
              borderColor: "#10B981" + "30",
            }}
          >
            <Ionicons name="gift-outline" size={22} color="#10B981" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}>Invite & Earn</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
              Refer friends, get free platform fees
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
          WrenchGo • Customer
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
