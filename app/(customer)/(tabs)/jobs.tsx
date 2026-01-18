import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { getDisplayTitle } from "../../../src/lib/format-symptom";
import { Ionicons } from "@expo/vector-icons";
import { getPendingReviewPrompts, ReviewPrompt } from "../../../src/lib/reviews";
import ReviewPromptBanner from "../../../components/reviews/ReviewPromptBanner";
import { FinancialSummary } from "../../../components/financials";
import { WalkthroughTarget, WALKTHROUGH_TARGET_IDS } from "../../../src/onboarding";

type QuoteSummary = {
  quoteCount: number;
  minQuote: number | null;
  maxQuote: number | null;
  newestQuoteAt: string | null;
  hasQuotes: boolean;
  acceptedQuoteId: string | null;
  acceptedMechanicName: string | null;
};

type Job = {
  id: string;
  title: string | null;
  status: string | null;
  preferred_time: string | null;
  created_at: string;
  accepted_mechanic_id: string | null;
  vehicle?: {
    year: number;
    make: string;
    model: string;
  } | null | Array<{
    year: number;
    make: string;
    model: string;
  }>;
};

type JobWithQuoteSummary = Job & { quoteSummary: QuoteSummary };
type ProfileName = { id: string; full_name: string | null };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function StatusBadge({ status, colors, withAlpha }: { status: string; colors: any; withAlpha: any }) {
  const s = (status || "").toLowerCase();
  
  const config = useMemo(() => {
    if (s === "accepted" || s === "work_in_progress" || s === "in_progress") {
      return { label: s === "work_in_progress" || s === "in_progress" ? "In Progress" : "Accepted", color: colors.primary, icon: "flash" as const };
    }
    if (s === "completed") return { label: "Completed", color: colors.success, icon: "checkmark-circle" as const };
    if (s === "quoted") return { label: "Quoted", color: colors.warning, icon: "pricetag" as const };
    if (s === "canceled" || s === "cancelled") return { label: "Canceled", color: colors.error, icon: "close-circle" as const };
    return { label: "Searching", color: colors.info, icon: "search" as const };
  }, [s, colors]);

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: withAlpha(config.color, 0.12),
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    }}>
      <Ionicons name={config.icon} size={12} color={config.color} />
      <Text style={{ fontSize: 11, fontWeight: "700", color: config.color }}>{config.label}</Text>
    </View>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  color,
  isActive,
}: { 
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  isActive?: boolean;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  
  return (
    <View style={{
      flex: 1,
      backgroundColor: isActive ? withAlpha(color, 0.15) : colors.surface,
      borderRadius: radius.xl,
      padding: spacing.md,
      alignItems: "center",
      borderWidth: isActive ? 2 : 1,
      borderColor: isActive ? withAlpha(color, 0.3) : colors.border,
    }}>
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: withAlpha(color, 0.15),
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.xs,
      }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{
        fontSize: 24,
        fontWeight: "800",
        color: colors.textPrimary,
        marginBottom: 2,
      }}>{value}</Text>
      <Text style={{
        fontSize: 11,
        fontWeight: "600",
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}>{label}</Text>
    </View>
  );
}

function JobCard({ 
  item, 
  onPress,
  onCancel,
  canceling,
  delay = 0,
}: { 
  item: JobWithQuoteSummary;
  onPress: () => void;
  onCancel: () => void;
  canceling: boolean;
  delay?: number;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const qs = item.quoteSummary;
  const s = (item.status || "").toLowerCase();
  const isSearching = s === "searching" && !qs.hasQuotes;
  const hasQuotes = qs.hasQuotes && qs.minQuote !== null;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const vehicleText = useMemo(() => {
    if (!item.vehicle) return null;
    const v = Array.isArray(item.vehicle) ? item.vehicle[0] : item.vehicle;
    if (!v) return null;
    return `${v.year} ${v.make} ${v.model}`;
  }, [item.vehicle]);

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          marginBottom: spacing.md,
          overflow: "hidden",
          ...shadows.sm,
        }]}
      >
        <View style={{ padding: spacing.lg }}>
          <View style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
          }}>
            <StatusBadge status={item.status || "searching"} colors={colors} withAlpha={withAlpha} />
            <Text style={{
              fontSize: 12,
              color: colors.textMuted,
            }}>{fmtDate(item.created_at)}</Text>
          </View>

          <Text style={{
            fontSize: 17,
            fontWeight: "700",
            color: colors.textPrimary,
            marginBottom: spacing.xs,
            lineHeight: 22,
          }} numberOfLines={2}>{getDisplayTitle(item.title) || "Service Request"}</Text>

          {vehicleText && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: spacing.sm,
            }}>
              <Ionicons name="car-sport" size={14} color={colors.textMuted} />
              <Text style={{
                fontSize: 13,
                color: colors.textSecondary,
              }}>{vehicleText}</Text>
            </View>
          )}

          {qs.acceptedMechanicName && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: withAlpha(colors.primary, 0.08),
              padding: spacing.sm,
              borderRadius: radius.md,
              marginBottom: spacing.sm,
            }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: withAlpha(colors.primary, 0.15),
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Ionicons name="person" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  marginBottom: 1,
                }}>Assigned Mechanic</Text>
                <Text style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textPrimary,
                }}>{qs.acceptedMechanicName}</Text>
              </View>
            </View>
          )}

          {hasQuotes && !qs.acceptedMechanicName && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.warningBg,
              padding: spacing.md,
              borderRadius: radius.lg,
              marginBottom: spacing.sm,
            }}>
              <View>
                <Text style={{
                  fontSize: 11,
                  color: colors.warning,
                  fontWeight: "600",
                  marginBottom: 2,
                }}>{qs.quoteCount} {qs.quoteCount === 1 ? "QUOTE" : "QUOTES"} RECEIVED</Text>
                <Text style={{
                  fontSize: 20,
                  fontWeight: "800",
                  color: colors.warning,
                }}>${(qs.minQuote! / 100).toFixed(0)}{qs.maxQuote !== qs.minQuote && ` - $${(qs.maxQuote! / 100).toFixed(0)}`}</Text>
              </View>
              <View style={{
                backgroundColor: colors.warning,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
              }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.white,
                }}>Review</Text>
              </View>
            </View>
          )}

          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={{
                fontSize: 13,
                color: colors.textMuted,
              }}>{item.preferred_time || "Flexible timing"}</Text>
            </View>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.primary,
              }}>View Details</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </View>
          </View>
        </View>

        {isSearching && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            disabled={canceling}
            style={({ pressed }) => ({
              paddingVertical: spacing.md,
              backgroundColor: pressed ? withAlpha(colors.error, 0.1) : withAlpha(colors.error, 0.05),
              borderTopWidth: 1,
              borderTopColor: withAlpha(colors.error, 0.1),
              alignItems: "center",
              opacity: canceling ? 0.5 : 1,
            })}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: "600",
              color: colors.error,
            }}>{canceling ? "Canceling..." : "Cancel Request"}</Text>
          </Pressable>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

function EmptyState({ onAction }: { onAction: () => void }) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  
  return (
    <Animated.View 
      entering={FadeIn.delay(200).duration(400)}
      style={{
        alignItems: "center",
        paddingVertical: spacing.xxxl,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: withAlpha(colors.primary, 0.1),
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
      }}>
        <Ionicons name="car-sport" size={36} color={colors.primary} />
      </View>
      
      <Text style={{
        fontSize: 20,
        fontWeight: "700",
        color: colors.textPrimary,
        marginBottom: spacing.xs,
      }}>No jobs yet</Text>
      
      <Text style={{
        fontSize: 15,
        color: colors.textMuted,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: spacing.lg,
      }}>Request a mechanic to get started with your first service</Text>
      
      <Pressable
        onPress={onAction}
        style={({ pressed }) => ({
          backgroundColor: colors.accent,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.xl,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Text style={{
          fontSize: 15,
          fontWeight: "700",
          color: colors.buttonText,
        }}>Request a Mechanic</Text>
      </Pressable>
    </Animated.View>
  );
}

function SectionDivider({ title, count }: { title: string; count: number }) {
  const { colors, spacing } = useTheme();
  
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
    }}>
      <Text style={{
        fontSize: 13,
        fontWeight: "700",
        color: colors.textMuted,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}>{title}</Text>
      <View style={{
        backgroundColor: colors.surface2,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
      }}>
        <Text style={{
          fontSize: 12,
          fontWeight: "700",
          color: colors.textMuted,
        }}>{count}</Text>
      </View>
    </View>
  );
}

function LoadingSkeleton() {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();
  
  const shimmer = {
    backgroundColor: withAlpha(colors.textMuted, 0.08),
    borderRadius: radius.md,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ 
        paddingTop: insets.top + spacing.lg, 
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
      }}>
        <View style={[shimmer, { width: 120, height: 32, marginBottom: spacing.xs }]} />
        <View style={[shimmer, { width: 180, height: 16 }]} />
      </View>
      
      <View style={{ 
        flexDirection: "row", 
        gap: spacing.sm, 
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
      }}>
        <View style={[shimmer, { flex: 1, height: 100, borderRadius: radius.xl }]} />
        <View style={[shimmer, { flex: 1, height: 100, borderRadius: radius.xl }]} />
        <View style={[shimmer, { flex: 1, height: 100, borderRadius: radius.xl }]} />
      </View>
      
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={[shimmer, { height: 140, borderRadius: radius.xl, marginBottom: spacing.md }]} />
        <View style={[shimmer, { height: 140, borderRadius: radius.xl, marginBottom: spacing.md }]} />
        <View style={[shimmer, { height: 140, borderRadius: radius.xl }]} />
      </View>
    </View>
  );
}

export default function CustomerJobs() {
  const router = useRouter();
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<JobWithQuoteSummary[]>([]);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [reviewPrompts, setReviewPrompts] = useState<ReviewPrompt[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showFinancials, setShowFinancials] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = userData.user?.id;
      if (!userId) {
        setJobs([]);
        return;
      }
      setCustomerId(userId);

      const { data: jobRows, error: jobsErr } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at,accepted_mechanic_id,vehicle:vehicles(year,make,model)")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });

      if (jobsErr) throw jobsErr;

      const jobsData = ((jobRows as Job[]) ?? []).map((j) => ({
        ...j,
        title: j.title ?? "Job",
        status:
          j.accepted_mechanic_id && ["searching", "draft", "quoted"].includes(j.status ?? "")
            ? "accepted"
            : j.status ?? "searching",
        vehicle: Array.isArray(j.vehicle) && j.vehicle.length > 0 ? j.vehicle[0] : j.vehicle ?? null,
      }));

      if (jobsData.length === 0) {
        setJobs([]);
        return;
      }

      const jobIds = jobsData.map((j) => j.id);

      const { data: quoteRows, error: quotesErr } = await supabase
        .from("quotes")
        .select("id,job_id,mechanic_id,status,price_cents,created_at")
        .in("job_id", jobIds);

      if (quotesErr) throw quotesErr;

      const quotes = (quoteRows ?? []).map((q: any) => ({
        ...q,
        customer_id: userId,
        accepted_at: q.status === "accepted" ? q.created_at : null,
      }));

      const mechanicIds = Array.from(new Set(quotes.map((q: any) => q.mechanic_id).filter(Boolean)));
      const acceptedMechanicIds = Array.from(
        new Set(jobsData.map((j) => j.accepted_mechanic_id).filter((x): x is string => !!x))
      );
      const allMechanicIds = Array.from(new Set([...mechanicIds, ...acceptedMechanicIds]));

      let nameById = new Map<string, string>();
      if (allMechanicIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", allMechanicIds);

        ((profRows as ProfileName[]) ?? []).forEach((p) => {
          if (p.id) nameById.set(p.id, p.full_name?.trim() || "Mechanic");
        });
      }

      const jobsWithQuotes: JobWithQuoteSummary[] = jobsData.map((job) => {
        const jobQuotes = quotes
          .filter((q: any) => q.job_id === job.id)
          .sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at));

        const acceptedQuote = jobQuotes.find((q: any) => (q.status || "").toLowerCase() === "accepted");
        const prices = jobQuotes.map((q: any) => q.price_cents).filter((p: any) => typeof p === "number");

        const acceptedMechanicName =
          (job.accepted_mechanic_id && nameById.get(job.accepted_mechanic_id)) ||
          (acceptedQuote?.mechanic_id && nameById.get(acceptedQuote.mechanic_id)) ||
          null;

        return {
          ...job,
          quoteSummary: {
            quoteCount: jobQuotes.length,
            minQuote: prices.length ? Math.min(...prices) : null,
            maxQuote: prices.length ? Math.max(...prices) : null,
            newestQuoteAt: jobQuotes.length ? jobQuotes[0].created_at : null,
            hasQuotes: jobQuotes.length > 0,
            acceptedQuoteId: acceptedQuote?.id ?? null,
            acceptedMechanicName,
          },
        };
      });

      setJobs(jobsWithQuotes);

      const prompts = await getPendingReviewPrompts(userId);
      setReviewPrompts(prompts);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      let jobsChannel: any;
      let quotesChannel: any;
      let reviewsChannel: any;

      (async () => {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;

        jobsChannel = supabase
          .channel("customer-jobs-" + userId)
          .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `customer_id=eq.${userId}` }, () => load())
          .subscribe();

        quotesChannel = supabase
          .channel("customer-quotes-" + userId)
          .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, () => load())
          .subscribe();

        reviewsChannel = supabase
          .channel("customer-reviews-" + userId)
          .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `reviewer_id=eq.${userId}` }, () => load())
          .subscribe();
      })();

      return () => {
        if (jobsChannel) supabase.removeChannel(jobsChannel);
        if (quotesChannel) supabase.removeChannel(quotesChannel);
        if (reviewsChannel) supabase.removeChannel(reviewsChannel);
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleCancelJob = useCallback(async (jobId: string) => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this service request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setCanceling(jobId);
              const { error } = await supabase
                .from("jobs")
                .update({ status: "cancelled", canceled_at: new Date().toISOString() })
                .eq("id", jobId);

              if (error) throw error;
              await load();
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to cancel job");
            } finally {
              setCanceling(null);
            }
          },
        },
      ]
    );
  }, [load]);

  const activeJobs = useMemo(
    () => jobs.filter((j) => ["accepted", "work_in_progress", "in_progress", "scheduled"].includes((j.status || "").toLowerCase())),
    [jobs]
  );
  const waitingJobs = useMemo(
    () => jobs.filter((j) => ["searching", "draft", "quoted"].includes((j.status || "").toLowerCase())),
    [jobs]
  );
  const completedJobs = useMemo(
    () => jobs.filter((j) => (j.status || "").toLowerCase() === "completed"),
    [jobs]
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.CUSTOMER_OFFERS_LIST} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={colors.primary} 
            />
          }
        >
          <View style={{
            paddingTop: insets.top + spacing.md,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.lg,
          }}>
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={{
                fontSize: 28,
                fontWeight: "800",
                color: colors.textPrimary,
                letterSpacing: -0.5,
                marginBottom: 4,
              }}>My Jobs</Text>
              <Text style={{
                fontSize: 15,
                color: colors.textMuted,
              }}>Track your service requests</Text>
            </Animated.View>
          </View>

          <View style={{
            flexDirection: "row",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.md,
          }}>
            <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ flex: 1 }}>
              <StatCard
                icon="flash"
                label="Active"
                value={activeJobs.length}
                color={colors.primary}
                isActive={activeJobs.length > 0}
              />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(150).duration(300)} style={{ flex: 1 }}>
              <StatCard
                icon="time"
                label="Waiting"
                value={waitingJobs.length}
                color={colors.warning}
                isActive={waitingJobs.length > 0}
              />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ flex: 1 }}>
              <StatCard
                icon="checkmark-circle"
                label="Done"
                value={completedJobs.length}
                color={colors.success}
              />
            </Animated.View>
          </View>

          {customerId && completedJobs.length > 0 && (
            <Animated.View 
              entering={FadeInDown.delay(250).duration(300)}
              style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}
            >
              <Pressable
                onPress={() => setShowFinancials(!showFinancials)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  ...shadows.sm,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: withAlpha(colors.success, 0.15),
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Ionicons name="wallet" size={18} color={colors.success} />
                  </View>
                  <Text style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.textPrimary,
                  }}>Spending Summary</Text>
                </View>
                <Ionicons
                  name={showFinancials ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
              {showFinancials && (
                <View style={{ marginTop: spacing.sm }}>
                  <FinancialSummary userId={customerId} role="customer" />
                </View>
              )}
            </Animated.View>
          )}

          {jobs.length === 0 ? (
            <EmptyState onAction={() => router.push("/explore")} />
          ) : (
            <View style={{ paddingHorizontal: spacing.lg }}>
              {reviewPrompts.length > 0 && (
                <>
                  <SectionDivider title="Pending Reviews" count={reviewPrompts.length} />
                  <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
                    {reviewPrompts.map((prompt, index) => (
                      <Animated.View 
                        key={prompt.id}
                        entering={FadeInDown.delay(300 + index * 50).duration(300)}
                      >
                        <ReviewPromptBanner
                          jobId={prompt.job_id}
                          targetName={prompt.target_name}
                          expiresAt={prompt.expires_at}
                          userRole="customer"
                        />
                      </Animated.View>
                    ))}
                  </View>
                </>
              )}

              {activeJobs.length > 0 && (
                <>
                  <SectionDivider title="Active Jobs" count={activeJobs.length} />
                  {activeJobs.map((item, index) => (
                    <JobCard
                      key={item.id}
                      item={item}
                      onPress={() => router.push(`/(customer)/job/${item.id}` as any)}
                      onCancel={() => handleCancelJob(item.id)}
                      canceling={canceling === item.id}
                      delay={350 + index * 50}
                    />
                  ))}
                </>
              )}

              {waitingJobs.length > 0 && (
                <>
                  <SectionDivider title="Waiting for Quotes" count={waitingJobs.length} />
                  {waitingJobs.map((item, index) => (
                    <JobCard
                      key={item.id}
                      item={item}
                      onPress={() => router.push(`/(customer)/job/${item.id}` as any)}
                      onCancel={() => handleCancelJob(item.id)}
                      canceling={canceling === item.id}
                      delay={400 + index * 50}
                    />
                  ))}
                </>
              )}

              {completedJobs.length > 0 && (
                <>
                  <SectionDivider title="Completed" count={completedJobs.length} />
                  {completedJobs.slice(0, 5).map((item, index) => (
                    <JobCard
                      key={item.id}
                      item={item}
                      onPress={() => router.push(`/(customer)/job/${item.id}` as any)}
                      onCancel={() => {}}
                      canceling={false}
                      delay={450 + index * 50}
                    />
                  ))}
                  {completedJobs.length > 5 && (
                    <Pressable
                      onPress={() => {}}
                      style={{ paddingVertical: spacing.md, alignItems: "center" }}
                    >
                      <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.primary,
                      }}>View all {completedJobs.length} completed jobs</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          )}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </WalkthroughTarget>
    </View>
  );
}
