import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../src/ui/theme-context";
import { supabase } from "../../src/lib/supabase";
import {
  checkIDVerification,
  uploadIDPhoto,
  getIDPhotoUrl,
  IDVerificationInfo,
  manualVerifyID,
} from "../../src/lib/verification";

export default function PhotoID() {
  const router = useRouter();
  const { colors, spacing, radius, text } = useTheme();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [verification, setVerification] = useState<IDVerificationInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadVerificationStatus = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/(auth)/sign-in");
        return;
      }

      setUserId(user.id);
      const info = await checkIDVerification(user.id);
      setVerification(info);

      if (info?.photoPath) {
        const url = await getIDPhotoUrl(info.photoPath);
        setPreviewUrl(url);
      }
    } catch (error) {
      console.error("[PHOTO ID] Load error:", error);
      Alert.alert("Error", "Failed to load verification status");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadVerificationStatus();
  }, [loadVerificationStatus]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow access to your photo library to upload ID.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && userId) {
        await handleUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error("[PHOTO ID] Pick error:", error);
      Alert.alert("Error", "Failed to select image");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow camera access to take a photo of your ID.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && userId) {
        await handleUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error("[PHOTO ID] Camera error:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const handleUpload = async (uri: string) => {
    if (!userId) return;

    try {
      setUploading(true);
      const result = await uploadIDPhoto(uri, userId);

      if (result.success) {
        Alert.alert(
          "Upload Successful",
          "Your ID has been submitted for verification. You'll be notified once it's reviewed (usually within 24 hours).",
          [{ text: "OK", onPress: () => loadVerificationStatus() }]
        );
      } else {
        Alert.alert("Upload Failed", result.error || "Failed to upload ID photo");
      }
    } catch (error) {
      console.error("[PHOTO ID] Upload error:", error);
      Alert.alert("Error", "Failed to upload ID photo");
    } finally {
      setUploading(false);
    }
  };

  const showUploadOptions = () => {
    Alert.alert("Upload Photo ID", "Choose how to upload your ID", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleManualVerify = async () => {
    if (!userId) return;

    Alert.alert(
      "Manual Verification",
      "This is a TESTING feature. In production, verification should be done by admins. Proceed?",
      [
        {
          text: "Verify Now",
          onPress: async () => {
            try {
              setLoading(true);
              const result = await manualVerifyID(userId);
              if (result.success) {
                Alert.alert("Success", "ID manually verified!", [
                  { text: "OK", onPress: () => loadVerificationStatus() },
                ]);
              } else {
                Alert.alert("Error", result.error || "Failed to verify");
              }
            } catch (error) {
              console.error("[PHOTO ID] Manual verify error:", error);
              Alert.alert("Error", "Failed to verify ID");
            } finally {
              setLoading(false);
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "#10b981";
      case "pending":
        return "#f59e0b";
      case "rejected":
        return "#ef4444";
      default:
        return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return "checkmark-circle";
      case "pending":
        return "time-outline";
      case "rejected":
        return "close-circle";
      default:
        return "alert-circle-outline";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "verified":
        return "Verified";
      case "pending":
        return "Pending Review";
      case "rejected":
        return "Rejected";
      default:
        return "Not Uploaded";
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: Platform.OS === "ios" ? 60 : spacing.xl }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.xl }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            marginRight: spacing.md,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ ...text.title, flex: 1 }}>Photo ID Verification</Text>
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: getStatusColor(verification?.status || "none") + "20",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={getStatusIcon(verification?.status || "none") as any}
              size={24}
              color={getStatusColor(verification?.status || "none")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...text.body, fontWeight: "900", fontSize: 18 }}>
              {getStatusText(verification?.status || "none")}
            </Text>
            {verification?.uploadedAt && (
              <Text style={{ ...text.muted, marginTop: 2 }}>
                Uploaded {new Date(verification.uploadedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>

        {verification?.status === "rejected" && verification.rejectedReason && (
          <View
            style={{
              backgroundColor: "#ef444420",
              borderRadius: radius.md,
              padding: spacing.md,
              marginTop: spacing.sm,
            }}
          >
            <Text style={{ ...text.body, color: "#ef4444", fontWeight: "600" }}>Rejection Reason:</Text>
            <Text style={{ ...text.body, color: "#ef4444", marginTop: 4 }}>{verification.rejectedReason}</Text>
          </View>
        )}

        {verification?.status === "verified" && verification.verifiedAt && (
          <View
            style={{
              backgroundColor: "#10b98120",
              borderRadius: radius.md,
              padding: spacing.md,
              marginTop: spacing.sm,
            }}
          >
            <Text style={{ ...text.body, color: "#10b981", fontWeight: "600" }}>
              ✓ Verified on {new Date(verification.verifiedAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      {previewUrl && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          <Text style={{ ...text.section, marginBottom: spacing.md }}>Uploaded ID</Text>
          <Image
            source={{ uri: previewUrl }}
            style={{
              width: "100%",
              height: 200,
              borderRadius: radius.md,
              backgroundColor: colors.bg,
            }}
            resizeMode="contain"
          />
        </View>
      )}

      {verification?.status !== "verified" && (
        <Pressable
          onPress={showUploadOptions}
          disabled={uploading}
          style={{
            backgroundColor: colors.accent,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            alignItems: "center",
            marginBottom: spacing.lg,
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading ? (
            <ActivityIndicator color={colors.black} />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Ionicons name="camera-outline" size={20} color={colors.black} />
              <Text style={{ fontWeight: "900", color: colors.black, fontSize: 16 }}>
                {verification?.status === "none" ? "UPLOAD PHOTO ID" : "UPLOAD NEW ID"}
              </Text>
            </View>
          )}
        </Pressable>
      )}

      {verification?.status === "pending" && (
        <Pressable
          onPress={handleManualVerify}
          style={{
            backgroundColor: "#f59e0b",
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            alignItems: "center",
            marginBottom: spacing.lg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="shield-checkmark" size={20} color={colors.black} />
            <Text style={{ fontWeight: "900", color: colors.black, fontSize: 16 }}>
              MANUAL VERIFY (TESTING)
            </Text>
          </View>
        </Pressable>
      )}

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...text.body, fontWeight: "600", marginBottom: spacing.xs }}>Why We Need This</Text>
            <Text style={{ ...text.muted, fontSize: 14 }}>
              Photo ID verification helps ensure safety and trust for all WrenchGo users. It&apos;s required before you can
              request services or accept jobs.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...text.body, fontWeight: "600", marginBottom: spacing.xs }}>Your Privacy</Text>
            <Text style={{ ...text.muted, fontSize: 14 }}>
              Your ID is stored securely and encrypted. Only authorized admins can view it for verification purposes.
              We never share your ID with other users.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Ionicons name="document-text-outline" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...text.body, fontWeight: "600", marginBottom: spacing.xs }}>Acceptable IDs</Text>
            <Text style={{ ...text.muted, fontSize: 14 }}>
              • Driver&apos;s License{"\n"}• State ID{"\n"}• Passport{"\n"}• Government-issued ID
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Ionicons name="checkmark-done-outline" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...text.body, fontWeight: "600", marginBottom: spacing.xs }}>Tips for Best Results</Text>
            <Text style={{ ...text.muted, fontSize: 14 }}>
              • Ensure good lighting{"\n"}• Keep ID flat and in focus{"\n"}• Make sure all text is readable{"\n"}•
              Avoid glare or shadows
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
