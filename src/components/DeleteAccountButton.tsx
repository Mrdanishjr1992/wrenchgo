// src/components/DeleteAccountButton.tsx
import React, { useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ui/theme-context";
import { spacing, normalize } from "../ui/theme";
import { createCard } from "../ui/styles";
import { useDeleteAccount } from "../hooks/useDeleteAccount";

interface DeleteAccountButtonProps {
  variant?: "button" | "card";
}

export const DeleteAccountButton: React.FC<DeleteAccountButtonProps> = ({ variant = "button" }) => {
  const { colors } = useTheme();
  const { confirmDelete, isDeleting } = useDeleteAccount();
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reason, setReason] = useState("");

  const card = createCard(colors);

  const handleDeletePress = () => {
    setShowReasonModal(true);
  };

  const handleConfirmWithReason = () => {
    setShowReasonModal(false);
    confirmDelete({ reason: reason.trim() || undefined });
  };

  if (variant === "card") {
    return (
      <>
        <Pressable
          onPress={handleDeletePress}
          disabled={isDeleting}
          style={({ pressed }) => [
            card,
            {
              padding: spacing.lg,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View
              style={{
                width: normalize(48),
                height: normalize(48),
                borderRadius: normalize(24),
                backgroundColor: colors.errorBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="trash-outline" size={normalize(24)} color={colors.error} />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: normalize(16),
                  fontWeight: "800",
                  color: colors.error,
                  marginBottom: spacing.xs,
                }}
              >
                Delete Account
              </Text>
              <Text
                style={{
                  fontSize: normalize(13),
                  fontWeight: "600",
                  color: colors.textMuted,
                }}
              >
                Permanently remove your account and data
              </Text>
            </View>

            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Ionicons name="chevron-forward" size={normalize(20)} color={colors.textMuted} />
            )}
          </View>
        </Pressable>

        {/* Reason Modal */}
        <Modal visible={showReasonModal} transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "center",
              alignItems: "center",
              padding: spacing.lg,
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: normalize(20),
                padding: spacing.xl,
                width: "100%",
                maxWidth: 400,
              }}
            >
              <Text
                style={{
                  fontSize: normalize(20),
                  fontWeight: "900",
                  color: colors.textPrimary,
                  marginBottom: spacing.sm,
                }}
              >
                Why are you leaving?
              </Text>

              <Text
                style={{
                  fontSize: normalize(14),
                  fontWeight: "600",
                  color: colors.textSecondary,
                  marginBottom: spacing.lg,
                }}
              >
                Help us improve by sharing your reason (optional)
              </Text>

              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="e.g., Found another service, Not using anymore..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: colors.bg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: normalize(12),
                  padding: spacing.md,
                  fontSize: normalize(14),
                  fontWeight: "600",
                  color: colors.textPrimary,
                  minHeight: normalize(100),
                  textAlignVertical: "top",
                  marginBottom: spacing.lg,
                }}
              />

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={() => {
                    setShowReasonModal(false);
                    setReason("");
                  }}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: normalize(12),
                      backgroundColor: colors.bg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: normalize(15),
                      fontWeight: "900",
                      color: colors.textPrimary,
                    }}
                  >
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirmWithReason}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: normalize(12),
                      backgroundColor: colors.error,
                      alignItems: "center",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: normalize(15),
                      fontWeight: "900",
                      color: colors.white,
                    }}
                  >
                    Continue
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // Button variant
  return (
    <Pressable
      onPress={handleDeletePress}
      disabled={isDeleting}
      style={({ pressed }) => [
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: normalize(12),
          backgroundColor: colors.errorBg,
          borderWidth: 1,
          borderColor: colors.error + '44',
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {isDeleting ? (
        <ActivityIndicator size="small" color={colors.error} />
      ) : (
        <>
          <Ionicons name="trash-outline" size={normalize(18)} color={colors.error} />
          <Text
            style={{
              fontSize: normalize(15),
              fontWeight: "900",
              color: colors.error,
            }}
          >
            Delete Account
          </Text>
        </>
      )}
    </Pressable>
  );
};
