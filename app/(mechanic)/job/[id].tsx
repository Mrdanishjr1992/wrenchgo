import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Alert, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";
import { notifyUser } from "../../../src/lib/notify";

type Job = {
  id: string;
  title: string;
  description: string | null;
  preferred_time: string | null;
  status: string;
  created_at: string;
  accepted_mechanic_id: string | null;
  customer: { full_name: string | null; phone: string | null } | null;
};

const statusColor = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "accepted") return colors.accent;
  if (s === "work_in_progress") return colors.brand;
  if (s === "completed") return colors.success;
  if (s === "searching") return colors.textMuted;
  return colors.textSecondary;
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
        backgroundColor: c + "22",
        borderWidth: 1,
        borderColor: c + "55",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "900", color: c }}>
        {(status || "unknown").toUpperCase()}
      </Text>
    </View>
  );
};

const Card = ({ title, children }: { title: string; children: any }) => (
  <View
    style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    }}
  >
    <Text style={{ ...text.section }}>{title}</Text>
    {children}
  </View>
);

export default function MechanicJobDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const mechanicId = userData.user?.id;
      if (!mechanicId) return;

      // ✅ Ensure mechanic only sees jobs assigned to them
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          id,title,description,preferred_time,status,created_at,accepted_mechanic_id,customer_id,
          customer:profiles!jobs_customer_id_fkey(full_name, phone)
        `)
        .eq("id", id)
        .eq("accepted_mechanic_id", mechanicId)
        .single();

      if (error) throw error;
      setJob(data as any as Job);
    } catch (e: any) {
      Alert.alert("Job error", e?.message ?? "Failed to load job.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (nextStatus: "work_in_progress" | "completed") => {
    if (!job) return;
    try {
      setSaving(true);
      const { data: updated, error } = await supabase
        .from("jobs")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .select("id,status")
        .single();
        // after successful status update:
        await notifyUser({
          userId: (job as any).customer_id,
          title: nextStatus === "work_in_progress" ? "Job started" : "Job completed",
          body: nextStatus === "work_in_progress"
            ? "Your mechanic started the job."
            : "Your mechanic marked the job as completed.",
          type: nextStatus === "work_in_progress" ? "job_started" : "job_completed",
          entityType: "job",
          entityId: job.id,
        });

      if (error) throw error;

      setJob((prev) => (prev ? { ...prev, status: (updated as any).status } : prev));
    } catch (e: any) {
      Alert.alert("Update error", e?.message ?? "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const canStart = useMemo(() => job?.status === "accepted", [job?.status]);
  const canComplete = useMemo(() => job?.status === "work_in_progress", [job?.status]);

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 140 }}>
        {/* Header */}
        <View style={{ gap: 10 }}>
          <Pressable  onPress={() => (router.canGoBack() ? router.back() : router.replace("/(mechanic)/(tabs)/jobs"))}
          style={{ alignSelf: "flex-start" }}>
          <Text style={{ color: colors.accent, fontWeight: "900" }}>← Back</Text>
          </Pressable>

          <Text style={text.title}>{job.title}</Text>
          <StatusPill status={job.status} />

          <Text style={text.muted}>Created {new Date(job.created_at).toLocaleString()}</Text>
        </View>

        {/* Customer */}
        <Card title="Customer">
          <Text style={text.body}>
            Name: <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{job.customer?.full_name ?? "Customer"}</Text>
          </Text>
          {job.customer?.phone ? <Text style={text.body}>Phone: {job.customer.phone}</Text> : null}
        </Card>

        {/* Details */}
        <Card title="Job Details">
          {job.preferred_time ? <Text style={text.body}>Preferred: {job.preferred_time}</Text> : null}
          {job.description ? (
            <Text style={{ ...text.body, opacity: 0.95 }}>{job.description}</Text>
          ) : (
            <Text style={text.muted}>No description provided.</Text>
          )}
        </Card>
      </ScrollView>

      {/* Sticky Actions */}
      <View
        style={{
          position: "absolute",
          left: spacing.md,
          right: spacing.md,
          bottom: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        <Text style={text.muted}>Actions</Text>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => updateStatus("work_in_progress")}
            disabled={!canStart || saving}
            style={{
              flex: 1,
              backgroundColor: colors.accent,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              opacity: !canStart || saving ? 0.55 : 1,
            }}
          >
            <Text style={{ fontWeight: "900", color: "#000" }}>
              {saving && canStart ? "UPDATING…" : "START JOB"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => updateStatus("completed")}
            disabled={!canComplete || saving}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
              opacity: !canComplete || saving ? 0.55 : 1,
            }}
          >
            <Text style={{ fontWeight: "900", color: colors.textPrimary }}>
              {saving && canComplete ? "UPDATING…" : "COMPLETE"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
