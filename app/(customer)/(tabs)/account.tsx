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

export default function CustomerAccount() {
  const router = useRouter();
  const { mode, toggle, colors, spacing, radius, text } = useTheme();
  const insets = useSafeAreaInsets();
  const card = useMemo(() => createCard(colors), [colors]);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [settingUpPayment, setSettingUpPayment] = useState(false);

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
          city,
          id_verified,
          id_verified_at
        `)
        .eq("auth_id", userId)
        .single();

      if (error) throw error;

      setProfile(data);
      setFullName(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setCity(data.city ?? "");

      const { data: paymentData } = await supabase
        .from("customer_payment_methods")
        .select("stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year")
        .eq("customer_id", data.id)
        .maybeSingle();

      setPaymentMethod(paymentData);

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

      const upd = await supabase.from("profiles").update({ avatar_url: url }).eq("auth_id", userId);
      if (upd.error) throw upd.error;

      Alert.alert("Success", "Profile photo updated.");
      load();
    } catch (e: any) {
      Alert.alert("Photo error", e?.message ?? "Failed to update photo.");
    }
  }, [load, router]);

  const saveProfile = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          city: city.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      Alert.alert("Success", "Profile updated successfully");
      setEditing(false);
      await load();
    } catch (e: any) {
      console.error("Save error:", e);
      Alert.alert("Error", e?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [profile, fullName, phone, city, load]);

  const fetchCurrentLocation = useCallback(async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please allow location access to use this feature.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude.toFixed(6);
      const lng = location.coords.longitude.toFixed(6);

      setLocationLat(lat);
      setLocationLng(lng);

      if (profile?.id) {
        const { error } = await supabase
          .from("profiles")
          .update({
            city: `${lat}, ${lng}`,
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

  const avatarSource = profile?.avatar_url
    ? { uri: profile.avatar_url }
    : require("../../../assets/profile.png");

  const displayName = fullName && fullName.trim().length > 0 ? fullName : "Customer Account";
  const subtitle = profile?.email ? profile.email : "Customer";

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
                <Image source={avatarSource} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
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

                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
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
                      CUSTOMER
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
              onPress={() => setEditing(!editing)}
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
              <Text style={text.section}>Contact Information</Text>
              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={text.muted}>Email</Text>
                  <Text style={{ ...text.body, fontWeight: "700" }}>{profile?.email || "Not set"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={text.muted}>Phone</Text>
                  <Text style={{ ...text.body, fontWeight: "700" }}>{phone || "Not set"}</Text>
                </View>
                {city && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={text.muted}>City</Text>
                    <Text style={{ ...text.body, fontWeight: "700" }}>{city}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Appearance</Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: spacing.xs,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
                  <View>
                    <Text style={{ ...text.body, fontWeight: "700" }}>Dark mode</Text>
                    <Text style={{ ...text.muted, fontSize: 13, marginTop: 2 }}>
                      Currently: {mode.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggle}
                  trackColor={{ false: colors.border, true: colors.accent }}
                />
              </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Identity Verification</Text>
              {profile?.id_verified ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#10b98120",
                      borderWidth: 1,
                      borderColor: "#10b98130",
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                      Verified
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
                      Identity verified on {new Date(profile.id_verified_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
                      <Ionicons name="shield-checkmark" size={22} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                        Not Verified
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
                        Required to request and accept quotes
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => router.push("/(customer)/verify-identity")}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: radius.md,
                        backgroundColor: colors.accent,
                        opacity: pressed ? 0.9 : 1,
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text style={{ fontWeight: "900", color: colors.black }}>
                      VERIFY IDENTITY
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Payment Method</Text>
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
                        backgroundColor: colors.accent + "20",
                        borderWidth: 1,
                        borderColor: colors.accent + "30",
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
                  </View>
                  <Pressable
                    onPress={setupPaymentMethod}
                    disabled={settingUpPayment}
                    style={({ pressed }) => [
                      {
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
                      },
                    ]}
                  >
                    {settingUpPayment ? (
                      <ActivityIndicator color={colors.textPrimary} size="small" />
                    ) : (
                      <>
                        <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                        <Text style={{ fontWeight: "700", color: colors.textPrimary, fontSize: 14 }}>
                          Update Payment Method
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={setupPaymentMethod}
                  disabled={settingUpPayment}
                  style={({ pressed }) => [
                    {
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.accent,
                      backgroundColor: colors.accent + "10",
                      opacity: pressed || settingUpPayment ? 0.7 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    },
                  ]}
                >
                  {settingUpPayment ? (
                    <ActivityIndicator color={colors.accent} size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                      <Text style={{ fontWeight: "800", color: colors.accent }}>
                        ADD PAYMENT METHOD
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Current Location</Text>
              <Text style={{ ...text.muted, fontSize: 13, marginBottom: spacing.xs }}>
                Save your current location for faster service requests
              </Text>
              <Pressable
                onPress={fetchCurrentLocation}
                disabled={loadingLocation}
                style={({ pressed }) => [
                  {
                    paddingVertical: 14,
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
                  },
                ]}
              >
                {loadingLocation ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <>
                    <Ionicons name="location" size={18} color={colors.accent} />
                    <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                      Use Current Location
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {profile?.id && reviews.length > 0 && (
              <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
                <Text style={text.section}>My Reviews</Text>
                <Text style={{ ...text.muted, fontSize: 13, marginBottom: spacing.xs }}>
                  Reviews from mechanics you've worked with
                </Text>
                {reviews.map((review: any) => (
                  <View
                    key={review.id}
                    style={{
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: spacing.xs,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {review.reviewer?.avatar_url ? (
                          <Image
                            source={{ uri: review.reviewer.avatar_url }}
                            style={{ width: 32, height: 32, borderRadius: 16 }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: colors.accent + "20",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons name="person" size={16} color={colors.accent} />
                          </View>
                        )}
                        <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                          {review.reviewer?.full_name || "Anonymous"}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={star <= review.overall_rating ? "star" : "star-outline"}
                            size={14}
                            color="#FFB800"
                          />
                        ))}
                      </View>
                    </View>
                    {review.comment && (
                      <Text style={{ ...text.body, fontSize: 14, color: colors.textPrimary }}>
                        {review.comment}
                      </Text>
                    )}
                    <Text style={{ ...text.muted, fontSize: 12 }}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
                {reviews.length >= 10 && (
                  <Text style={{ ...text.muted, fontSize: 12, textAlign: "center", marginTop: spacing.xs }}>
                    Showing 10 most recent reviews
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {editing && (
          <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.md }]}>
            <Text style={text.section}>Edit Profile</Text>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...text.muted, fontSize: 13 }}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
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
                onChangeText={setPhone}
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

            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...text.muted, fontSize: 13 }}>City</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Enter your city"
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
