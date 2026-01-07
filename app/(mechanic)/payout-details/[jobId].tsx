import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/ui/theme-context";
import { supabase } from "../../../src/lib/supabase";
import {
  getJobFinancialBreakdown,
  JobFinancialBreakdown,
  formatCents,
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "../../../src/lib/financials";

export default function PayoutDetailsScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { colors, text, spacing, radius } = useTheme();

  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState<JobFinancialBreakdown | null>(null);

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    if (!jobId) return;

    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.id) {
      const data = await getJobFinancialBreakdown(jobId, userData.user.id);
      setBreakdown(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!breakdown) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: spacing.lg }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={[text.body, { marginTop: spacing.md, textAlign: "center" }]}>
          No financial data available for this job
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: spacing.lg, padding: spacing.md }}
        >
          <Text style={{ color: colors.accent, fontWeight: "600" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const paymentStatusLabel = PAYMENT_STATUS_LABELS[breakdown.payment_status] || breakdown.payment_status;
  const paymentStatusColor = PAYMENT_STATUS_COLORS[breakdown.payment_status] || colors.textMuted;
  const payoutStatusLabel = breakdown.payout_status ? PAYOUT_STATUS_LABELS[breakdown.payout_status] : null;
  const payoutStatusColor = breakdown.payout_status ? PAYOUT_STATUS_COLORS[breakdown.payout_status] : "#6b7280";

  const approvedItems = breakdown.line_items.filter((item) => item.approval_status === "approved");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text style={[text.body, { marginLeft: spacing.sm }]}>Back</Text>
        </Pressable>
        <Text style={text.title}>{breakdown.job_title}</Text>
        <Text style={[text.muted, { marginTop: spacing.xs }]}>
          Customer: {breakdown.customer_name}
        </Text>
      </View>

      <View
        style={{
          margin: spacing.lg,
          padding: spacing.md,
          backgroundColor: `${paymentStatusColor}15`,
          borderRadius: radius.md,
          borderLeftWidth: 4,
          borderLeftColor: paymentStatusColor,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Ionicons
            name={breakdown.payment_status === "captured" ? "checkmark-circle" : "time-outline"}
            size={20}
            color={paymentStatusColor}
          />
          <Text style={{ fontWeight: "600", color: paymentStatusColor }}>{paymentStatusLabel}</Text>
        </View>
        {breakdown.payment_status === "authorized" && (
          <Text style={[text.muted, { fontSize: 12, marginTop: spacing.xs }]}>
            Customer's card is authorized but not charged yet. Payment will be captured after job completion.
          </Text>
        )}
      </View>

      <View style={{ padding: spacing.lg }}>
        <Text style={[text.section, { marginBottom: spacing.md }]}>Earnings Breakdown</Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
          }}
        >
          {approvedItems.length > 0 && (
            <>
              <Text style={[text.muted, { fontSize: 12, marginBottom: spacing.sm }]}>APPROVED ITEMS</Text>
              {approvedItems.map((item) => (
                <Row
                  key={item.id}
                  label={item.description}
                  sublabel={item.item_type.replace("_", " ")}
                  value={formatCents(item.total_cents)}
                  colors={colors}
                  text={text}
                  spacing={spacing}
                />
              ))}
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
            </>
          )}

          <Row label="Subtotal" value={formatCents(breakdown.subtotal_cents)} colors={colors} text={text} spacing={spacing} />
          <Row
            label="Platform Commission (12%, max $50)"
            value={`-${formatCents(breakdown.mechanic_commission_cents)}`}
            valueColor="#ef4444"
            colors={colors}
            text={text}
            spacing={spacing}
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
          <Row
            label="Your Net Payout"
            value={formatCents(breakdown.mechanic_payout_cents)}
            bold
            valueColor="#10b981"
            colors={colors}
            text={text}
            spacing={spacing}
          />
        </View>

        <Text style={[text.muted, { fontSize: 12, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          CUSTOMER TOTAL
        </Text>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
          }}
        >
          <Row label="Service Total" value={formatCents(breakdown.subtotal_cents)} colors={colors} text={text} spacing={spacing} />
          <Row label="Platform Fee (paid by customer)" value={formatCents(breakdown.platform_fee_cents)} colors={colors} text={text} spacing={spacing} />
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
          <Row label="Customer Total" value={formatCents(breakdown.total_customer_cents)} bold colors={colors} text={text} spacing={spacing} />
        </View>
      </View>

      {payoutStatusLabel && (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <Text style={[text.section, { marginBottom: spacing.md }]}>Payout Status</Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: payoutStatusColor }} />
              <Text style={{ fontWeight: "600", color: payoutStatusColor }}>{payoutStatusLabel}</Text>
            </View>
            {breakdown.payout_scheduled_for && (
              <Text style={[text.muted, { marginTop: spacing.sm }]}>
                Scheduled: {new Date(breakdown.payout_scheduled_for).toLocaleDateString()}
              </Text>
            )}
            {breakdown.payout_processed_at && (
              <Text style={[text.muted, { marginTop: spacing.xs }]}>
                Processed: {new Date(breakdown.payout_processed_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={{ padding: spacing.lg, paddingTop: 0 }}>
        <View style={{ backgroundColor: `${colors.accent}10`, borderRadius: radius.md, padding: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
            <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[text.body, { fontWeight: "600", marginBottom: spacing.xs }]}>How Payouts Work</Text>
              <Text style={[text.muted, { fontSize: 13 }]}>
                • Customer payment is captured after job completion{"\n"}
                • Payouts are processed within 2-3 business days{"\n"}
                • Funds are deposited to your connected bank account
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function Row({
  label,
  sublabel,
  value,
  bold,
  valueColor,
  colors,
  text,
  spacing,
}: {
  label: string;
  sublabel?: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
  colors: any;
  text: any;
  spacing: any;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...text.body, fontWeight: bold ? "700" : "400" }}>{label}</Text>
        {sublabel && <Text style={[text.muted, { fontSize: 11 }]}>{sublabel}</Text>}
      </View>
      <Text style={{ ...text.body, fontWeight: bold ? "700" : "600", color: valueColor || colors.text }}>
        {value}
      </Text>
    </View>
  );
}
