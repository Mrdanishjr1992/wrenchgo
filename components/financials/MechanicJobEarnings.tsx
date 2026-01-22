import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/ui/theme-context";
import {
  MechanicJobFinancials,
  getMechanicJobFinancials,
  formatCents,
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_COLORS,
} from "../../src/lib/financials";

type Props = {
  jobId: string;
  mechanicId: string;
  jobStatus: string;
};

export default function MechanicJobEarnings({ jobId, mechanicId, jobStatus }: Props) {
  const { colors, spacing, radius, text } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [financials, setFinancials] = useState<MechanicJobFinancials | null>(null);

  const isCompleted = jobStatus === "completed";

  useEffect(() => {
    if (expanded && !financials && isCompleted) {
      loadFinancials();
    }
  }, [expanded]);

  const loadFinancials = async () => {
    setLoading(true);
    const data = await getMechanicJobFinancials(jobId, mechanicId);
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
          <Ionicons name="wallet-outline" size={20} color={colors.accent} />
          <Text style={{ ...text.body, fontWeight: "600" }}>View Earnings</Text>
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
              <Row label="Gross Earnings" value={formatCents(financials.gross_amount_cents)} />
              <Row
                label="Platform Commission"
                value={`-${formatCents(financials.commission_cents)}`}
                valueColor={colors.error}
              />
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: spacing.xs,
                }}
              />
              <Row
                label="Net Payout"
                value={formatCents(financials.net_payout_cents)}
                bold
                valueColor={colors.success}
              />
              <View style={{ marginTop: spacing.sm }}>
                <PayoutStatus status={financials.payout_status} />
              </View>
              {financials.statement && (
                <Text style={{ ...text.muted, fontSize: 12, marginTop: spacing.xs }}>
                  Statement: {financials.statement.invoice_number}
                </Text>
              )}
            </View>
          ) : (
            <Text style={text.muted}>No financial data available</Text>
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
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}) {
  const { colors, text } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ ...text.body, fontWeight: bold ? "700" : "400" }}>{label}</Text>
      <Text
        style={{
          ...text.body,
          fontWeight: bold ? "700" : "600",
          color: valueColor || colors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function PayoutStatus({ status }: { status: string }) {
  const { spacing, radius } = useTheme();
  const label = PAYOUT_STATUS_LABELS[status] || status;
  const color = PAYOUT_STATUS_COLORS[status] || "#6b7280";

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
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <Text style={{ fontSize: 12, fontWeight: "600", color }}>{label}</Text>
    </View>
  );
}
