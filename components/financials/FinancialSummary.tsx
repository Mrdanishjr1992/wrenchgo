import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/ui/theme-context";
import {
  FinancialSummary as FinancialSummaryType,
  getFinancialSummary,
  formatCents,
  formatCentsCompact,
} from "../../src/lib/financials";

type Props = {
  userId: string;
  role: "customer" | "mechanic";
  compact?: boolean;
};

type PeriodType = "all_time" | "month" | "week";

export default function FinancialSummary({ userId, role, compact = false }: Props) {
  const { colors, spacing, radius, text } = useTheme();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummaryType | null>(null);
  const [period, setPeriod] = useState<PeriodType>("all_time");

  useEffect(() => {
    loadSummary();
  }, [userId, role, period]);

  const loadSummary = async () => {
    setLoading(true);
    const data = await getFinancialSummary(userId, role, period);
    setSummary(data);
    setLoading(false);
  };

  if (loading && !summary) {
    return (
      <View style={{ padding: spacing.md, alignItems: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!summary) return null;

  const isMechanic = role === "mechanic";

  if (compact) {
    return (
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.lg,
        }}
      >
        <StatBox
          label={isMechanic ? "Earnings" : "Spent"}
          value={formatCentsCompact(
            isMechanic ? summary.total_earnings_cents || 0 : summary.total_spent_cents || 0
          )}
          color={colors.accent}
        />
        <StatBox
          label="Jobs"
          value={summary.total_jobs.toString()}
          color={colors.text}
        />
        {isMechanic && (
          <StatBox
            label="Pending"
            value={formatCentsCompact(summary.pending_payouts_cents || 0)}
            color="#f59e0b"
          />
        )}
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ ...text.body, fontWeight: "700" }}>
          {isMechanic ? "Earnings Summary" : "Spending Summary"}
        </Text>
        <PeriodSelector value={period} onChange={setPeriod} />
      </View>

      <View style={{ padding: spacing.md, gap: spacing.md }}>
        {isMechanic ? (
          <>
            <SummaryRow
              icon="cash-outline"
              label="Total Earnings"
              value={formatCents(summary.total_earnings_cents || 0)}
              color="#10b981"
            />
            <SummaryRow
              icon="trending-down-outline"
              label="Platform Fees"
              value={formatCents(summary.total_commission_cents || 0)}
              color="#ef4444"
            />
            <SummaryRow
              icon="time-outline"
              label="Pending Payouts"
              value={formatCents(summary.pending_payouts_cents || 0)}
              color="#f59e0b"
            />
            <SummaryRow
              icon="checkmark-circle-outline"
              label="Completed Payouts"
              value={formatCents(summary.completed_payouts_cents || 0)}
              color="#10b981"
            />
          </>
        ) : (
          <>
            <SummaryRow
              icon="card-outline"
              label="Total Spent"
              value={formatCents(summary.total_spent_cents || 0)}
              color={colors.text}
            />
            <SummaryRow
              icon="pricetag-outline"
              label="Service Fees"
              value={formatCents(summary.total_fees_cents || 0)}
              color={colors.textMuted}
            />
          </>
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            marginTop: spacing.xs,
          }}
        >
          <Ionicons name="briefcase-outline" size={16} color={colors.textMuted} />
          <Text style={text.muted}>{summary.total_jobs} completed jobs</Text>
        </View>
      </View>
    </View>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const { text } = useTheme();
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color }}>{value}</Text>
      <Text style={{ ...text.muted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  const { colors, spacing, text } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <Text style={text.body}>{label}</Text>
      </View>
      <Text style={{ ...text.body, fontWeight: "600", color }}>{value}</Text>
    </View>
  );
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodType;
  onChange: (v: PeriodType) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const options: { key: PeriodType; label: string }[] = [
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "all_time", label: "All" },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.background,
        borderRadius: radius.sm,
        padding: 2,
      }}
    >
      {options.map((opt) => (
        <Pressable
          key={opt.key}
          onPress={() => onChange(opt.key)}
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radius.sm - 2,
            backgroundColor: value === opt.key ? colors.surface : "transparent",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: value === opt.key ? "600" : "400",
              color: value === opt.key ? colors.text : colors.textMuted,
            }}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
