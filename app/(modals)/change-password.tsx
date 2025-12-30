import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/ui/theme-context";
import { useChangePassword } from "../../src/hooks/useChangePassword";

export default function ChangePassword() {
  const router = useRouter();
  const { colors, spacing, radius, text } = useTheme();
  const { changePassword, isChanging } = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validate()) return;

    const result = await changePassword(currentPassword, newPassword);

    if (result.success) {
      Alert.alert(
        "Password Changed",
        "Your password has been successfully updated.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } else if (result.isOAuthUser) {
      Alert.alert("Google Account", result.error || "Cannot change password for Google accounts.");
    } else {
      Alert.alert("Error", result.error || "Failed to change password.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: Platform.OS === "ios" ? 60 : spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
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
          <Text style={{ ...text.title, flex: 1 }}>Change Password</Text>
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <View>
            <Text style={{ ...text.body, marginBottom: spacing.xs, fontWeight: "600" }}>
              Current Password
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: errors.currentPassword ? colors.error : colors.border,
                borderRadius: radius.md,
                backgroundColor: colors.bg,
                paddingHorizontal: spacing.md,
              }}
            >
              <TextInput
                value={currentPassword}
                onChangeText={(text) => {
                  setCurrentPassword(text);
                  setErrors((prev) => ({ ...prev, currentPassword: "" }));
                }}
                placeholder="Enter current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  color: colors.textPrimary,
                  fontSize: 16,
                }}
              />
              <Pressable onPress={() => setShowCurrent(!showCurrent)}>
                <Ionicons
                  name={showCurrent ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            {errors.currentPassword && (
              <Text style={{ ...text.muted, color: colors.error, marginTop: spacing.xs }}>
                {errors.currentPassword}
              </Text>
            )}
          </View>

          <View>
            <Text style={{ ...text.body, marginBottom: spacing.xs, fontWeight: "600" }}>
              New Password
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: errors.newPassword ? colors.error : colors.border,
                borderRadius: radius.md,
                backgroundColor: colors.bg,
                paddingHorizontal: spacing.md,
              }}
            >
              <TextInput
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  setErrors((prev) => ({ ...prev, newPassword: "" }));
                }}
                placeholder="Enter new password (min 8 characters)"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showNew}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  color: colors.textPrimary,
                  fontSize: 16,
                }}
              />
              <Pressable onPress={() => setShowNew(!showNew)}>
                <Ionicons
                  name={showNew ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            {errors.newPassword && (
              <Text style={{ ...text.muted, color: colors.error, marginTop: spacing.xs }}>
                {errors.newPassword}
              </Text>
            )}
          </View>

          <View>
            <Text style={{ ...text.body, marginBottom: spacing.xs, fontWeight: "600" }}>
              Confirm New Password
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: errors.confirmPassword ? colors.error : colors.border,
                borderRadius: radius.md,
                backgroundColor: colors.bg,
                paddingHorizontal: spacing.md,
              }}
            >
              <TextInput
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                }}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  color: colors.textPrimary,
                  fontSize: 16,
                }}
              />
              <Pressable onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            {errors.confirmPassword && (
              <Text style={{ ...text.muted, color: colors.error, marginTop: spacing.xs }}>
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          <Pressable
            onPress={handleChangePassword}
            disabled={isChanging}
            style={{
              backgroundColor: colors.accent,
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              alignItems: "center",
              marginTop: spacing.md,
              opacity: isChanging ? 0.7 : 1,
            }}
          >
            {isChanging ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={{ fontWeight: "900", color: colors.black, fontSize: 16 }}>
                CHANGE PASSWORD
              </Text>
            )}
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginTop: spacing.lg,
            flexDirection: "row",
            gap: spacing.md,
          }}
        >
          <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...text.body, color: colors.textPrimary, marginBottom: spacing.xs }}>
              Password Requirements
            </Text>
            <Text style={{ ...text.muted, fontSize: 14 }}>
              • Minimum 8 characters{"\n"}• Use a strong, unique password{"\n"}• You'll remain signed
              in after changing
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
