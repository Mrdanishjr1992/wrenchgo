import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/src/ui/theme-context";
import { supabase } from "@/src/lib/supabase";
import { formatCents, PAYOUT_STATUS_LABELS, PAYOUT_STATUS_COLORS } from "@/src/lib/financials";
import type {
  EarningsSummary,
  PayoutRecord,
  TaxYearSummary,
  TimeRangeKey,
  MonthlyBreakdown,
} from "@/src/types/earnings";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getChicagoDate(date: Date): Date {
  const chicagoOffset = -6 * 60;
  const utcOffset = date.getTimezoneOffset();
  return new Date(date.getTime() + (utcOffset - chicagoOffset) * 60000);
}

function getTimeRanges(): Record<TimeRangeKey, { label: string; start: Date; end: Date }> {
  const now = new Date();
  const chicago = getChicagoDate(now);
  
  const todayStart = new Date(chicago);
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date(chicago);
  todayEnd.setHours(23, 59, 59, 999);
  
  const dayOfWeek = chicago.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(chicago);
  weekStart.setDate(chicago.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  const monthStart = new Date(chicago.getFullYear(), chicago.getMonth(), 1);
  const monthEnd = new Date(chicago.getFullYear(), chicago.getMonth() + 1, 0, 23, 59, 59, 999);
  
  const threeMonthsAgo = new Date(chicago);
  threeMonthsAgo.setMonth(chicago.getMonth() - 3);
  threeMonthsAgo.setHours(0, 0, 0, 0);
  
  const sixMonthsAgo = new Date(chicago);
  sixMonthsAgo.setMonth(chicago.getMonth() - 6);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  
  const yearStart = new Date(chicago.getFullYear(), 0, 1);
  const yearEnd = new Date(chicago.getFullYear(), 11, 31, 23, 59, 59, 999);

  return {
    today: { label: "Today", start: todayStart, end: todayEnd },
    this_week: { label: "This Week", start: weekStart, end: weekEnd },
    this_month: { label: "This Month", start: monthStart, end: monthEnd },
    last_3_months: { label: "Last 3 Months", start: threeMonthsAgo, end: todayEnd },
    last_6_months: { label: "Last 6 Months", start: sixMonthsAgo, end: todayEnd },
    this_year: { label: "This Year", start: yearStart, end: yearEnd },
    custom: { label: "Custom", start: todayStart, end: todayEnd },
  };
}

export default function EarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, text } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mechanicId, setMechanicId] = useState<string | null>(null);

  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>("this_month");
  const [customStart, setCustomStart] = useState(new Date());
  const [customEnd, setCustomEnd] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsOffset, setPayoutsOffset] = useState(0);
  const [hasMorePayouts, setHasMorePayouts] = useState(true);

  const [selectedPayout, setSelectedPayout] = useState<PayoutRecord | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [availableTaxYears, setAvailableTaxYears] = useState<number[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxYearSummary | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);

  const timeRanges = useMemo(() => getTimeRanges(), []);

  const currentRange = useMemo(() => {
    if (selectedRange === "custom") {
      return { start: customStart, end: customEnd };
    }
    return timeRanges[selectedRange];
  }, [selectedRange, customStart, customEnd, timeRanges]);

  const fetchMechanicId = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user?.id) {
      setMechanicId(data.user.id);
      return data.user.id;
    }
    return null;
  }, []);

  const fetchSummary = useCallback(async (mechId: string, start: Date, end: Date) => {
    const { data, error: err } = await supabase.rpc("get_mechanic_earnings_summary", {
      p_mechanic_id: mechId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    });

    if (err) {
      console.error("Error fetching summary:", err);
      setError("Failed to load earnings summary");
      return;
    }

    if (data && data.length > 0) {
      setSummary(data[0]);
    } else {
      setSummary({
        net_completed_cents: 0,
        gross_completed_cents: 0,
        commission_completed_cents: 0,
        adjustments_completed_cents: 0,
        net_pending_cents: 0,
        count_completed: 0,
        avg_net_completed_cents: 0,
        take_rate_bps: 0,
      });
    }
  }, []);

  const fetchPayouts = useCallback(async (mechId: string, start: Date, end: Date, offset: number, append = false) => {
    setPayoutsLoading(true);
    const { data, error: err } = await supabase.rpc("get_mechanic_payouts", {
      p_mechanic_id: mechId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_limit: 20,
      p_offset: offset,
    });

    setPayoutsLoading(false);

    if (err) {
      console.error("Error fetching payouts:", err);
      return;
    }

    if (data) {
      if (append) {
        setPayouts((prev) => [...prev, ...data]);
      } else {
        setPayouts(data);
      }
      setHasMorePayouts(data.length === 20);
    }
  }, []);

  const fetchTaxYears = useCallback(async (mechId: string) => {
    const { data } = await supabase.rpc("get_mechanic_available_tax_years", {
      p_mechanic_id: mechId,
    });

    if (data && data.length > 0) {
      setAvailableTaxYears(data.map((d: { tax_year: number }) => d.tax_year));
    } else {
      const currentYear = new Date().getFullYear();
      setAvailableTaxYears([currentYear]);
    }
  }, []);

  const fetchTaxSummary = useCallback(async (mechId: string, year: number) => {
    setTaxLoading(true);
    const { data, error: err } = await supabase.rpc("get_mechanic_tax_year_summary", {
      p_mechanic_id: mechId,
      p_tax_year: year,
    });

    setTaxLoading(false);

    if (err) {
      console.error("Error fetching tax summary:", err);
      return;
    }

    if (data && data.length > 0) {
      setTaxSummary(data[0]);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    let mechId = mechanicId;
    if (!mechId) {
      mechId = await fetchMechanicId();
    }

    if (!mechId) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    await Promise.all([
      fetchSummary(mechId, currentRange.start, currentRange.end),
      fetchPayouts(mechId, currentRange.start, currentRange.end, 0),
      fetchTaxYears(mechId),
    ]);

    setPayoutsOffset(0);
    setLoading(false);
  }, [mechanicId, currentRange, fetchMechanicId, fetchSummary, fetchPayouts, fetchTaxYears]);

  useEffect(() => {
    loadData();
  }, [selectedRange, customStart, customEnd]);

  useEffect(() => {
    if (mechanicId && taxYear) {
      fetchTaxSummary(mechanicId, taxYear);
    }
  }, [mechanicId, taxYear, fetchTaxSummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const loadMorePayouts = useCallback(() => {
    if (!payoutsLoading && hasMorePayouts && mechanicId) {
      const newOffset = payoutsOffset + 20;
      setPayoutsOffset(newOffset);
      fetchPayouts(mechanicId, currentRange.start, currentRange.end, newOffset, true);
    }
  }, [payoutsLoading, hasMorePayouts, mechanicId, payoutsOffset, currentRange, fetchPayouts]);

  const card = useMemo(
    () => ({
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    }),
    [colors]
  );

  const renderTimeRangeSelector = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}
    >
      {(Object.keys(timeRanges) as TimeRangeKey[]).map((key) => (
        <Pressable
          key={key}
          onPress={() => setSelectedRange(key)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: radius.md,
            backgroundColor: selectedRange === key ? colors.accent : colors.surface,
            borderWidth: 1,
            borderColor: selectedRange === key ? colors.accent : colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: selectedRange === key ? colors.black : colors.textPrimary,
            }}
          >
            {timeRanges[key].label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderCustomDatePickers = () => {
    if (selectedRange !== "custom") return null;

    return (
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: spacing.md, marginTop: spacing.sm }}>
        <Pressable
          onPress={() => setShowStartPicker(true)}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Start Date</Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
            {customStart.toLocaleDateString()}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowEndPicker(true)}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.textMuted }}>End Date</Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
            {customEnd.toLocaleDateString()}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderSummaryCards = () => {
    if (!summary) return null;

    const cards = [
      { label: "Net Earnings", value: summary.net_completed_cents, color: "#10b981" },
      { label: "Gross Value", value: summary.gross_completed_cents, color: colors.textPrimary },
      { label: "Commission", value: summary.commission_completed_cents, color: "#ef4444" },
      { label: "Adjustments", value: summary.adjustments_completed_cents, color: "#f59e0b" },
      { label: "Pending", value: summary.net_pending_cents, color: "#3b82f6" },
    ];

    return (
      <View style={{ paddingHorizontal: spacing.md }}>
        <View style={[card, { padding: spacing.md, borderRadius: radius.lg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md }}>
            <Ionicons name="wallet-outline" size={20} color={colors.accent} />
            <Text style={{ ...text.section, flex: 1 }}>Earnings Summary</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {summary.count_completed} job{summary.count_completed !== 1 ? "s" : ""}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {cards.map((c, i) => (
              <View
                key={i}
                style={{
                  width: i === 0 ? "100%" : "47%",
                  padding: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: colors.bg,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>{c.label}</Text>
                <Text style={{ fontSize: i === 0 ? 28 : 18, fontWeight: "800", color: c.color }}>
                  {formatCents(c.value)}
                </Text>
              </View>
            ))}
          </View>

          {summary.count_completed > 0 && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: spacing.md,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>Avg per Job</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                  {formatCents(summary.avg_net_completed_cents)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>Take Rate</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                  {(summary.take_rate_bps / 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderPayoutItem = ({ item }: { item: PayoutRecord }) => {
    const statusColor = PAYOUT_STATUS_COLORS[item.status] || "#6b7280";
    const statusLabel = PAYOUT_STATUS_LABELS[item.status] || item.status;
    const isPending = ["pending", "processing", "held"].includes(item.status);

    return (
      <Pressable
        onPress={() => {
          setSelectedPayout(item);
          setShowPayoutModal(true);
        }}
        style={({ pressed }) => ({
          ...card,
          padding: spacing.md,
          borderRadius: radius.md,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }} numberOfLines={1}>
              {item.job_title}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{item.customer_name}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: isPending ? "#3b82f6" : "#10b981" }}>
              {formatCents(item.net_amount_cents)}
            </Text>
            <View
              style={{
                marginTop: 4,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: statusColor + "20",
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor }}>{statusLabel}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {isPending ? "Created" : "Paid"}: {new Date(item.processed_at || item.created_at).toLocaleDateString()}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </Pressable>
    );
  };

  const renderPayoutsList = () => (
    <View style={{ marginTop: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
        <Ionicons name="list-outline" size={18} color={colors.accent} />
        <Text style={{ ...text.section, marginLeft: 8 }}>Payouts</Text>
      </View>

      {payouts.length === 0 && !payoutsLoading ? (
        <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
          <Text style={{ ...text.muted, marginTop: spacing.sm }}>No payouts in this period</Text>
        </View>
      ) : (
        <FlatList
          data={payouts}
          renderItem={renderPayoutItem}
          keyExtractor={(item) => item.payout_id}
          scrollEnabled={false}
          onEndReached={loadMorePayouts}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            payoutsLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
            ) : null
          }
        />
      )}
    </View>
  );

  const renderPayoutModal = () => {
    if (!selectedPayout) return null;

    const p = selectedPayout;
    const statusColor = PAYOUT_STATUS_COLORS[p.status] || "#6b7280";

    return (
      <Modal visible={showPayoutModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: insets.bottom + 20,
              maxHeight: "80%",
            }}
          >
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>

            <ScrollView style={{ paddingHorizontal: spacing.lg }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textPrimary }}>Payout Details</Text>
                <Pressable onPress={() => setShowPayoutModal(false)}>
                  <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                </Pressable>
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>Job</Text>
                <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>{p.job_title}</Text>
                <Text style={{ fontSize: 14, color: colors.textMuted }}>{p.customer_name}</Text>
              </View>

              <View
                style={{
                  marginTop: spacing.lg,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: colors.textMuted }}>Gross Amount</Text>
                  <Text style={{ fontWeight: "600", color: colors.textPrimary }}>{formatCents(p.gross_amount_cents)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: colors.textMuted }}>Commission</Text>
                  <Text style={{ fontWeight: "600", color: "#ef4444" }}>-{formatCents(p.commission_cents)}</Text>
                </View>
                {p.adjustments_cents !== 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: colors.textMuted }}>Adjustments</Text>
                    <Text style={{ fontWeight: "600", color: "#f59e0b" }}>
                      {p.adjustments_cents > 0 ? "+" : ""}{formatCents(p.adjustments_cents)}
                    </Text>
                  </View>
                )}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Net Payout</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#10b981" }}>{formatCents(p.net_amount_cents)}</Text>
                </View>
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm }}>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: statusColor + "20",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: statusColor }}>
                      {PAYOUT_STATUS_LABELS[p.status] || p.status}
                    </Text>
                  </View>
                </View>

                {p.scheduled_for && (
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>
                    Scheduled: {new Date(p.scheduled_for).toLocaleString()}
                  </Text>
                )}
                {p.processed_at && (
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>
                    Processed: {new Date(p.processed_at).toLocaleString()}
                  </Text>
                )}
                {p.failed_at && (
                  <Text style={{ fontSize: 13, color: "#ef4444", marginBottom: 4 }}>
                    Failed: {new Date(p.failed_at).toLocaleString()}
                  </Text>
                )}
                {p.held_at && (
                  <Text style={{ fontSize: 13, color: "#f59e0b", marginBottom: 4 }}>
                    Held: {new Date(p.held_at).toLocaleString()}
                  </Text>
                )}
                {p.failure_reason && (
                  <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: "#ef444420" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#ef4444" }}>Failure Reason</Text>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 4 }}>{p.failure_reason}</Text>
                  </View>
                )}
                {p.hold_reason && (
                  <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: "#f59e0b20" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#f59e0b" }}>Hold Reason</Text>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, marginTop: 4 }}>{p.hold_reason}</Text>
                  </View>
                )}
              </View>

              <Pressable
                onPress={() => {
                  setShowPayoutModal(false);
                  router.push(`/(mechanic)/payout-details/${p.job_id}`);
                }}
                style={{
                  marginTop: spacing.lg,
                  padding: 14,
                  borderRadius: radius.md,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.black }}>View Full Job Details</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderTaxSection = () => (
    <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.md }}>
      <View style={[card, { padding: spacing.md, borderRadius: radius.lg }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="document-text-outline" size={20} color={colors.accent} />
            <Text style={text.section}>Tax Summary</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 200 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {availableTaxYears.map((year) => (
                <Pressable
                  key={year}
                  onPress={() => setTaxYear(year)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                    backgroundColor: taxYear === year ? colors.accent : colors.surface,
                    borderWidth: 1,
                    borderColor: taxYear === year ? colors.accent : colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: taxYear === year ? colors.black : colors.textPrimary,
                    }}
                  >
                    {year}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {taxLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
        ) : taxSummary ? (
          <>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted }}>Total Payouts Received</Text>
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>
                  {formatCents(taxSummary.year_net_payouts_cents)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted }}>Commission Paid</Text>
                <Text style={{ fontWeight: "600", color: "#ef4444" }}>
                  -{formatCents(taxSummary.year_commission_cents)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted }}>Adjustments</Text>
                <Text style={{ fontWeight: "600", color: "#f59e0b" }}>
                  {taxSummary.year_adjustments_cents >= 0 ? "-" : "+"}{formatCents(Math.abs(taxSummary.year_adjustments_cents))}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Net Taxable Estimate</Text>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#10b981" }}>
                  {formatCents(taxSummary.year_taxable_estimate_cents)}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setShowTaxBreakdown(!showTaxBreakdown)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginTop: spacing.md,
                paddingVertical: 10,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ fontWeight: "600", color: colors.accent, marginRight: 6 }}>
                {showTaxBreakdown ? "Hide" : "View"} Monthly Breakdown
              </Text>
              <Ionicons name={showTaxBreakdown ? "chevron-up" : "chevron-down"} size={16} color={colors.accent} />
            </Pressable>

            {showTaxBreakdown && taxSummary.monthly_breakdown && (
              <View style={{ marginTop: spacing.md }}>
                <View
                  style={{
                    flexDirection: "row",
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: colors.textMuted }}>MONTH</Text>
                  <Text style={{ width: 80, fontSize: 11, fontWeight: "700", color: colors.textMuted, textAlign: "right" }}>
                    NET
                  </Text>
                  <Text style={{ width: 70, fontSize: 11, fontWeight: "700", color: colors.textMuted, textAlign: "right" }}>
                    COMM.
                  </Text>
                  <Text style={{ width: 60, fontSize: 11, fontWeight: "700", color: colors.textMuted, textAlign: "right" }}>
                    ADJ.
                  </Text>
                </View>
                {taxSummary.monthly_breakdown.map((m: MonthlyBreakdown) => (
                  <View
                    key={m.month}
                    style={{
                      flexDirection: "row",
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border + "40",
                    }}
                  >
                    <Text style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{MONTH_NAMES[m.month - 1]}</Text>
                    <Text style={{ width: 80, fontSize: 13, fontWeight: "600", color: colors.textPrimary, textAlign: "right" }}>
                      {formatCents(m.net_cents)}
                    </Text>
                    <Text style={{ width: 70, fontSize: 13, color: "#ef4444", textAlign: "right" }}>
                      {formatCents(m.commission_cents)}
                    </Text>
                    <Text style={{ width: 60, fontSize: 13, color: "#f59e0b", textAlign: "right" }}>
                      {formatCents(m.adjustments_cents)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View
              style={{
                marginTop: spacing.md,
                padding: 12,
                borderRadius: radius.md,
                backgroundColor: "#f59e0b" + "15",
                borderWidth: 1,
                borderColor: "#f59e0b" + "30",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="warning-outline" size={16} color="#f59e0b" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#f59e0b" }}>Disclaimer</Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, lineHeight: 16 }}>
                This is an estimate only and should not be considered tax advice. Please consult a qualified tax
                professional for accurate tax calculations and filing.
              </Text>
            </View>
          </>
        ) : (
          <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
            <Ionicons name="document-outline" size={40} color={colors.textMuted} />
            <Text style={{ ...text.muted, marginTop: spacing.sm }}>No tax data for {taxYear}</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ ...text.muted, marginTop: spacing.md }}>Loading earnings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={{ ...text.body, fontWeight: "700", marginTop: spacing.md }}>{error}</Text>
        <Pressable
          onPress={loadData}
          style={{
            marginTop: spacing.lg,
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: radius.md,
            backgroundColor: colors.accent,
          }}
        >
          <Text style={{ fontWeight: "700", color: colors.black }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={[colors.accent, colors.accent + "CC"]}
        style={{ paddingTop: insets.top, paddingBottom: spacing.md }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.black} />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.black }}>Earnings & Taxes</Text>
        </View>
      </LinearGradient>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={{ marginTop: spacing.md }}>{renderTimeRangeSelector()}</View>
        {renderCustomDatePickers()}
        <View style={{ marginTop: spacing.lg }}>{renderSummaryCards()}</View>
        {renderPayoutsList()}
        {renderTaxSection()}
      </ScrollView>

      {renderPayoutModal()}

      {showStartPicker && (
        <DateTimePicker
          value={customStart}
          mode="date"
          onChange={(_, date) => {
            setShowStartPicker(false);
            if (date) setCustomStart(date);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={customEnd}
          mode="date"
          onChange={(_, date) => {
            setShowEndPicker(false);
            if (date) setCustomEnd(date);
          }}
        />
      )}
    </View>
  );
}
