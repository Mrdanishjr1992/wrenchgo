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
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { DeleteAccountButton } from "../../../src/components/DeleteAccountButton";
import { HelpSupportSection } from "../../../src/components/HelpSupportSection";
import * as ImagePicker from "expo-image-picker";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useStripe } from "@stripe/stripe-react-native";
import { acceptInvitation, hasUsedReferral } from "../../../src/lib/promos";
import { checkIsAdmin } from "../../../src/lib/verification";
import { LinearGradient } from "expo-linear-gradient";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

function SectionCard({
  children,
  title,
  icon,
  iconColor,
  action,
  onAction,
  delay = 0,
}: {
  children: React.ReactNode;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  action?: string;
  onAction?: () => void;
  delay?: number;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(300)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        ...shadows.sm,
      }}
    >
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.md,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: radius.lg,
            backgroundColor: withAlpha(iconColor, 0.12),
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
          <Text style={{
            fontSize: 16,
            fontWeight: "700",
            color: colors.textPrimary,
          }}>{title}</Text>
        </View>
        {action && onAction && (
          <Pressable onPress={onAction} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}>{action}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </Animated.View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  isLast = false
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const { colors, spacing, withAlpha } = useTheme();

  return (
    <View style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.sm,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: withAlpha(colors.border, 0.5),
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <Text style={{ fontSize: 14, color: colors.textMuted }}>{label}</Text>
      </View>
      <Text style={{
        fontSize: 14,
        fontWeight: "600",
        color: value && value !== "Not set" ? colors.textPrimary : colors.textMuted
      }}>{value || "Not set"}</Text>
    </View>
  );
}

function LoadingSkeleton() {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  const shimmer = {
    backgroundColor: withAlpha(colors.textMuted, 0.08),
    borderRadius: radius.md,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg }}>
      <View style={{ paddingTop: insets.top + spacing.lg, marginBottom: spacing.xl }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={[shimmer, { width: 80, height: 80, borderRadius: 28 }]} />
          <View style={{ flex: 1 }}>
            <View style={[shimmer, { width: 150, height: 24, marginBottom: 8 }]} />
            <View style={[shimmer, { width: 100, height: 16 }]} />
          </View>
        </View>
      </View>

      <View style={[shimmer, { height: 100, borderRadius: radius.xl, marginBottom: spacing.md }]} />
      <View style={[shimmer, { height: 150, borderRadius: radius.xl, marginBottom: spacing.md }]} />
      <View style={[shimmer, { height: 120, borderRadius: radius.xl, marginBottom: spacing.md }]} />
      <View style={[shimmer, { height: 80, borderRadius: radius.xl }]} />
    </View>
  );
}

export default function CustomerAccount() {
  const router = useRouter();
  const { mode, toggle, colors, spacing, radius, shadows, withAlpha, text } = useTheme();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const card = useMemo(() => ({
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadows.sm,
  }), [colors, radius, shadows]);

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
  const [ratingStats, setRatingStats] = useState({ avg: 0, count: 0, avgCommunication: 0, avgPunctuality: 0, avgPayment: 0 });
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [referralInput, setReferralInput] = useState("");
  const [applyingReferral, setApplyingReferral] = useState(false);
  const [hasUsedReferralCode, setHasUsedReferralCode] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
          created_at,
          payment_method_status,
          role
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
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
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

      const { data: reviewsData, count: totalReviewCount } = await supabase
        .from("reviews")
        .select(`
          id,
          overall_rating,
          communication_rating,
          punctuality_rating,
          payment_rating,
          comment,
          created_at,
          reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)
        `, { count: 'exact' })
        .eq("reviewee_id", data.id)
        .eq("is_hidden", false)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10);

      setReviews(reviewsData || []);

      const reviewCount = totalReviewCount || 0;
      const avgRating = reviewCount > 0 && reviewsData && reviewsData.length > 0
        ? reviewsData.reduce((sum: number, r: any) => sum + (r.overall_rating || 0), 0) / reviewsData.length
        : 0;
      const avgCommunication = reviewCount > 0 && reviewsData && reviewsData.length > 0
        ? reviewsData.reduce((sum: number, r: any) => sum + (r.communication_rating || 0), 0) / reviewsData.length
        : 0;
      const avgPunctuality = reviewCount > 0 && reviewsData && reviewsData.length > 0
        ? reviewsData.reduce((sum: number, r: any) => sum + (r.punctuality_rating || 0), 0) / reviewsData.length
        : 0;
      const avgPayment = reviewCount > 0 && reviewsData && reviewsData.length > 0
        ? reviewsData.reduce((sum: number, r: any) => sum + (r.payment_rating || 0), 0) / reviewsData.length
        : 0;
      setRatingStats({ avg: avgRating, count: reviewCount, avgCommunication, avgPunctuality, avgPayment });

      const referralUsed = await hasUsedReferral();
      setHasUsedReferralCode(referralUsed);

      const adminStatus = await checkIsAdmin();
      setIsAdmin(adminStatus);

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

  const handleApplyReferral = useCallback(async () => {
    if (!referralInput.trim() || hasUsedReferralCode) return;
    setApplyingReferral(true);
    try {
      const result = await acceptInvitation(referralInput.trim().toUpperCase());
      if (result.success) {
        Alert.alert("Success!", "Referral code applied! The person who invited you has been rewarded.");
        setReferralInput("");
        setHasUsedReferralCode(true);
      } else {
        Alert.alert("Error", result.error || "Failed to apply referral code");
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to apply referral code");
    } finally {
      setApplyingReferral(false);
    }
  }, [referralInput, hasUsedReferralCode]);

  const uploadPhoto = useCallback(async (uri: string | undefined) => {
    if (!uri) return;
    setPhotoModalVisible(false);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return router.replace("/(auth)/sign-in");

      const ext = getExt(uri);
      const buffer = await uriToArrayBuffer(uri);
      const path = `${userId}.${ext}`;

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
      console.error("Upload error:", e);
      Alert.alert("Upload error", e?.message ?? "Failed to update photo.");
    }
  }, [load, router]);

  const pickFromCamera = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow access to your camera.");
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (!result.canceled) await uploadPhoto(result.assets?.[0]?.uri);
    } catch (e: any) {
      console.error("Camera error:", e);
      Alert.alert("Camera error", e?.message ?? "Failed to take photo.");
    }
  }, [uploadPhoto]);

  const pickFromGallery = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow access to your photos.");
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (!result.canceled) await uploadPhoto(result.assets?.[0]?.uri);
    } catch (e: any) {
      console.error("Photo error:", e);
      Alert.alert("Photo error", e?.message ?? "Failed to select photo.");
    }
  }, [uploadPhoto]);

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
    return <LoadingSkeleton />;
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
                onPress={() => setPhotoModalVisible(true)}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 24,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: withAlpha(colors.accent, 0.25),
                  backgroundColor: colors.surface,
                }}
              >
                {profile?.avatar_url ? (
                  <Image key={profile.avatar_url} source={avatarSource} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(colors.accent, 0.2) }}>
                    <Text style={{ fontSize: 24, fontWeight: "700", color: colors.accent }}>{initials}</Text>
                  </View>
                )}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: withAlpha(colors.black, 0.6),
                    alignItems: "center",
                    paddingVertical: 3,
                  }}
                >
                  <Ionicons name="camera" size={12} color={colors.white} />
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
                      backgroundColor: withAlpha(colors.accent, 0.2),
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
                borderTopColor: withAlpha(colors.border, 0.4),
              }}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="star" size={16} color={colors.warning} />
                    <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textPrimary }}>
                      {ratingStats.avg > 0 ? ratingStats.avg.toFixed(1) : "—"}
                    </Text>
                  </View>
                  <Text style={{ ...text.muted, fontSize: 11 }}>Rating ({ratingStats.count})</Text>
                </View>
                <View style={{ width: 1, backgroundColor: withAlpha(colors.border, 0.4) }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: colors.accent }}>{jobStats.active}</Text>
                  <Text style={{ ...text.muted, fontSize: 11 }}>Active Jobs</Text>
                </View>
                <View style={{ width: 1, backgroundColor: withAlpha(colors.border, 0.4) }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: colors.success }}>{jobStats.completed}</Text>
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
                color={editing ? colors.buttonText : colors.textPrimary}
              />
              <Text style={{ fontWeight: "800", color: editing ? colors.buttonText : colors.textPrimary }}>
                {editing ? "CANCEL EDITING" : "EDIT PROFILE"}
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        {!editing && (
          <>
            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: withAlpha(colors.accent, 0.2), alignItems: "center", justifyContent: "center" }}>
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
                <View style={{ height: 1, backgroundColor: withAlpha(colors.border, 0.4) }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                    <Text style={text.muted}>Phone</Text>
                  </View>
                  <Text style={{ ...text.body, fontWeight: "600", color: phone ? colors.textPrimary : colors.textMuted }}>
                    {phone || "Not set"}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: withAlpha(colors.border, 0.4) }} />
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
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: withAlpha(colors.info, 0.2), alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="car-sport-outline" size={16} color={colors.info} />
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
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: withAlpha(colors.primary, 0.2), alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={16} color={colors.primary} />
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
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: withAlpha(colors.success, 0.2), alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="card-outline" size={16} color={colors.success} />
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
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.success, 0.2), borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: "800", color: colors.success }}>DEFAULT</Text>
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
                onPress={() => router.push("/(customer)/invite")}
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
                      backgroundColor: withAlpha(colors.warning, 0.15),
                    }}
                  >
                    <Ionicons name="gift-outline" size={18} color={colors.warning} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ ...text.body, fontWeight: "900", color: colors.textPrimary }}>
                      Invite & Earn
                    </Text>
                    <Text style={{ ...text.muted, marginTop: 3 }}>
                      Refer friends, get free platform fees
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: withAlpha(colors.warning, 0.2), alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="star-outline" size={16} color={colors.warning} />
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
                  <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="star" size={16} color={colors.warning} />
                        <Text style={{ fontWeight: "700", color: colors.textPrimary, fontSize: 16 }}>{ratingStats.avg.toFixed(1)}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>Overall</Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
                        <Text style={{ fontWeight: "600", color: colors.textPrimary, fontSize: 14 }}>{ratingStats.avgCommunication.toFixed(1)}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>Communication</Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                        <Text style={{ fontWeight: "600", color: colors.textPrimary, fontSize: 14 }}>{ratingStats.avgPunctuality.toFixed(1)}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>Punctuality</Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="card-outline" size={14} color={colors.textSecondary} />
                        <Text style={{ fontWeight: "600", color: colors.textPrimary, fontSize: 14 }}>{ratingStats.avgPayment.toFixed(1)}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>Payment</Text>
                    </View>
                  </View>
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
                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: withAlpha(colors.accent, 0.2), alignItems: "center", justifyContent: "center" }}>
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
                          <Ionicons name="star" size={14} color={colors.warning} />
                          <Text style={{ fontWeight: "700", color: colors.textPrimary, fontSize: 14 }}>
                            {review.overall_rating}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                        {review.communication_rating > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="chatbubble-outline" size={12} color={colors.textMuted} />
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{review.communication_rating}</Text>
                          </View>
                        )}
                        {review.punctuality_rating > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{review.punctuality_rating}</Text>
                          </View>
                        )}
                        {review.payment_rating > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="card-outline" size={12} color={colors.textMuted} />
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{review.payment_rating}</Text>
                          </View>
                        )}
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
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: withAlpha(colors.warning, 0.2), alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="location-outline" size={16} color={colors.warning} />
                </View>
                <Text style={{ ...text.muted, fontSize: 13, fontWeight: "600" }}>Home Location</Text>
              </View>
              <Text style={{ ...text.muted, fontSize: 13 }}>
                Set your home location for faster service requests
              </Text>
              {homeLat && homeLng && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.xs }}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
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

        <HelpSupportSection variant="card" />

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

        {!hasUsedReferralCode && (
          <View style={[card, { padding: spacing.lg, borderRadius: radius.lg }]}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.xs }}>
              Enter Referral Code (One-Time Only)
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: spacing.md }}>
              Have a friend's code? Enter it below. This cannot be changed later.
            </Text>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "600",
                  letterSpacing: 2,
                }}
                placeholder="Enter code"
                placeholderTextColor={colors.textMuted}
                value={referralInput}
                onChangeText={setReferralInput}
                autoCapitalize="characters"
                maxLength={8}
              />
              <Pressable
                onPress={handleApplyReferral}
                disabled={!referralInput.trim() || applyingReferral}
                style={({ pressed }) => ({
                  backgroundColor: colors.accent,
                  paddingHorizontal: spacing.lg,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: (!referralInput.trim() || applyingReferral) ? 0.5 : pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontWeight: "700", color: colors.black }}>
                  {applyingReferral ? "..." : "Apply"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {isAdmin && (
          <Pressable
            onPress={() => router.push('/(admin)')}
            style={({ pressed }) => [
              card,
              {
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderRadius: radius.lg,
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={18} color={colors.white} />
            <Text style={{ fontWeight: "900", color: colors.white }}>ADMIN PANEL</Text>
          </Pressable>
        )}

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
          <Ionicons name="log-out-outline" size={18} color={colors.buttonText} />
          <Text style={{ fontWeight: "900", color: colors.buttonText }}>SIGN OUT</Text>
        </Pressable>

        <View style={{ marginTop: spacing.sm }}>
          <DeleteAccountButton variant="card" />
        </View>

        <Text style={{ ...text.muted, textAlign: "center", marginTop: spacing.sm, fontSize: 12 }}>
          WrenchGo • Customer
        </Text>
      </ScrollView>

      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: withAlpha(colors.black, 0.5),
            justifyContent: "flex-end",
          }}
          onPress={() => setPhotoModalVisible(false)}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: insets.bottom + 16,
              paddingTop: 8,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: colors.border,
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            <Text
              style={{
                ...text.title,
                fontSize: 18,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              Change Profile Photo
            </Text>

            <Pressable
              onPress={pickFromCamera}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 16,
                paddingHorizontal: 24,
                backgroundColor: pressed ? colors.surface : "transparent",
                gap: 16,
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.accent + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="camera" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.body, fontWeight: "600" }}>Take Photo</Text>
                <Text style={{ ...text.muted, fontSize: 13 }}>Use your camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={pickFromGallery}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 16,
                paddingHorizontal: 24,
                backgroundColor: pressed ? colors.surface : "transparent",
                gap: 16,
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.info + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="images" size={24} color={colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.body, fontWeight: "600" }}>Choose from Gallery</Text>
                <Text style={{ ...text.muted, fontSize: 13 }}>Select an existing photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => setPhotoModalVisible(false)}
              style={({ pressed }) => ({
                marginTop: 8,
                marginHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: pressed ? colors.surface : colors.border + "40",
                alignItems: "center",
              })}
            >
              <Text style={{ ...text.body, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
