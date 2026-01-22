import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/ui/theme-context";
import {
  CustomerJobFinancials,
  getCustomerJobFinancials,
  formatCents,
} from "../../src/lib/financials";

type Props = {
  jobId: string;
  customerId: string;
  jobStatus: string;
};

export default function CustomerJobPayment({ jobId, customerId, jobStatus }: Props) {
  const { colors, spacing, radius, text } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [financials, setFinancials] = useState<CustomerJobFinancials | null>(null);

  const isCompleted = jobStatus === "completed";

  useEffect(() => {
    if (expanded && !financials && isCompleted) {
      loadFinancials();
    }
  }, [expanded]);

  const loadFinancials = async () => {
    setLoading(true);
    const data = await getCustomerJobFinancials(jobId, customerId);
    setFinancials(data);
    setLoading(false);
  };

  if (!isCompleted) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Ionicons name="receipt-outline" size={20} color={colors.accent} />
          <Text style={{ ...text.body, fontWeight: "600" }}>View Payment Details</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            padding: spacing.md,
          }}
        >
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : financials ? (
            <View style={{ gap: spacing.sm }}>
              {financials.line_items?.map((item, idx) => (
                <Row
                  key={idx}
                  label={item.description}
                  value={formatCents(item.total_cents)}
                />
              ))}
              {financials.platform_fee_cents > 0 && (
                <Row
                  label="Service Fee"
                  value={formatCents(financials.platform_fee_cents)}
                />
              )}
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: spacing.xs,
                }}
              />
              <Row
                label="Total Paid"
                value={formatCents(financials.total_cents)}
                bold
              />
              <View style={{ marginTop: spacing.sm }}>
                <PaymentStatus status={financials.payment_status} />
              </View>
              {financials.invoice && (
                <Text style={{ ...text.muted, fontSize: 12, marginTop: spacing.xs }}>
                  Invoice: {financials.invoice.invoice_number}
                </Text>
              )}
            </View>
          ) : (
            <Text style={text.muted}>No payment data available</Text>
          )}
        </View>
      )}
    </View>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  const { colors, text } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ ...text.body, fontWeight: bold ? "700" : "400", flex: 1 }}>{label}</Text>
      <Text
        style={{
          ...text.body,
          fontWeight: bold ? "700" : "600",
          color: colors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function PaymentStatus({ status }: { status: string }) {
  const { colors, spacing, radius } = useTheme();
  const isPaid = status === "paid";
  const color = isPaid ? colors.success : colors.warning;
  const label = isPaid ? "Paid" : "Pending";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.sm,
        backgroundColor: `${color}20`,
      }}
    >
      <Ionicons
        name={isPaid ? "checkmark-circle" : "time"}
        size={14}
        color={color}
      />
      <Text style={{ fontSize: 12, fontWeight: "600", color }}>{label}</Text>
    </View>
  );
}
