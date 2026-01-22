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
import { formatCents, PAYOUT_STATUS_LABELS, PAYOUT_STATUS_COLORS } from "../../../src/lib/financials";
import { WalkthroughTarget, WALKTHROUGH_TARGET_IDS } from "../../../src/onboarding";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Job = {
  id: string;
  title: string;
  status: string;
  preferred_time: string | null;
  created_at: string;
  customer_name: string | null;
  mechanic_payout_cents?: number | null;
  payout_status?: string | null;
  payment_status?: "pending" | "authorized" | "captured" | null;
  has_reviewed?: boolean;
  has_pending_review?: boolean;
};

type WaitingJob = {
  id: string;
  title: string;
  status: string;
  preferred_time: string | null;
  created_at: string;
  customer_name: string | null;
  quoteId: string;
  quotePriceCents: number | null;
  quoteStatus: string;
};

function StatusBadge({ status, colors, withAlpha }: { status: string; colors: any; withAlpha: any }) {
  const s = (status || "").toLowerCase();
  
  const config = useMemo(() => {
    if (s === "accepted" || s === "scheduled") {
      return { label: "Assigned", color: colors.primary, icon: "flash" as const };
    }
    if (s === "work_in_progress" || s === "in_progress") {
      return { label: "In Progress", color: colors.primary, icon: "construct" as const };
    }
    if (s === "completed") return { label: "Completed", color: colors.success, icon: "checkmark-circle" as const };
    if (s === "canceled" || s === "cancelled") return { label: "Canceled", color: colors.error, icon: "close-circle" as const };
    return { label: "Pending", color: colors.warning, icon: "time" as const };
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


function JobCard({ 
  item, 
  onPress,
  delay = 0,
}: { 
  item: Job;
  onPress: () => void;
  delay?: number;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const isCompleted = item.status === "completed";
  const payoutColor = item.payout_status ? PAYOUT_STATUS_COLORS[item.payout_status] : null;
  const payoutLabel = item.payout_status ? PAYOUT_STATUS_LABELS[item.payout_status] : null;

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
            <StatusBadge status={item.status || "pending"} colors={colors} withAlpha={withAlpha} />
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

          {item.preferred_time && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: spacing.sm,
            }}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={{
                fontSize: 13,
                color: colors.textSecondary,
              }}>{item.preferred_time}</Text>
            </View>
          )}

          {item.customer_name && (
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
                }}>Customer</Text>
                <Text style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textPrimary,
                }}>{item.customer_name}</Text>
              </View>
            </View>
          )}

          {isCompleted && item.mechanic_payout_cents && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.successBg,
              padding: spacing.md,
              borderRadius: radius.lg,
              marginBottom: spacing.sm,
            }}>
              <View>
                <Text style={{
                  fontSize: 11,
                  color: colors.success,
                  fontWeight: "600",
                  marginBottom: 2,
                }}>EARNINGS</Text>
                <Text style={{
                  fontSize: 20,
                  fontWeight: "800",
                  color: colors.success,
                }}>{formatCents(item.mechanic_payout_cents)}</Text>
              </View>
              {payoutLabel && payoutColor && (
                <View style={{
                  backgroundColor: payoutColor + "20",
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                }}>
                  <Text style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: payoutColor,
                  }}>{payoutLabel}</Text>
                </View>
              )}
            </View>
          )}

          {isCompleted && item.has_pending_review && !item.has_reviewed && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                backgroundColor: colors.warningBg,
                padding: spacing.sm,
                borderRadius: radius.md,
                marginBottom: spacing.sm,
              }}
            >
              <Ionicons name="star" size={14} color={colors.warning} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.warning }}>Review Customer</Text>
            </Pressable>
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
      </AnimatedPressable>
    </Animated.View>
  );
}

function WaitingJobCard({ 
  item, 
  onPress,
  delay = 0,
}: { 
  item: WaitingJob;
  onPress: () => void;
  delay?: number;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const priceText = item.quotePriceCents ? `$${(item.quotePriceCents / 100).toFixed(0)}` : "TBD";

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
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: withAlpha(colors.warning, 0.12),
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 20,
            }}>
              <Ionicons name="pricetag" size={12} color={colors.warning} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.warning }}>Quote Sent</Text>
            </View>
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

          {item.customer_name && (
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
                }}>Customer</Text>
                <Text style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textPrimary,
                }}>{item.customer_name}</Text>
              </View>
            </View>
          )}

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
              }}>YOUR QUOTE</Text>
              <Text style={{
                fontSize: 20,
                fontWeight: "800",
                color: colors.warning,
              }}>{priceText}</Text>
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
              }}>Pending</Text>
            </View>
          </View>

          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
            <Text style={{
              fontSize: 13,
              color: colors.textMuted,
            }}>Waiting for customer response</Text>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.warning,
              }}>View Quote</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.warning} />
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function EmptyState({ onAction, type }: { onAction?: () => void; type: "active" | "waiting" | "completed" }) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  
  const config = {
    active: {
      icon: "flash" as const,
      title: "No active jobs",
      subtitle: "When customers accept your quotes, active jobs will appear here",
      action: "View Leads",
    },
    waiting: {
      icon: "time" as const,
      title: "No pending quotes",
      subtitle: "Quotes you send will appear here while waiting for customer response",
      action: "Browse Leads",
    },
    completed: {
      icon: "checkmark-circle" as const,
      title: "No completed jobs yet",
      subtitle: "Your completed jobs and earnings will show up here",
      action: null,
    },
  };

  const { icon, title, subtitle, action } = config[type];
  
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
        <Ionicons name={icon} size={36} color={colors.primary} />
      </View>
      
      <Text style={{
        fontSize: 20,
        fontWeight: "700",
        color: colors.textPrimary,
        marginBottom: spacing.xs,
      }}>{title}</Text>
      
      <Text style={{
        fontSize: 15,
        color: colors.textMuted,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: spacing.lg,
      }}>{subtitle}</Text>
      
      {action && onAction && (
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
          }}>{action}</Text>
        </Pressable>
      )}
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

export default function MechanicJobs() {
  const router = useRouter();
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [waitingJobs, setWaitingJobs] = useState<WaitingJob[]>([]);
  const [reviewPrompts, setReviewPrompts] = useState<ReviewPrompt[]>([]);
  const [mechanicId, setMechanicId] = useState<string | null>(null);
  const [showFinancials, setShowFinancials] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "waiting" | "completed">("active");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const mId = userData.user?.id;
      if (!mId) {
        setJobs([]);
        setWaitingJobs([]);
        return;
      }
      setMechanicId(mId);

      const { data, error } = await supabase
        .from("jobs")
        .select("id,title,status,preferred_time,created_at,customer_id")
        .eq("accepted_mechanic_id", mId)
        .in("status", ["accepted", "scheduled", "in_progress", "work_in_progress", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: pendingQuotes, error: quotesErr } = await supabase
        .from("quotes")
        .select("id,job_id,price_cents,status,created_at")
        .eq("mechanic_id", mId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (quotesErr) throw quotesErr;

      const pendingJobIds = (pendingQuotes ?? []).map((q: any) => q.job_id).filter(Boolean);

      let waitingJobsData: WaitingJob[] = [];
      if (pendingJobIds.length > 0) {
        const { data: waitingJobRows } = await supabase
          .from("jobs")
          .select("id,title,status,preferred_time,created_at,customer_id")
          .in("id", pendingJobIds)
          .neq("status", "cancelled");

        if (waitingJobRows) {
          const waitingCustomerIds = Array.from(new Set((waitingJobRows as any[]).map((j) => j.customer_id).filter(Boolean)));
          let waitingNameById = new Map<string, string>();

          if (waitingCustomerIds.length > 0) {
            const { data: profRows } = await supabase
              .from("profiles")
              .select("id,full_name")
              .in("id", waitingCustomerIds);

            ((profRows ?? []) as any[]).forEach((p) => {
              if (p.id) waitingNameById.set(p.id, p.full_name?.trim() || "Customer");
            });
          }

          const quoteByJobId = new Map<string, any>();
          (pendingQuotes ?? []).forEach((q: any) => {
            quoteByJobId.set(q.job_id, q);
          });

          waitingJobsData = (waitingJobRows as any[]).map((j) => {
            const q = quoteByJobId.get(j.id);
            return {
              id: j.id,
              title: j.title || "Job",
              status: j.status,
              preferred_time: j.preferred_time,
              created_at: j.created_at,
              customer_name: waitingNameById.get(j.customer_id) || null,
              quoteId: q?.id,
              quotePriceCents: q?.price_cents,
              quoteStatus: q?.status || "pending",
            };
          });
        }
      }

      setWaitingJobs(waitingJobsData);

      const jobsData = (data ?? []) as any[];
      const customerIds = Array.from(new Set(jobsData.map((j) => j.customer_id).filter(Boolean)));
      const jobIds = jobsData.map((j) => j.id);

      let nameById = new Map<string, string>();
      if (customerIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", customerIds);

        ((profRows ?? []) as any[]).forEach((p) => {
          if (p.id) nameById.set(p.id, p.full_name?.trim() || "Customer");
        });
      }

      let contractsByJobId = new Map<string, any>();
      let payoutsByContractId = new Map<string, any>();

      if (jobIds.length > 0) {
        const { data: contracts } = await supabase
          .from("job_contracts")
          .select("job_id, mechanic_payout_cents, payment_authorized_at, payment_captured_at, id")
          .in("job_id", jobIds)
          .eq("mechanic_id", mId);

        (contracts ?? []).forEach((c: any) => {
          contractsByJobId.set(c.job_id, c);
        });

        const contractIds = (contracts ?? []).map((c: any) => c.id).filter(Boolean);
        if (contractIds.length > 0) {
          const { data: payouts } = await supabase
            .from("payouts")
            .select("contract_id, status")
            .in("contract_id", contractIds);

          (payouts ?? []).forEach((p: any) => {
            payoutsByContractId.set(p.contract_id, p);
          });
        }
      }

      const completedJobIds = jobsData.filter((j) => j.status === "completed").map((j) => j.id);
      let reviewedJobIds = new Set<string>();

      if (completedJobIds.length > 0) {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("job_id")
          .eq("reviewer_id", mId)
          .in("job_id", completedJobIds);

        (reviews ?? []).forEach((r: any) => {
          reviewedJobIds.add(r.job_id);
        });
      }

      const prompts = await getPendingReviewPrompts(mId);
      setReviewPrompts(prompts);
      const promptJobIds = new Set(prompts.map((p) => p.job_id));

      setJobs(
        jobsData.map((j) => {
          const contract = contractsByJobId.get(j.id);
          const payout = contract ? payoutsByContractId.get(contract.id) : null;

          let paymentStatus: Job["payment_status"] = null;
          if (contract) {
            if (contract.payment_captured_at) {
              paymentStatus = "captured";
            } else if (contract.payment_authorized_at) {
              paymentStatus = "authorized";
            } else {
              paymentStatus = "pending";
            }
          }

          return {
            id: j.id,
            title: j.title || "Job",
            status: j.status,
            preferred_time: j.preferred_time,
            created_at: j.created_at,
            customer_name: nameById.get(j.customer_id) || null,
            mechanic_payout_cents: contract?.mechanic_payout_cents || null,
            payout_status: payout?.status || null,
            payment_status: paymentStatus,
            has_reviewed: reviewedJobIds.has(j.id),
            has_pending_review: promptJobIds.has(j.id),
          };
        })
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load jobs.");
      setJobs([]);
      setWaitingJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      let channel: any;

      (async () => {
        const { data: userData } = await supabase.auth.getUser();
        const mechanicId = userData.user?.id;
        if (!mechanicId) return;

        channel = supabase
          .channel("mechanic-jobs-" + mechanicId)
          .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `accepted_mechanic_id=eq.${mechanicId}` }, () => load())
          .subscribe();
      })();

      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const activeJobs = useMemo(
    () => jobs.filter((j) => ["accepted", "scheduled", "in_progress", "work_in_progress"].includes((j.status || "").toLowerCase())),
    [jobs]
  );
  const completedJobs = useMemo(
    () => jobs.filter((j) => (j.status || "").toLowerCase() === "completed"),
    [jobs]
  );

  const tabs = [
    { key: "active" as const, label: "Active", icon: "flash" as const, count: activeJobs.length, color: colors.primary },
    { key: "waiting" as const, label: "Waiting", icon: "time" as const, count: waitingJobs.length, color: colors.warning },
    { key: "completed" as const, label: "Done", icon: "checkmark-circle" as const, count: completedJobs.length, color: colors.success },
  ];

  const currentJobs = activeTab === "active" ? activeJobs : activeTab === "completed" ? completedJobs : [];

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <WalkthroughTarget id={WALKTHROUGH_TARGET_IDS.MECHANIC_EARNINGS_TAB} style={{ flex: 1 }}>
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
              }}>Manage your assigned work</Text>
            </Animated.View>
          </View>

          {/* Segmented Tab Toggle */}
          <View style={{
            flexDirection: "row",
            marginHorizontal: spacing.lg,
            backgroundColor: colors.surface2,
            borderRadius: radius.xl,
            padding: 4,
            marginBottom: spacing.md,
          }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.lg,
                    backgroundColor: isActive ? colors.surface : "transparent",
                    ...(isActive ? shadows.sm : {}),
                  }}
                >
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={isActive ? tab.color : colors.textMuted}
                  />
                  <Text style={{
                    fontSize: 13,
                    fontWeight: isActive ? "700" : "500",
                    color: isActive ? tab.color : colors.textMuted,
                  }}>{tab.label}</Text>
                  {tab.count > 0 && (
                    <View style={{
                      backgroundColor: isActive ? withAlpha(tab.color, 0.15) : colors.surface,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 10,
                      minWidth: 20,
                      alignItems: "center",
                    }}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isActive ? tab.color : colors.textMuted,
                      }}>{tab.count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {mechanicId && completedJobs.length > 0 && (
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
                  }}>Earnings Summary</Text>
                </View>
                <Ionicons
                  name={showFinancials ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
              {showFinancials && (
                <View style={{ marginTop: spacing.sm }}>
                  <FinancialSummary userId={mechanicId} role="mechanic" />
                </View>
              )}
            </Animated.View>
          )}

          {jobs.length === 0 && waitingJobs.length === 0 ? (
            <EmptyState type="active" onAction={() => router.push("/(mechanic)/(tabs)/leads" as any)} />
          ) : activeTab === "waiting" ? (
            waitingJobs.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl }}>
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: withAlpha(colors.warning, 0.1),
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing.md,
                }}>
                  <Ionicons name="time" size={28} color={colors.warning} />
                </View>
                <Text style={{
                  fontSize: 17,
                  fontWeight: "600",
                  color: colors.textPrimary,
                  marginBottom: spacing.xs,
                }}>No pending quotes</Text>
                <Text style={{
                  fontSize: 14,
                  color: colors.textMuted,
                  textAlign: "center",
                }}>Quotes you send will appear here while waiting for customer response</Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: spacing.lg }}>
                {waitingJobs.map((item, index) => (
                  <WaitingJobCard
                    key={item.quoteId || item.id}
                    item={item}
                    onPress={() => router.push(`/(mechanic)/quote-sent/${item.id}` as any)}
                    delay={350 + index * 50}
                  />
                ))}
              </View>
            )
          ) : currentJobs.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: withAlpha(tabs.find(t => t.key === activeTab)?.color || colors.primary, 0.1),
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.md,
              }}>
                <Ionicons
                  name={tabs.find(t => t.key === activeTab)?.icon || "flash"}
                  size={28}
                  color={tabs.find(t => t.key === activeTab)?.color || colors.primary}
                />
              </View>
              <Text style={{
                fontSize: 17,
                fontWeight: "600",
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}>No {activeTab} jobs</Text>
              <Text style={{
                fontSize: 14,
                color: colors.textMuted,
                textAlign: "center",
              }}>
                {activeTab === "active" && "Jobs you've been assigned will appear here"}
                {activeTab === "completed" && "Your completed jobs will appear here"}
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: spacing.lg }}>
              {activeTab === "active" && reviewPrompts.length > 0 && (
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
                          userRole="mechanic"
                        />
                      </Animated.View>
                    ))}
                  </View>
                </>
              )}

              {currentJobs.map((item, index) => (
                <JobCard
                  key={item.id}
                  item={item}
                  onPress={() => router.push(`/(mechanic)/job-details/${item.id}` as any)}
                  delay={350 + index * 50}
                />
              ))}
            </View>
          )}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </WalkthroughTarget>
    </View>
  );
}