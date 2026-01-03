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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { DeleteAccountButton } from "../../../src/components/DeleteAccountButton";
import * as ImagePicker from "expo-image-picker";
import { uploadIDPhoto, deleteIDPhoto, getIDPhotoUrl } from "../../../src/lib/verification";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

type ProfileRow = {
  id: string;
  auth_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  role: "customer" | "mechanic" | null;

  id_photo_path: string | null;
  id_status: "none" | "pending" | "verified" | "rejected" | null;
  id_rejected_reason: string | null;
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

function isNoRows(err: any) {
  const code = String(err?.code ?? "");
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  const msg = String(err?.message ?? "");
  return code === "PGRST116" || status === 406 || /No rows/i.test(msg) || /0 rows/i.test(msg);
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
  const [uploadingID, setUploadingID] = useState(false);
  const [idExpanded, setIdExpanded] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState(""); // UI-only
  const [homeLatitude, setHomeLatitude] = useState(""); // UI-only
  const [homeLongitude, setHomeLongitude] = useState(""); // UI-only
  const goToLegal = () => router.push("/(customer)/legal");
  const isDark = mode === "dark";

  // ✅ Only redirect when session is truly missing
  const getSessionUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      // Session read failing should NOT instantly boot the user
      console.warn("getSession error:", error);
    }

    const session = data.session;
    if (!session?.user?.id) return null;
    return session.user;
  }, []);

  const ensureProfileRow = useCallback(async (userId: string, email?: string | null) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,auth_id,full_name,avatar_url,email,role,id_photo_path,id_status,id_rejected_reason")
      .eq("auth_id", userId)
      .maybeSingle();

    if (error && !isNoRows(error)) throw error;
    if (data) return data as ProfileRow;

    const ins = await supabase
      .from("profiles")
      .insert([
        {
          auth_id: userId,
          email: email ?? null,
          role: null,
          id_status: "none",
        },
      ])
      .select("id,auth_id,full_name,avatar_url,email,role,id_photo_path,id_status,id_rejected_reason")
      .single();

    if (ins.error) throw ins.error;
    return ins.data as ProfileRow;
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const user = await getSessionUser();
      if (!user?.id) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const row = await ensureProfileRow(user.id, user.email);
      setProfile(row);

      setFullName(row.full_name ?? "");
      setPhone("");
      setHomeLatitude("");
      setHomeLongitude("");

      if (row.id_photo_path) {
        const url = await getIDPhotoUrl(row.id_photo_path);
        setIdPhotoUrl(url);
      } else {
        setIdPhotoUrl(null);
      }
    } catch (e: any) {
      console.warn("Account load error:", e);
      Alert.alert("Account error", e?.message ?? "Failed to load account.");
      // ✅ do NOT redirect unless session is missing
    } finally {
      setLoading(false);
    }
  }, [ensureProfileRow, getSessionUser, router]);

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

      const user = await getSessionUser();
      if (!user?.id) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      const ext = getExt(uri);
      const buffer = await uriToArrayBuffer(uri);
      const path = `avatars/${user.id}.${ext}`;

      const up = await supabase.storage.from("avatars").upload(path, buffer, {
        contentType: contentTypeFromExt(ext),
        upsert: true,
      });
      if (up.error) throw up.error;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;

      const upd = await supabase.from("profiles").update({ avatar_url: url }).eq("auth_id", user.id);
      if (upd.error) throw upd.error;

      Alert.alert("Success", "Profile photo updated.");
      load();
    } catch (e: any) {
      Alert.alert("Photo error", e?.message ?? "Failed to update photo.");
    }
  }, [getSessionUser, load, router]);

  const saveProfile = useCallback(async () => {
    try {
      setSaving(true);

      const user = await getSessionUser();
      if (!user?.id) {
        router.replace("/(auth)/sign-in");
        return;
      }

    const upd = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      })
      .eq("auth_id", user.id);


      if (upd.error) throw upd.error;

      Alert.alert("Saved", "Profile updated successfully.");
      setEditing(false);
      load();
    } catch (e: any) {
      Alert.alert("Save error", e?.message ?? "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }, [fullName, getSessionUser, load, router]);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error && !/session/i.test(error.message)) throw error;
    } catch (e) {
      console.warn("Sign out warning:", e);
    } finally {
      setBusy(false);
      try {
        await GoogleSignin.signOut();
      } catch {}
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

      const user = await getSessionUser();
      if (!user?.id) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setUploadingID(true);
      const uploadResult = await uploadIDPhoto(uri, user.id);

      if (uploadResult.success) {
        Alert.alert("Success", "ID photo uploaded! Verification in progress...");
        load();
      } else {
        Alert.alert("Upload failed", uploadResult.error || "Failed to upload ID photo");
      }
    } catch (e: any) {
      Alert.alert("Upload error", e?.message ?? "Failed to upload ID photo");
    } finally {
      setUploadingID(false);
    }
  }, [getSessionUser, load, router]);

  const handleDeleteID = useCallback(() => {
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
              const user = await getSessionUser();
              if (!user?.id) {
                router.replace("/(auth)/sign-in");
                return;
              }

              setUploadingID(true);
              const result = await deleteIDPhoto(user.id);

              if (result.success) {
                Alert.alert("Deleted", "ID photo deleted successfully");
                load();
              } else {
                Alert.alert("Delete failed", result.error || "Failed to delete ID photo");
              }
            } catch (e: any) {
              Alert.alert("Delete error", e?.message ?? "Failed to delete ID photo");
            } finally {
              setUploadingID(false);
            }
          },
        },
      ]
    );
  }, [getSessionUser, load, router]);

  const avatarSource = profile?.avatar_url
    ? { uri: profile.avatar_url }
    : require("../../../assets/profile.png");

  const displayName =
    profile?.full_name && profile.full_name.trim().length > 0
      ? profile.full_name
      : "Your Account";

  const subtitle = profile?.email ? profile.email : "Customer";

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 10, ...text.muted }}>Loading…</Text>
      </View>
    );
  }

  const status = profile?.id_status ?? "none";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md }}>
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
                      {(profile?.role ?? "customer").toUpperCase()}
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
              style={({ pressed }) => ({
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
              })}
            >
              <Ionicons
                name={editing ? "close-outline" : "create-outline"}
                size={18}
                color={editing ? colors.black : colors.textPrimary}
              />
              <Text style={{ fontWeight: "900", color: editing ? colors.black : colors.textPrimary }}>
                {editing ? "CANCEL EDITING" : "EDIT PROFILE"}
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        {!editing ? (
          <>
            {/* ID Verification */}
            <View style={[card, { padding: spacing.md, borderRadius: radius.lg, gap: spacing.sm }]}>
              <Text style={text.section}>ID Verification</Text>

              {/* VERIFIED */}
              {status === "verified" && (
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
                  <Pressable onPress={() => setIdExpanded(!idExpanded)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
                      <Text style={{ ...text.body, fontWeight: "900", color: "#10b981" }}>Verified</Text>
                      <Text style={{ ...text.muted, marginTop: 3, fontSize: 12 }}>Your ID has been verified</Text>
                    </View>

                    <Ionicons name={idExpanded ? "chevron-up" : "chevron-down"} size={20} color="#10b981" />
                  </Pressable>

                  {idExpanded && (
                    <>
                      {idPhotoUrl && (
                        <Image
                          source={{ uri: idPhotoUrl }}
                          style={{ width: "100%", height: 150, borderRadius: radius.md, backgroundColor: colors.surface }}
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
                          <Text style={{ fontWeight: "900", fontSize: 12, color: "#ef4444" }}>Delete</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* PENDING */}
              {status === "pending" && (
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
                  <Pressable onPress={() => setIdExpanded(!idExpanded)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
                      <Text style={{ ...text.body, fontWeight: "900", color: "#f59e0b" }}>Pending Verification</Text>
                      <Text style={{ ...text.muted, marginTop: 3, fontSize: 12 }}>Your ID is being verified</Text>
                    </View>

                    <Ionicons name={idExpanded ? "chevron-up" : "chevron-down"} size={20} color="#f59e0b" />
                  </Pressable>

                  {idExpanded && idPhotoUrl && (
                    <Image
                      source={{ uri: idPhotoUrl }}
                      style={{ width: "100%", height: 150, borderRadius: radius.md, backgroundColor: colors.surface }}
                      resizeMode="contain"
                    />
                  )}
                </View>
              )}

              {/* REJECTED */}
              {status === "rejected" && (
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
                  <Pressable onPress={() => setIdExpanded(!idExpanded)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
                      <Text style={{ ...text.body, fontWeight: "900", color: "#ef4444" }}>Verification Failed</Text>
                      <Text style={{ ...text.muted, marginTop: 3, fontSize: 12 }}>
                        {profile?.id_rejected_reason || "Please upload a valid ID"}
                      </Text>
                    </View>

                    <Ionicons name={idExpanded ? "chevron-up" : "chevron-down"} size={20} color="#ef4444" />
                  </Pressable>

                  {idExpanded && (
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
                        <Text style={{ fontWeight: "900", fontSize: 12, color: "#ef4444" }}>Delete</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}

              {/* NONE */}
              {(status === "none" || !status) && (
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
                      <Text style={{ ...text.muted, marginTop: 3 }}>Required to request services</Text>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Appearance */}
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
                    <Text style={{ ...text.body, fontWeight: "900", color: colors.textPrimary }}>Dark mode</Text>
                    <Text style={{ ...text.muted, marginTop: 3 }}>
                      Currently: <Text style={{ color: colors.accent, fontWeight: "900" }}>{mode.toUpperCase()}</Text>
                    </Text>
                  </View>
                </View>

                <Switch value={isDark} onValueChange={toggle} trackColor={{ false: colors.border, true: colors.accent }} />
              </View>
            </View>
          </>
        ) : (
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
              placeholder="(555) 555-5555"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
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
              <Text style={{ fontWeight: "900", color: colors.black }}>{saving ? "SAVING…" : "SAVE CHANGES"}</Text>
            </Pressable>
          </View>
        )}
        <Pressable
          onPress={goToLegal}
          style={({ pressed }) => [
            card.container,
            {
              flexDirection: "row",
              alignItems: "center",
              padding: spacing.lg,
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
          disabled={busy}
          style={({ pressed }) => [
            card,
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
          <Text style={{ fontWeight: "900", color: colors.black }}>{busy ? "SIGNING OUT…" : "SIGN OUT"}</Text>
        </Pressable>

        <View style={{ marginTop: spacing.lg }}>
          <DeleteAccountButton variant="card" />
        </View>

        <Text style={{ ...text.muted, textAlign: "center", marginTop: 6 }}>WrenchGo • Customer</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
