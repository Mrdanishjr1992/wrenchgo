import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  RefreshControl,
  Platform,
  UIManager,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { createCard } from "../../../src/ui/styles";
import { useTheme } from "../../../src/ui/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserProfileCard } from "../../../components/profile/UserProfileCardQuotes";
import { ProfileCardModal } from "../../../components/profile/ProfileCardModal";

import { JobProgressTracker, InvoiceView, JobActions, AddLineItemForm } from "../../../components/job";
import { getContractWithDetails, subscribeToJobProgress, subscribeToJobContract } from "../../../src/lib/job-contract";
import { getInvoiceByJobId, subscribeToLineItems } from "../../../src/lib/invoice";
import type { JobContract, JobProgress, Invoice } from "../../../src/types/job-lifecycle";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type JobIntake = {
  symptom?: { key: string; label: string };
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

type Job = {
  id: string;
  title: string;
  description: string | null;
  preferred_time: string | null;
  status: string;
  created_at: string;
  accepted_mechanic_id: string | null;
  customer_id: string;
  vehicle_id: string | null;
  vehicle: { year: number; make: string; model: string } | null;
  canceled_at: string | null;
  canceled_by: string | null;
};

type QuoteRequest = {
  id: string;
  job_id: string;
  status: string;
  canceled_at: string | null;
  canceled_by: string | null;
  cancel_reason: string | null;
  cancel_note: string | null;
  cancellation_fee_cents: number | null;
};

const parseJobIntake = (description: string | null): JobIntake | null => {
  if (!description) return null;
  try {
    return JSON.parse(description) as JobIntake;
  } catch {
    return null;
  }
};

const fmtDT = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const normalizeCanMove = (raw?: string) => {
  const s = (raw || "").trim();
  const l = s.toLowerCase();
  if (!s) return "Not sure";
  if (l === "yes") return "Yes";
  if (l === "no") return "No";
  if (l === "not sure" || l === "unsure") return "Not sure";
  return s;
};

const normalizeLocation = (raw?: string) => {
  const s = (raw || "").trim();
  const l = s.toLowerCase();
  if (!s) return "Not specified";
  if (l === "driveway") return "Driveway";
  if (l === "parking_lot" || l === "parking lot") return "Parking lot";
  if (l === "roadside") return "Roadside";
  return s;
};

export default function MechanicJobDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, text, spacing } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [contract, setContract] = useState<JobContract | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [showAddLineItem, setShowAddLineItem] = useState(false);

  const statusColor = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted") return colors.accent;
    if (s === "work_in_progress") return colors.accent;
    if (s === "completed") return "#10b981";
    if (s === "searching") return colors.textMuted;
    if (s === "quoted") return "#f59e0b";
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const mechanicId = userData.user?.id;

      if (!mechanicId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data, error } = await supabase
        .from("jobs")
        .select(
          `
          id,title,description,preferred_time,status,created_at,accepted_mechanic_id,customer_id,vehicle_id,
          canceled_at,canceled_by,
          vehicle:vehicles(year, make, model)
        `
        )
        .eq("id", id)
        .eq("accepted_mechanic_id", mechanicId)
        .single();

      if (error) throw error;
      setJob(data as any as Job);

      const { data: quoteData } = await supabase
        .from("quotes")
        .select("id,job_id,status,price_cents,estimated_hours,notes,created_at,updated_at,cancel_reason,cancel_note,cancellation_fee_cents")
        .eq("job_id", id)
        .eq("mechanic_id", mechanicId)
        .single();

      if (quoteData) {
        setQuoteRequest(quoteData as any as QuoteRequest);
      }

      if (data?.accepted_mechanic_id === mechanicId) {
        const lifecycleData = await getContractWithDetails(id);
        setContract(lifecycleData.contract);
        setProgress(lifecycleData.progress);

        const invoiceData = await getInvoiceByJobId(id);
        setInvoice(invoiceData);
      } else {
        setContract(null);
        setProgress(null);
        setInvoice(null);
      }
    } catch (e: any) {
      Alert.alert("Job error", e?.message ?? "Failed to load job.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let channel: any;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const mechanicId = userData.user?.id;
      if (!mechanicId || !id) return;

      channel = supabase
        .channel("mechanic-job-" + id)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "jobs",
          filter: `id=eq.${id}`
        }, load)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "quotes",
          filter: `job_id=eq.${id}`
        }, load)
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [id, load]);

  useEffect(() => {
    if (!job?.accepted_mechanic_id || !id || !contract) return;

    const progressSub = subscribeToJobProgress(id, (p) => setProgress(p));
    const contractSub = subscribeToJobContract(id, (c) => setContract(c));
    const lineItemsSub = contract?.id
      ? subscribeToLineItems(contract.id, async () => {
          const invoiceData = await getInvoiceByJobId(id);
          setInvoice(invoiceData);
        })
      : null;

    return () => {
      progressSub?.unsubscribe();
      contractSub?.unsubscribe();
      lineItemsSub?.unsubscribe();
    };
  }, [id, job?.accepted_mechanic_id, contract?.id]);

  const openChat = useCallback(() => {
    if (!job?.id) return;
    router.push(`/(mechanic)/messages/${job.id}` as any);
  }, [job?.id, router]);

  const chatUnlocked = !!job?.accepted_mechanic_id && job?.status !== "canceled";

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
    job.status === "completed"
      ? "🏁 Job completed — great work!"
      : job.status === "work_in_progress"
      ? "🛠️ In progress — update status when done."
      : job.status === "accepted"
      ? "✅ Ready to start — begin when you arrive."
      : job.status === "canceled"
      ? "❌ This job was canceled."
      : "📋 Job assigned to you.";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          gap: spacing.md,
        }}
      >
        <View
          style={{
            paddingTop: insets.top,
            paddingBottom: 8,
            backgroundColor: colors.bg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(mechanic)/(tabs)/jobs" as any))}
              hitSlop={12}
              style={({ pressed }) => [{ paddingVertical: 8, paddingRight: 10 }, pressed && { opacity: 0.6 }]}
            >
              <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 18 }}>
                Back
              </Text>
            </Pressable>
          </View>
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
        </View>

        {chatUnlocked && (
          <Pressable
            onPress={openChat}
            style={({ pressed }) => [
              card,
              {
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.accent,
                borderColor: colors.accent,
              },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chatbubbles" size={22} color="#fff" />
              </View>
              <View>
                <Text style={{ fontWeight: "900", color: "#fff", fontSize: 16 }}>Chat with Customer</Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>
                  Message your customer
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </Pressable>
        )}

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

            const canMoveText = normalizeCanMove(context.can_move);
            const locationText = normalizeLocation(context.location_type);

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
                    {intake.vehicle?.nickname ? (
                      <Text style={{ ...text.muted, fontSize: 13, marginTop: 2 }}>
                        "{intake.vehicle.nickname}"
                      </Text>
                    ) : null}
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

                    {context.mileage ? (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ ...text.muted, fontSize: 13 }}>Mileage</Text>
                        <Text style={{ ...text.body, fontWeight: "900" }}>{context.mileage}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {job.preferred_time ? (
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
                ) : null}
              </View>
            );
          })()}
        </SectionCard>

        {job.status === "canceled" && (
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
                ❌ {job.canceled_by === "customer" ? "CANCELED BY CUSTOMER" : "JOB CANCELED"}
              </Text>
            </View>

            <Text style={text.body}>
              Canceled on: <Text style={{ fontWeight: "900" }}>{fmtDT(job.canceled_at || "")}</Text>
            </Text>

            {quoteRequest?.cancel_reason && (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ ...text.muted, fontSize: 13 }}>Reason</Text>
                <Text style={{ ...text.body, marginTop: 2 }}>
                  {quoteRequest.cancel_reason.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </Text>
              </View>
            )}

            {quoteRequest?.cancel_note && (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ ...text.muted, fontSize: 13 }}>Customer Note</Text>
                <Text style={{ ...text.body, marginTop: 2 }}>{quoteRequest.cancel_note}</Text>
              </View>
            )}

            {quoteRequest?.cancellation_fee_cents && quoteRequest.cancellation_fee_cents > 0 && (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ ...text.muted, fontSize: 13 }}>Cancellation Fee</Text>
                <Text style={{ ...text.title, fontSize: 20, color: "#10b981", marginTop: 2 }}>
                  ${(quoteRequest.cancellation_fee_cents / 100).toFixed(2)}
                </Text>
                <Text style={{ ...text.muted, fontSize: 12, marginTop: 4 }}>
                  This fee compensates for your time
                </Text>
              </View>
            )}
          </SectionCard>
        )}

        {contract && (
          <SectionCard title="Job Progress" icon="trending-up-outline">
            <JobProgressTracker
              progress={progress}
              status={job.status}
              role="mechanic"
            />
          </SectionCard>
        )}

        {contract && job.status !== "completed" && job.status !== "canceled" && (
          <SectionCard title="Actions" icon="hand-left-outline">
            <JobActions
              jobId={id}
              progress={progress}
              contract={contract}
              role="mechanic"
              onRefresh={load}
              hasPendingItems={(invoice?.pending_items.length ?? 0) > 0}
            />
          </SectionCard>
        )}

        {!contract && job.status === "accepted" && (
          <SectionCard title="Status" icon="hourglass-outline">
            <View
              style={{
                backgroundColor: `${colors.accent}15`,
                borderWidth: 1,
                borderColor: `${colors.accent}40`,
                borderRadius: 12,
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Ionicons name="time" size={24} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...text.body, fontWeight: "900", color: colors.accent }}>
                  Waiting for Payment
                </Text>
                <Text style={{ ...text.muted, fontSize: 13, marginTop: 4 }}>
                  The customer is completing payment. You'll be notified when you can start.
                </Text>
              </View>
            </View>
          </SectionCard>
        )}

        {contract && progress?.work_started_at && !progress?.finalized_at && job.status !== "canceled" && (
          <Pressable
            onPress={() => setShowAddLineItem(true)}
            style={({ pressed }) => [
              card,
              {
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                backgroundColor: colors.accent,
                borderColor: colors.accent,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={{ fontWeight: "900", color: "#fff", fontSize: 16 }}>Add Work / Parts</Text>
          </Pressable>
        )}

        {invoice && (
          <SectionCard title="Invoice" icon="receipt-outline">
            <InvoiceView
              invoice={invoice}
              role="mechanic"
              onRefresh={load}
              showPendingActions={false}
            />
          </SectionCard>
        )}

        <SectionCard title="Customer" icon="person-outline">
          <UserProfileCard
            userId={job.customer_id}
            variant="mini"
            onPressViewProfile={() => setSelectedCustomerId(job.customer_id)}
          />
        </SectionCard>
      </ScrollView>

      <AddLineItemForm
        jobId={id}
        visible={showAddLineItem}
        onClose={() => setShowAddLineItem(false)}
        onSuccess={load}
      />

      {selectedCustomerId ? (
        <ProfileCardModal
          visible={!!selectedCustomerId}
          userId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          title="Customer Profile"
          showReviewsButton={false}
        />
      ) : null}
    </View>
  );
}
