import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ui/theme-context";
import { supabase } from "../lib/supabase";

type CancellationReason =
  | "found_other_mechanic"
  | "issue_resolved"
  | "wrong_vehicle"
  | "too_expensive"
  | "scheduled_conflict"
  | "other";

type CancelQuoteModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  quoteId: string;
  jobId: string;
  acceptedAt?: string | null;
  jobStatus?: string;
};

const CANCELLATION_REASONS: Array<{
  value: CancellationReason;
  label: string;
  icon: string;
}> = [
  {
    value: "found_other_mechanic",
    label: "Found another mechanic",
    icon: "people-outline",
  },
  {
    value: "issue_resolved",
    label: "Issue resolved on its own",
    icon: "checkmark-circle-outline",
  },
  {
    value: "wrong_vehicle",
    label: "Wrong vehicle selected",
    icon: "car-outline",
  },
  {
    value: "too_expensive",
    label: "Quote is too expensive",
    icon: "cash-outline",
  },
  {
    value: "scheduled_conflict",
    label: "Schedule conflict",
    icon: "calendar-outline",
  },
  {
    value: "other",
    label: "Other reason",
    icon: "ellipsis-horizontal-outline",
  },
];

export function CancelQuoteModal({
  visible,
  onClose,
  onSuccess,
  quoteId,
  jobId,
  acceptedAt,
  jobStatus,
}: CancelQuoteModalProps) {
  const { colors, text, spacing, radius } = useTheme();
  const [selectedReason, setSelectedReason] = useState<CancellationReason | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const calculateWarning = (): {
    message: string;
    feeAmount: number;
    severity: "info" | "warning" | "error";
  } => {
    if (!acceptedAt) {
      return {
        message: "You can cancel this quote at any time.",
        feeAmount: 0,
        severity: "info",
      };
    }

    const acceptedTime = new Date(acceptedAt).getTime();
    const now = Date.now();
    const minutesSinceAcceptance = (now - acceptedTime) / (1000 * 60);

    if (minutesSinceAcceptance <= 5) {
      return {
        message: "✅ Free cancellation (within 5 minutes of acceptance)",
        feeAmount: 0,
        severity: "info",
      };
    }

    if (jobStatus === "in_progress") {
      return {
        message: "⚠️ Cancellation fee: $25 (mechanic has started work)",
        feeAmount: 2500,
        severity: "error",
      };
    }

    if (minutesSinceAcceptance > 5) {
      return {
        message: "⚠️ Cancellation fee: $15 (close to scheduled time)",
        feeAmount: 1500,
        severity: "warning",
      };
    }

    return {
      message: "You can cancel with a reason provided.",
      feeAmount: 0,
      severity: "info",
    };
  };

  const warning = calculateWarning();

  const handleCancel = async () => {
    if (!selectedReason) {
      Alert.alert("Reason Required", "Please select a cancellation reason.");
      return;
    }

    if (selectedReason === "other" && !note.trim()) {
      Alert.alert("Details Required", "Please provide details for your cancellation reason.");
      return;
    }

    Alert.alert(
      "Confirm Cancellation",
      warning.feeAmount > 0
        ? `This will cancel your job and charge a $${(warning.feeAmount / 100).toFixed(2)} cancellation fee. Continue?`
        : "This will cancel your job. The mechanic will be notified immediately. Continue?",
      [
        { text: "Go Back", style: "cancel" },
        {
          text: "Cancel Job",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);

              const { data, error } = await supabase.rpc("cancel_quote_by_customer", {
                p_quote_id: quoteId,
                p_reason: selectedReason,
                p_note: note.trim() || null,
              });

              if (error) throw error;

              if (!data?.success) {
                throw new Error(data?.error || "Failed to cancel quote");
              }

              Alert.alert(
                "Job Canceled",
                data.cancellation_fee_cents > 0
                  ? `Your job has been canceled. A $${(data.cancellation_fee_cents / 100).toFixed(2)} cancellation fee will be charged.`
                  : "Your job has been canceled. The mechanic has been notified.",
                [{ text: "OK", onPress: onSuccess }]
              );

              onClose();
            } catch (error: any) {
              Alert.alert("Cancellation Failed", error.message || "Unable to cancel quote. Please try again.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const warningBgColor =
    warning.severity === "error"
      ? "#FEE2E2"
      : warning.severity === "warning"
      ? "#FEF3C7"
      : "#DBEAFE";

  const warningTextColor =
    warning.severity === "error"
      ? "#991B1B"
      : warning.severity === "warning"
      ? "#92400E"
      : "#1E40AF";

  const warningBorderColor =
    warning.severity === "error"
      ? "#FCA5A5"
      : warning.severity === "warning"
      ? "#FCD34D"
      : "#93C5FD";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: colors.surface2,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: "90%",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={[text.title, { fontSize: 20 }]}>Cancel Job</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: spacing.lg,
              gap: spacing.lg,
            }}
          >
            <View
              style={{
                backgroundColor: warningBgColor,
                borderWidth: 1,
                borderColor: warningBorderColor,
                borderRadius: radius.md,
                padding: spacing.md,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: warningTextColor,
                }}
              >
                {warning.message}
              </Text>
            </View>

            <View>
              <Text style={[text.section, { marginBottom: spacing.sm }]}>
                Why are you canceling? <Text style={{ color: colors.accent }}>*</Text>
              </Text>

              <View style={{ gap: spacing.sm }}>
                {CANCELLATION_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason.value;
                  return (
                    <Pressable
                      key={reason.value}
                      onPress={() => setSelectedReason(reason.value)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        padding: spacing.md,
                        backgroundColor: isSelected ? colors.surface : colors.bg,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.accent : colors.border,
                        borderRadius: radius.md,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: isSelected ? colors.accent + "20" : colors.surface,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name={reason.icon as any}
                          size={20}
                          color={isSelected ? colors.accent : colors.textMuted}
                        />
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 15,
                          fontWeight: isSelected ? "900" : "600",
                          color: isSelected ? colors.textPrimary : colors.textSecondary,
                        }}
                      >
                        {reason.label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {selectedReason === "other" && (
              <View>
                <Text style={[text.section, { marginBottom: spacing.sm }]}>
                  Please provide details <Text style={{ color: colors.accent }}>*</Text>
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Tell us more about why you're canceling..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  style={{
                    backgroundColor: colors.bg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    fontSize: 15,
                    color: colors.textPrimary,
                    textAlignVertical: "top",
                    minHeight: 100,
                  }}
                />
              </View>
            )}

            {selectedReason && selectedReason !== "other" && (
              <View>
                <Text style={[text.section, { marginBottom: spacing.sm }]}>
                  Additional details (optional)
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Any additional information..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: colors.bg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    fontSize: 15,
                    color: colors.textPrimary,
                    textAlignVertical: "top",
                    minHeight: 80,
                  }}
                />
              </View>
            )}

            <View style={{ gap: spacing.sm }}>
              <Pressable
                onPress={handleCancel}
                disabled={loading || !selectedReason}
                style={{
                  backgroundColor: loading || !selectedReason ? colors.border : "#EF4444",
                  paddingVertical: 16,
                  borderRadius: radius.md,
                  alignItems: "center",
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ fontWeight: "900", fontSize: 16, color: "#FFFFFF" }}>
                    Cancel Job
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={onClose}
                disabled={loading}
                style={{
                  backgroundColor: colors.surface,
                  paddingVertical: 16,
                  borderRadius: radius.md,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontWeight: "900", fontSize: 16, color: colors.textPrimary }}>
                  Keep Job
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
