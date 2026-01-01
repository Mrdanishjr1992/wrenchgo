import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { DeleteAccountButton } from "../../../src/components/DeleteAccountButton";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { uploadIDPhoto, deleteIDPhoto, getIDPhotoUrl } from "../../../src/lib/verification";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  photo_url: string | null;
  role: "customer" | "mechanic" | "admin";
  id_photo_path: string | null;
  id_status: "pending" | "verified" | "rejected" | null;
  id_rejected_reason: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
};

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

export default function Account() {
  const router = useRouter();
  const { mode, toggle, colors, spacing, radius, text } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null);
  const [homeLatitude, setHomeLatitude] = useState("");
  const [homeLongitude, setHomeLongitude] = useState("");
  const [uploadingID, setUploadingID] = useState(false);
  const [idExpanded, setIdExpanded] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const userId = sessionData.session?.user?.id;
      if (!userId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data, error: pErr } = await supabase
        .from("profiles")
        .select("id,full_name,phone,photo_url,role,id_photo_path,id_status,id_rejected_reason,home_latitude,home_longitude")
        .eq("auth_id", userId)

        .single();

      if (pErr) throw pErr;
      setProfile(data as ProfileRow);
      setFullName(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setHomeLatitude(data.home_latitude?.toString() ?? "");
      setHomeLongitude(data.home_longitude?.toString() ?? "");

      if (data.id_photo_path) {
        const url = await getIDPhotoUrl(data.id_photo_path);
        setIdPhotoUrl(url);
      } else {
        setIdPhotoUrl(null);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load account.";
      Alert.alert("Account error", message);
      router.replace("/(auth)/sign-in");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
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

      const uri = result.assets[0].uri;
      const ext = getExt(uri);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        Alert.alert("Error", "Session expired. Please sign in again.");
        router.replace("/(auth)/sign-in");
        return;
      }

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
        .eq("auth_id", userId)
;

      Alert.alert("Success", "Profile photo updated.");
      load();
    } catch (e: any) {
      Alert.alert("Photo error", e.message ?? "Failed to update photo.");
    }
  }, [load, router]);

  const saveProfile = useCallback(async () => {
    try {
      setSaving(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        Alert.alert("Error", "Session expired. Please sign in again.");
        router.replace("/(auth)/sign-in");
        return;
      }

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

      await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          home_latitude: lat,
          home_longitude: lng,
        })
        .eq("auth_id", userId)
;

      Alert.alert("Saved", "Profile updated successfully.");
      setEditing(false);
      load();
    } catch (e: any) {
      Alert.alert("Save error", e.message ?? "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }, [fullName, phone, homeLatitude, homeLongitude, router, load]);

const signOut = useCallback(async () => {
  setBusy(true);
  try {
    // If session is already gone, this may throw "Auth session missing"
    const { error } = await supabase.auth.signOut();

    // Treat missing-session as already signed out
    if (error && !/session/i.test(error.message)) {
      throw error;
    }
  } catch (e) {
    console.warn("Sign out warning:", e);
    // still continue
  } finally {
    setBusy(false);
    // Replace so user can't go "back" into authed screens
try { await GoogleSignin.signOut(); } catch {}
router.replace("/(auth)/sign-in");

  }
}, [router]);

const handleUploadID = useCallback(async () => {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });

    if (result.canceled) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      Alert.alert("Error", "Session expired. Please sign in again.");
      router.replace("/(auth)/sign-in");
      return;
    }

    setUploadingID(true);
    const uploadResult = await uploadIDPhoto(result.assets[0].uri, userId);

    if (uploadResult.success) {
      Alert.alert("Success", "ID photo uploaded! Verification in progress...");
      load();
    } else {
      Alert.alert("Upload failed", uploadResult.error || "Failed to upload ID photo");
    }
  } catch (e: any) {
    Alert.alert("Upload error", e.message ?? "Failed to upload ID photo");
  } finally {
    setUploadingID(false);
  }
}, [load, router]);

const handleDeleteID = useCallback(async () => {
  Alert.alert(
    "Delete ID Photo",
    "Are you sure you want to delete your ID photo? You'll need to upload a new one to request services.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const userId = sessionData.session?.user?.id;

            if (!userId) {
              Alert.alert("Error", "Session expired. Please sign in again.");
              router.replace("/(auth)/sign-in");
              return;
            }

            setUploadingID(true);
            const result = await deleteIDPhoto(userId);

            if (result.success) {
              Alert.alert("Deleted", "ID photo deleted successfully");
              load();
            } else {
              Alert.alert("Delete failed", result.error || "Failed to delete ID photo");
            }
          } catch (e: any) {
            Alert.alert("Delete error", e.message ?? "Failed to delete ID photo");
          } finally {
            setUploadingID(false);
          }
        },
      },
    ]
  );
}, [load, router]);

  const avatarSource = profile?.photo_url
    ? { uri: profile.photo_url }
    : require("../../../assets/profile.png");

  const displayName =
    profile?.full_name && profile.full_name.trim().length > 0
      ? profile.full_name
      : "Your Account";

  const subtitle =
    profile?.phone && profile.phone.trim().length > 0
      ? profile.phone
      : "Customer";

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
              <Text style={text.section}>Contact Info</Text>
              <View style={{ gap: spacing.xs }}>
                {fullName && (
                  <View>
                    <Text style={text.muted}>Full name</Text>
                    <Text style={{ ...text.body, marginTop: 2 }}>{fullName}</Text>
                  </View>
                )}
                {phone && (
                  <View>
                    <Text style={text.muted}>Phone</Text>
                    <Text style={{ ...text.body, marginTop: 2 }}>{phone}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>Appearance</Text>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                }}
                >
              </View>

              <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
                <Text style={text.section}>ID Verification</Text>

                {profile?.id_status === "verified" && (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#10b981",
                      borderRadius: radius.md,
                      padding: spacing.md,
                      backgroundColor: `#10b98110`,
                      gap: spacing.sm,
                    }}
                  >
                    <Pressable
                      onPress={() => setIdExpanded(!idExpanded)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "#10b981",
                          backgroundColor: "#10b98120",
                        }}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ ...text.body, fontWeight: "900", color: "#10b981" }}>
                          Verified
                        </Text>
                        <Text style={{ ...text.muted, marginTop: 3, fontSize: 12 }}>
                          Your ID has been verified
                        </Text>
                      </View>

                      <Ionicons
                        name={idExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#10b981"
                      />
                    </Pressable>

                    {idExpanded && (
                      <>
                        {idPhotoUrl && (
                          <Image
                            source={{ uri: idPhotoUrl }}
                            style={{
                              width: "100%",
                              height: 150,
                              borderRadius: radius.md,
                              backgroundColor: colors.surface,
                            }}
                            resizeMode="contain"
                          />
                        )}

                        <View style={{ flexDirection: "row", gap: spacing.sm }}>
                          <Pressable
                            onPress={handleUploadID}
                            disabled={uploadingID}
                            style={{
                              flex: 1,
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: radius.md,
                              padding: spacing.sm,
                              alignItems: "center",
                              backgroundColor: colors.bg,
                              opacity: uploadingID ? 0.7 : 1,
                            }}
                          >
                            <Text style={{ ...text.body, fontWeight: "900", fontSize: 12 }}>
                              {uploadingID ? "Uploading..." : "Re-upload"}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={handleDeleteID}
                            disabled={uploadingID}
                            style={{
                              flex: 1,
                              borderWidth: 1,
                              borderColor: "#ef4444",
                              borderRadius: radius.md,
                              padding: spacing.sm,
                              alignItems: "center",
                              backgroundColor: `#ef444410`,
                              opacity: uploadingID ? 0.7 : 1,
                            }}
                          >
                            <Text style={{ fontWeight: "900", fontSize: 12, color: "#ef4444" }}>
                              Delete
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {profile?.id_status === "pending" && (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#f59e0b",
                      borderRadius: radius.md,
                      padding: spacing.md,
                      backgroundColor: `#f59e0b10`,
                      gap: spacing.sm,
                    }}
                  >
                    <Pressable
                      onPress={() => setIdExpanded(!idExpanded)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "#f59e0b",
                          backgroundColor: "#f59e0b20",
                        }}
                      >
                        <Ionicons name="time-outline" size={20} color="#f59e0b" />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ ...text.body, fontWeight: "900", color: "#f59e0b" }}>
                          Pending Verification
                        </Text>
                        <Text style={{ ...text.muted, marginTop: 3, fontSize: 12 }}>
                          Your ID is being verified
                        </Text>
                      </View>

                      <Ionicons
                        name={idExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#f59e0b"
                      />
                    </Pressable>

                    {idExpanded && (
                      <>
                        {idPhotoUrl && (
                          <Image
                            source={{ uri: idPhotoUrl }}
                            style={{
                              width: "100%",
                              height: 150,
                              borderRadius: radius.md,
                              backgroundColor: colors.surface,
                            }}
                            resizeMode="contain"
                          />
                        )}

                        <View style={{ flexDirection: "row", gap: spacing.sm }}>
                          <Pressable
                            onPress={handleUploadID}
                            disabled={uploadingID}
                            style={{
                              flex: 1,
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: radius.md,
                              padding: spacing.sm,
                              alignItems: "center",
                              backgroundColor: colors.bg,
                              opacity: uploadingID ? 0.7 : 1,
                            }}
                          >
                            <Text style={{ ...text.body, fontWeight: "900", fontSize: 12 }}>
                              {uploadingID ? "Uploading..." : "Re-upload"}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={handleDeleteID}
                            disabled={uploadingID}
                            style={{
                              flex: 1,
                              borderWidth: 1,
                              borderColor: "#ef4444",
                              borderRadius: radius.md,
                              padding: spacing.sm,
                              alignItems: "center",
                              backgroundColor: `#ef444410`,
                              opacity: uploadingID ? 0.7 : 1,
                            }}
                          >
                            <Text style={{ fontWeight: "900", fontSize: 12, color: "#ef4444" }}>
                              Delete
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {profile?.id_status === "rejected" && (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "#ef4444",
                      borderRadius: radius.md,
                      padding: spacing.md,
                      backgroundColor: `#ef444410`,
                      gap: spacing.sm,
                    }}
                  >
                    <Pressable
                      onPress={() => setIdExpanded(!idExpanded)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "#ef4444",
                          backgroundColor: "#ef444420",
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ ...text.body, fontWeight: "900", color: "#ef4444" }}>
                          Verification Failed
                        </Text>
                        <Text style={{ ...text.muted, marginTop: 3, fontSize: 12 }}>
                          {profile.id_rejected_reason || "Please upload a valid ID"}
                        </Text>
                      </View>

                      <Ionicons
                        name={idExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#ef4444"
                      />
                    </Pressable>

                    {idExpanded && (
                      <>
                        {idPhotoUrl && (
                          <Image
                            source={{ uri: idPhotoUrl }}
                            style={{
                              width: "100%",
                              height: 150,
                              borderRadius: radius.md,
                              backgroundColor: colors.surface,
                            }}
                            resizeMode="contain"
                          />
                        )}

                        <View style={{ flexDirection: "row", gap: spacing.sm }}>
                          <Pressable
                            onPress={handleUploadID}
                            disabled={uploadingID}
                            style={{
                              flex: 1,
                              borderWidth: 1,
                              borderColor: colors.accent,
                              borderRadius: radius.md,
                              padding: spacing.sm,
                              alignItems: "center",
                              backgroundColor: colors.accent,
                              opacity: uploadingID ? 0.7 : 1,
                            }}
                          >
                            <Text style={{ fontWeight: "900", fontSize: 12, color: colors.black }}>
                              {uploadingID ? "Uploading..." : "Upload New ID"}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={handleDeleteID}
                            disabled={uploadingID}
                            style={{
                              flex: 1,
                              borderWidth: 1,
                              borderColor: "#ef4444",
                              borderRadius: radius.md,
                              padding: spacing.sm,
                              alignItems: "center",
                              backgroundColor: `#ef444410`,
                              opacity: uploadingID ? 0.7 : 1,
                            }}
                          >
                            <Text style={{ fontWeight: "900", fontSize: 12, color: "#ef4444" }}>
                              Delete
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {!profile?.id_status && (
                  <Pressable
                    onPress={handleUploadID}
                    disabled={uploadingID}
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
                      opacity: uploadingID ? 0.7 : 1,
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
                        <Ionicons name="card-outline" size={18} color={colors.textPrimary} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ ...text.body, fontWeight: "900", color: colors.textPrimary }}>
                          {uploadingID ? "Uploading..." : "Upload Photo ID"}
                        </Text>
                        <Text style={{ ...text.muted, marginTop: 3 }}>
                          Required to request services
                        </Text>
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>

              <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
                <Text style={text.section}>Appearance</Text>

                <Pressable
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
                </Pressable>
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
            </View>
          </>
        )}

        {editing && (
          <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
            <Text style={text.section}>Basic Info</Text>

            <Text style={text.muted}>Full name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
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
              onChangeText={setPhone}
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

            <Pressable
              onPress={async () => {
                try {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission denied', 'Please allow location access to use this feature.');
                    return;
                  }

                  const location = await Location.getCurrentPositionAsync({});
                  setHomeLatitude(location.coords.latitude.toString());
                  setHomeLongitude(location.coords.longitude.toString());
                  Alert.alert('Success', 'Current location captured');
                } catch (error: any) {
                  Alert.alert('Error', error.message || 'Failed to get location');
                }
              }}
              style={{
                backgroundColor: colors.bgSecondary,
                paddingVertical: 12,
                borderRadius: radius.lg,
                alignItems: "center",
                marginTop: spacing.xs,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location" size={20} color={colors.accent} />
                <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                  Use Current Location
                </Text>
              </View>
            </Pressable>

            <Text style={[text.muted, { marginTop: spacing.sm }]}>Latitude</Text>
            <TextInput
              value={homeLatitude}
              onChangeText={setHomeLatitude}
              placeholder="e.g., 37.7749"
              keyboardType="numeric"
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

            <Text style={text.muted}>Longitude</Text>
            <TextInput
              value={homeLongitude}
              onChangeText={setHomeLongitude}
              placeholder="e.g., -122.4194"
              keyboardType="numeric"
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

            <Pressable
              onPress={saveProfile}
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
          </View>
        )}

        <Pressable
          onPress={() => router.push("/(customer)/legal")}
          style={({ pressed }) => [card,
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
          <Text style={{ fontWeight: "900", color: colors.textPrimary }}>
            LEGAL
          </Text>
        </Pressable>

        <Pressable
          onPress={signOut}
          disabled={busy}
          style={({ pressed }) => [card,
            {
              borderWidth: 1,
              borderColor: colors.black,
              backgroundColor: colors.accent,
              paddingVertical: 16,
              borderRadius: radius.lg,
              alignItems: "center",
              opacity: busy ? 0.7 : pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
              flexDirection: "row",
              justifyContent: "center",
              gap: 10,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.black} />
          <Text style={{ fontWeight: "900", color: colors.black }}>
            {busy ? "SIGNING OUT…" : "SIGN OUT"}
          </Text>
        </Pressable>

        <View style={{ marginTop: spacing.lg }}>
          <DeleteAccountButton variant="card" />
        </View>

        <Text style={{ ...text.muted, textAlign: "center", marginTop: 6 }}>
          WrenchGo • Customer
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
