import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { notifyUser } from "../../../src/lib/notify";
import { CancelQuoteModal } from "../../../src/components/CancelQuoteModal";
import { UserProfileCard } from "../../../components/profile/UserProfileCardQuotes";
import { ProfileCardModal } from "../../../components/profile/ProfileCardModal";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type JobIntake = {
  symptom?: {
    key: string;
    label: string;
  };
  answers?: Record<string, string>;
  context?: {
    can_move?: string;
    location_type?: string;
    mileage?: string | null;
  };
  vehicle?: {
    id: string;
    year: number;
    make: string;
    model: string;
    nickname?: string | null;
  };
};

type Quote = {
  id: string;
  job_id: string;
  mechanic_id: string;
  status: "pending" | "quoted" | "accepted" | "rejected" | "canceled_by_customer" | "canceled_by_mechanic";
  proposed_price_cents: number | null;
  proposed_time_text: string | null;
  note: string | null;
  created_at: string;
  accepted_at: string | null;
  canceled_at: string | null;
  canceled_by: string | null;
  cancel_reason: string | null;
  cancel_note: string | null;
  cancellation_fee_cents: number | null;
  mechanic: { full_name: string | null; phone: string | null } | null;
};

type Job = {
  id: string;
  title: string;
  description: string | null;
  preferred_time: string | null;
  status: string;
  created_at: string;
  accepted_mechanic_id: string | null;
  accepted_mechanic: { full_name: string | null; phone: string | null } | null;
  vehicle_id: string | null;
  vehicle: { year: number; make: string; model: string } | null;
  canceled_at: string | null;
  canceled_by: string | null;
};

const parseJobIntake = (description: string | null): JobIntake | null => {
  if (!description) return null;
  try {
    const parsed = JSON.parse(description);
    return parsed as JobIntake;
  } catch {
    return null;
  }
};

const money = (cents: number | null) => (cents == null ? "—" : `$${(cents / 100).toFixed(0)}`);
const moneyDetailed = (cents: number | null) => (cents == null ? "—" : `$${(cents / 100).toFixed(2)}`);

const fmtDT = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const fmtRelative = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
};

export default function CustomerJobDetails() {
  const router = useRouter();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [job, setJob] = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);

  const statusColor = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted") return colors.accent;
    if (s === "work_in_progress") return colors.accent;
    if (s === "completed") return "#10b981";
    if (s === "searching") return colors.textMuted;
    if (s === "canceled" || s.includes("canceled")) return "#EF4444";
    return colors.textMuted;
  };

  const statusEmoji = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "searching") return "🔎";
    if (s === "accepted") return "✅";
    if (s === "work_in_progress") return "🛠️";
    if (s === "completed") return "🏁";
    if (s === "quoted") return "💬";
    if (s === "canceled" || s.includes("canceled")) return "❌";
    return "•";
  };

  const StatusPill = ({ status }: { status: string }) => {
    const c = statusColor(status);
    return (
      <View
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: c + "1F",
          borderWidth: 1,
          borderColor: c + "55",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 12 }}>{statusEmoji(status)}</Text>
        <Text style={{ fontSize: 12, fontWeight: "900", color: c }}>
          {(status || "unknown").toUpperCase()}
        </Text>
      </View>
    );
  };

  const SectionCard = ({
    title,
    icon,
    children,
  }: {
    title: string;
    icon?: any;
    children: any;
  }) => (
    <View style={[card, { padding: spacing.md, gap: spacing.sm }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {icon ? (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name={icon} size={18} color={colors.textPrimary} />
          </View>
        ) : null}
        <Text style={text.section}>{title}</Text>
      </View>
      {children}
    </View>
  );

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  };

  const openChat = useCallback(() => {
    if (!jobId) return;
    router.push(`/(customer)/messages/${jobId}` as any);
  }, [jobId, router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const customerId = userData.user?.id;
      if (!customerId || !jobId) return;

      const { data: j, error: jErr } = await supabase
        .from("jobs")
        .select(
          `
          id,title,description,preferred_time,status,created_at,accepted_mechanic_id,vehicle_id,
          accepted_mechanic:profiles!jobs_accepted_mechanic_id_fkey(full_name, phone),
          vehicle:vehicles(year, make, model)
        `
        )
        .eq("id", jobId)
        .eq("customer_id", customerId)
        .single();

      if (jErr) throw jErr;
      setJob(j as any as Job);

      const { data: q, error: qErr } = await supabase
        .from("quote_requests")
        .select(
          `
          id,job_id,mechanic_id,status,proposed_price_cents,proposed_time_text,note,created_at,
          accepted_at,canceled_at,canceled_by,cancel_reason,cancel_note,cancellation_fee_cents,
          mechanic:profiles!quote_requests_mechanic_id_fkey(full_name, phone)
        `
        )
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      setQuotes((q as any as Quote[]) ?? []);
    } catch (e: any) {
      Alert.alert("Job error", e?.message ?? "Failed to load job.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let channel: any;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const customerId = userData.user?.id;
      if (!customerId || !jobId) return;

      channel = supabase
        .channel("customer-job-" + jobId)
        .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${jobId}` }, load)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "quote_requests", filter: `job_id=eq.${jobId}` },
          load
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [jobId, load]);

  const quotedQuotes = useMemo(() => quotes.filter((q) => q.status === "quoted"), [quotes]);
  const acceptedQuote = useMemo(
    () => quotes.find((q) => q.status === "accepted" || q.mechanic_id === job?.accepted_mechanic_id),
    [quotes, job]
  );

  const quoteCount = quotes.length;
  const prices = quotes
    .map((q) => q.proposed_price_cents)
    .filter((p): p is number => p !== null && p !== undefined);
  const minQuote = prices.length > 0 ? Math.min(...prices) : null;
  const maxQuote = prices.length > 0 ? Math.max(...prices) : null;

  const acceptQuote = useCallback(
    async (quoteId: string) => {
      Alert.alert(
        "Accept Quote?",
        "After accepting, you'll be taken to the payment screen to complete your booking.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Accept & Pay",
            style: "default",
            onPress: async () => {
              try {
                setBusy(true);

                const { data: userData, error: authErr } = await supabase.auth.getUser();
                if (authErr) throw authErr;

                const customerId = userData.user?.id;
                if (!customerId) {
                  Alert.alert("Not signed in", "Please sign in again.");
                  router.replace("/(auth)/sign-in");
                  return;
                }

                const { data: quote, error: qGetErr } = await supabase
                  .from("quote_requests")
                  .select("id,job_id,mechanic_id,customer_id,status,proposed_price_cents")
                  .eq("id", quoteId)
                  .single();
                if (qGetErr) throw qGetErr;

                if (quote.customer_id !== customerId) return Alert.alert("Not allowed", "This quote is not yours.");
                if (quote.job_id !== jobId) return Alert.alert("Mismatch", "This quote is not for this job.");
                if (quote.status !== "quoted" || quote.proposed_price_cents == null) {
                  return Alert.alert("Quote not ready", "Wait for the mechanic to send a quote before accepting.");
                }

                const { data: acceptedQuote, error: qAccErr } = await supabase
                  .from("quote_requests")
                  .update({ status: "accepted", updated_at: new Date().toISOString() })
                  .eq("id", quoteId)
                  .select("id,mechanic_id,job_id")
                  .single();
                if (qAccErr) throw qAccErr;

                await notifyUser({
                  userId: acceptedQuote.mechanic_id,
                  title: "Quote accepted 🎉",
                  body: "Your quote was accepted. Waiting for customer payment.",
                  type: "quote_accepted",
                  entityType: "job",
                  entityId: jobId as any,
                });

                await supabase
                  .from("quote_requests")
                  .update({ status: "rejected", updated_at: new Date().toISOString() })
                  .eq("job_id", jobId)
                  .neq("id", quoteId);

                const { error: jErr } = await supabase
                  .from("jobs")
                  .update({
                    accepted_mechanic_id: acceptedQuote.mechanic_id,
                    status: "accepted",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", jobId);
                if (jErr) throw jErr;

                // Navigate to payment screen
                router.push(`/(customer)/payment/${jobId}?quoteId=${quoteId}`);
              } catch (e: any) {
                Alert.alert("Accept error", e?.message ?? "Failed to accept quote.");
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    },
    [jobId, router]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 10, ...text.muted }}>Loading job…</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
        <Text style={text.title}>Job</Text>
        <Text style={{ marginTop: 10, ...text.body }}>No job found.</Text>
      </View>
    );
  }

  const headerHint =
    job.accepted_mechanic_id
      ? "✅ Assigned — message your mechanic anytime."
      : quotedQuotes.length > 0
      ? `🎉 ${quotedQuotes.length} quote${quotedQuotes.length === 1 ? "" : "s"} ready — pick one to accept.`
      : "🔎 Searching — quotes will appear here as mechanics respond.";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(customer)/(tabs)/jobs"))}
            hitSlop={12}
            style={({ pressed }) => [{ paddingVertical: 8, paddingRight: 10 }, pressed && { opacity: 0.6 }]}
          >
            <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 18, marginLeft: 10, marginTop: 10 }}>Back</Text> 
          </Pressable>

          {job.accepted_mechanic_id ? (
            <Pressable
              onPress={openChat}
              hitSlop={12}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.accent,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={{ fontWeight: "900", color: "#fff" }}>Open Chat</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[card, { padding: spacing.lg, gap: 10 }]}>
          <Text style={text.title}>{job.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <StatusPill status={job.status} />
            <Text style={text.muted}>Created {fmtDT(job.created_at)}</Text>
          </View>

          <View
            style={{
              marginTop: 6,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: spacing.md,
            }}
          >
            <Text style={{ ...text.body, color: colors.textPrimary, fontWeight: "800" }}>{headerHint}</Text>
          </View>
        

        <SectionCard title="Job Details" icon="document-text-outline">
          {(() => {
            const intake = parseJobIntake(job.description);

            if (!intake) {
              return (
                <View>
                  {job.vehicle ? (
                    <View style={{ marginBottom: spacing.sm }}>
                      <Text style={{ ...text.muted, fontSize: 13 }}>Vehicle</Text>
                      <Text style={{ ...text.body, fontWeight: "900", marginTop: 2 }}>
                        {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                      </Text>
                    </View>
                  ) : null}
                  {job.preferred_time ? (
                    <View style={{ marginBottom: spacing.sm }}>
                      <Text style={{ ...text.muted, fontSize: 13 }}>Preferred Time</Text>
                      <Text style={{ ...text.body, fontWeight: "900", marginTop: 2 }}>{job.preferred_time}</Text>
                    </View>
                  ) : null}
                  {job.description ? (
                    <View>
                      <Text style={{ ...text.muted, fontSize: 13 }}>Description</Text>
                      <Text style={{ ...text.body, marginTop: 2 }}>{job.description}</Text>
                    </View>
                  ) : (
                    <Text style={text.muted}>No details provided.</Text>
                  )}
                </View>
              );
            }

            const vehicleData = intake.vehicle || job.vehicle;
            const symptomLabel = intake.symptom?.label || "Issue not specified";
            const answers = intake.answers || {};
            const context = intake.context || {};

            const canMoveText =
              context.can_move === "yes" ? "Yes" : context.can_move === "no" ? "No" : "Not sure";
            const locationText =
              context.location_type === "driveway"
                ? "Driveway"
                : context.location_type === "parking_lot"
                ? "Parking lot"
                : context.location_type === "roadside"
                ? "Roadside"
                : context.location_type || "Not specified";

            return (
              <View style={{ gap: spacing.md }}>
                {vehicleData && (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: spacing.md,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Ionicons name="car-outline" size={16} color={colors.accent} />
                      <Text style={{ ...text.muted, fontSize: 13, fontWeight: "900" }}>VEHICLE</Text>
                    </View>
                    <Text style={{ ...text.body, fontWeight: "900", fontSize: 16 }}>
                      {vehicleData.year} {vehicleData.make} {vehicleData.model}
                    </Text>
                    {intake.vehicle?.nickname && (
                      <Text style={{ ...text.muted, fontSize: 13, marginTop: 2 }}>"{intake.vehicle.nickname}"</Text>
                    )}
                  </View>
                )}

                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: spacing.md,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.accent} />
                    <Text style={{ ...text.muted, fontSize: 13, fontWeight: "900" }}>ISSUE</Text>
                  </View>
                  <Text style={{ ...text.body, fontWeight: "900", fontSize: 16 }}>{symptomLabel}</Text>
                </View>

                {Object.keys(answers).length > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: spacing.md,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.accent} />
                      <Text style={{ ...text.muted, fontSize: 13, fontWeight: "900" }}>CUSTOMER ANSWERS</Text>
                    </View>
                    <View style={{ gap: spacing.sm }}>
                      {Object.entries(answers).map(([key, value], idx) => {
                        const questionLabels: Record<string, string> = {
                          q1: "What's happening?",
                          q2: "When did it start?",
                          q3: "Any warning lights?",
                          q4: "Additional details",
                        };
                        const label = questionLabels[key] || `Question ${idx + 1}`;
                        return (
                          <View key={key}>
                            <Text style={{ ...text.muted, fontSize: 12 }}>{label}</Text>
                            <Text style={{ ...text.body, marginTop: 2 }}>{value || "—"}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: spacing.md,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                    <Text style={{ ...text.muted, fontSize: 13, fontWeight: "900" }}>CONTEXT</Text>
                  </View>
                  <View style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ ...text.muted, fontSize: 13 }}>Can move</Text>
                      <Text style={{ ...text.body, fontWeight: "900" }}>{canMoveText}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ ...text.muted, fontSize: 13 }}>Location</Text>
                      <Text style={{ ...text.body, fontWeight: "900" }}>{locationText}</Text>
                    </View>
                    {context.mileage && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ ...text.muted, fontSize: 13 }}>Mileage</Text>
                        <Text style={{ ...text.body, fontWeight: "900" }}>{context.mileage}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {job.preferred_time && (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: spacing.md,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Ionicons name="time-outline" size={16} color={colors.accent} />
                      <Text style={{ ...text.muted, fontSize: 13, fontWeight: "900" }}>PREFERRED TIME</Text>
                    </View>
                    <Text style={{ ...text.body, fontWeight: "900" }}>{job.preferred_time}</Text>
                  </View>
                )}
              </View>
            );
          })()}
        </SectionCard>
        </View>
        {job.status === "canceled" && job.canceled_by === "customer" && acceptedQuote && (
          <SectionCard title="Cancellation" icon="close-circle-outline">
            <View
              style={{
                backgroundColor: "#FEE2E2",
                borderWidth: 1,
                borderColor: "#FCA5A5",
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "900", color: "#991B1B" }}>
                ❌ JOB CANCELED
              </Text>
            </View>

            <Text style={text.body}>
              Canceled on: <Text style={{ fontWeight: "900" }}>{fmtDT(job.canceled_at || "")}</Text>
            </Text>

            {acceptedQuote.cancel_reason && (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ ...text.muted, fontSize: 13 }}>Reason</Text>
                <Text style={{ ...text.body, marginTop: 2 }}>
                  {acceptedQuote.cancel_reason.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </Text>
              </View>
            )}

            {acceptedQuote.cancel_note && (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ ...text.muted, fontSize: 13 }}>Note</Text>
                <Text style={{ ...text.body, marginTop: 2 }}>{acceptedQuote.cancel_note}</Text>
              </View>
            )}

            {acceptedQuote.cancellation_fee_cents && acceptedQuote.cancellation_fee_cents > 0 && (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ ...text.muted, fontSize: 13 }}>Cancellation Fee</Text>
                <Text style={{ ...text.title, fontSize: 20, color: "#EF4444", marginTop: 2 }}>
                  ${(acceptedQuote.cancellation_fee_cents / 100).toFixed(2)}
                </Text>
              </View>
            )}
          </SectionCard>
        )}
        <SectionCard title="Quotes" icon="pricetag-outline">
          {quoteCount > 0 && (
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.sm }}>
              <View
                style={{
                  flex: 1,
                  minWidth: 100,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.accent,
                  borderRadius: 12,
                  padding: spacing.md,
                }}
              >
                <Text style={{ ...text.muted, fontSize: 12 }}>Total Quotes</Text>
                <Text style={{ ...text.title, fontSize: 20, marginTop: 4 }}>{quoteCount}</Text>
              </View>

              {minQuote !== null && (
                <View
                  style={{
                    flex: 1,
                    minWidth: 100,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.accent,
                    borderRadius: 12,
                    padding: spacing.md,
                  }}
                >
                  <Text style={{ ...text.muted, fontSize: 12 }}>Best Price</Text>
                  <Text style={{ ...text.title, fontSize: 20, color: colors.accent, marginTop: 4 }}>
                    {money(minQuote)}
                  </Text>
                </View>
              )}

              {minQuote !== null && maxQuote !== null && minQuote !== maxQuote && (
                <View
                  style={{
                    flex: 1,
                    minWidth: 100,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: spacing.md,
                  }}
                >
                  <Text style={{ ...text.muted, fontSize: 12 }}>Price Range</Text>
                  <Text style={{ ...text.body, fontWeight: "900", marginTop: 4 }}>
                    {money(minQuote)} – {money(maxQuote)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {quotes.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: spacing.lg,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>⏳</Text>
              <Text style={{ ...text.section, textAlign: "center" }}>Waiting for quotes</Text>
              <Text style={{ ...text.muted, marginTop: 6, textAlign: "center" }}>
                Mechanics will respond soon. You'll see them here automatically.
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {quotes.map((q) => {
                const canAccept =
                  q.status === "quoted" && q.proposed_price_cents != null && !job.accepted_mechanic_id;
                const isAccepted = q.status === "accepted" || q.mechanic_id === job.accepted_mechanic_id;
                const isOpen = expanded[q.id] ?? isAccepted;

                return (
                  <Pressable
                    key={q.id}
                    onPress={() => toggleExpand(q.id)}
                    style={({ pressed }) => [
                      card,
                      pressed && cardPressed,
                      {
                        padding: spacing.md,
                        gap: spacing.sm,
                        borderColor: isAccepted ? colors.accent : colors.border,
                        borderWidth: isAccepted ? 2 : 1,
                      },
                    ]}
                  >
                    {isAccepted && (
                      <View
                        style={{
                          backgroundColor: `${colors.accent}15`,
                          borderWidth: 1,
                          borderColor: `${colors.accent}40`,
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "900", color: colors.accent }}>✓ ACCEPTED</Text>
                      </View>
                    )}

                    <View style={{ marginBottom: spacing.sm }}>
                      <UserProfileCard
                        userId={q.mechanic_id}
                        variant="mini"
                        context="quote_list"
                        onPressViewProfile={() => setSelectedMechanicId(q.mechanic_id)}
                      />
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ ...text.muted, fontSize: 12 }}>{fmtRelative(q.created_at)}</Text>
                      <StatusPill status={q.status} />
                    </View>

                    <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
                      <View
                        style={{
                          flex: 1,
                          minWidth: 120,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 10,
                          padding: spacing.sm,
                        }}
                      >
                        <Text style={{ ...text.muted, fontSize: 11 }}>Total Price</Text>
                        <Text style={{ ...text.title, fontSize: 18, color: colors.accent, marginTop: 2 }}>
                          {money(q.proposed_price_cents)}
                        </Text>
                      </View>

                      {q.proposed_time_text && (
                        <View
                          style={{
                            flex: 1,
                            minWidth: 120,
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 10,
                            padding: spacing.sm,
                          }}
                        >
                          <Text style={{ ...text.muted, fontSize: 11 }}>Availability</Text>
                          <Text style={{ ...text.body, fontWeight: "900", marginTop: 2, fontSize: 13 }}>
                            {q.proposed_time_text}
                          </Text>
                        </View>
                      )}
                    </View>

                    {isOpen && (
                      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                        {q.note && (
                          <View
                            style={{
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 10,
                              padding: spacing.md,
                            }}
                          >
                            <Text style={{ ...text.muted, fontWeight: "900", fontSize: 12 }}>Mechanic Note</Text>
                            <Text style={{ ...text.body, marginTop: 4 }}>{q.note}</Text>
                          </View>
                        )}

                        {q.mechanic?.phone && (
                          <View>
                            <Text style={{ ...text.muted, fontSize: 12 }}>Contact</Text>
                            <Text style={{ ...text.body, marginTop: 2 }}>{q.mechanic.phone}</Text>
                          </View>
                        )}

                        {canAccept && (
                          <Pressable
                            onPress={() => acceptQuote(q.id)}
                            disabled={busy}
                            style={({ pressed }) => [
                              {
                                marginTop: spacing.sm,
                                backgroundColor: colors.accent,
                                paddingVertical: 14,
                                borderRadius: 14,
                                alignItems: "center",
                                opacity: busy ? 0.65 : 1,
                              },
                              pressed && { opacity: 0.85 },
                            ]}
                          >
                            <Text style={{ fontWeight: "900", color: "#fff" }}>
                              {busy ? "ACCEPTING…" : "ACCEPT QUOTE"}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                      <Text style={{ ...text.muted, fontWeight: "800", fontSize: 12 }}>
                        {isOpen ? "Hide details" : "View details"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </SectionCard>
      {acceptedQuote && job && (
        <CancelQuoteModal
          visible={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            setShowCancelModal(false);
            load();
            router.replace("/(customer)/(tabs)/jobs");
          }}
          quoteId={acceptedQuote.id}
          jobId={job.id}
          acceptedAt={acceptedQuote.accepted_at}
          jobStatus={job.status}
        />
      )}
      {job.accepted_mechanic_id && acceptedQuote ? (
          <SectionCard title="Assigned Mechanic" icon="person-outline">
            <View
              style={{
                backgroundColor: `${colors.accent}15`,
                borderWidth: 1,
                borderColor: `${colors.accent}40`,
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "900", color: colors.accent }}>✓ ACCEPTED QUOTE</Text>
            </View>

            <Text style={text.body}>
              Name:{" "}
              <Text style={{ color: colors.textPrimary, fontWeight: "900" }}>
                {job.accepted_mechanic?.full_name ?? "Mechanic"}
              </Text>
            </Text>
            {job.accepted_mechanic?.phone ? (
              <Text style={text.body}>Phone: {job.accepted_mechanic.phone}</Text>
            ) : null}

            <Text style={{ ...text.muted, marginTop: spacing.sm }}>This job is assigned — chat is unlocked.</Text>

            <Pressable
              onPress={openChat}
              style={({ pressed }) => [
                {
                  marginTop: spacing.sm,
                  backgroundColor: colors.accent,
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: "center",
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ fontWeight: "900", color: "#fff" }}>Message Mechanic</Text>
            </Pressable>

            {job.status !== "completed" && job.status !== "canceled" && (
              <Pressable
                onPress={() => setShowCancelModal(true)}
                style={({ pressed }) => [
                  {
                    marginTop: spacing.sm,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: "#EF4444",
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: "center",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ fontWeight: "900", color: "#EF4444" }}>Cancel Job</Text>
              </Pressable>
            )}
          </SectionCard>
        ) : null}
        </ScrollView>

      {selectedMechanicId && (
        <ProfileCardModal
          visible={!!selectedMechanicId}
          userId={selectedMechanicId}
          onClose={() => setSelectedMechanicId(null)}
          title="Mechanic Profile"
          showReviewsButton={true}
        />
      )}
    </View>
  );
}