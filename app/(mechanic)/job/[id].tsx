import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { notifyUser } from "../../../src/lib/notify";
import { createCard, cardPressed } from "../../../src/ui/styles";
import { useTheme } from "../../../src/ui/theme-context";
import React from "react";


type Job = {
  id: string;
  title: string;
  description: string | null;
  preferred_time: string | null;
  status: string;
  created_at: string;
  accepted_mechanic_id: string | null;
  customer_id: string;
  customer: { full_name: string | null; phone: string | null } | null;
};



export default function MechanicJobDetails() {
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const statusMeta = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "accepted")
      return { c: colors.accent, label: "ASSIGNED", hint: "Ready when you are." };
    if (s === "work_in_progress")
      return { c: colors.accent, label: "IN PROGRESS", hint: "Customer will see updates." };
    if (s === "completed")
      return { c: colors.accent, label: "COMPLETED", hint: "Nice work. Wrap up details." };
    if (s === "searching")
      return { c: colors.textMuted, label: "SEARCHING", hint: "Waiting on customer." };
    return { c: colors.textMuted, label: (status || "unknown").toUpperCase(), hint: "Status updated." };
  };

  const StatusPill = ({ status }: { status: string }) => {
    const { c, label } = statusMeta(status);
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
        <Text style={{ fontSize: 12, fontWeight: "900", color: c }}>{label}</Text>
      </View>
    );
  };

  const Card = ({
    title,
    icon,
    children,
  }: {
    title: string;
    icon?: string;
    children: any;
  }) => (
    <View
      style={[
        card,
        {
          borderRadius: 18,
          padding: spacing.lg,
          gap: spacing.sm,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {icon ? (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.bg,
            }}
          >
            <Text style={{ fontSize: 16 }}>{icon}</Text>
          </View>
        ) : null}
        <Text style={text.section}>{title}</Text>
      </View>
      {children}
    </View>
  );

  const Divider = () => (
    <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.8 }} />
  );
  const router = useRouter();

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return "";
    }
  };
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

      if (!mechanicId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data, error } = await supabase
        .from("jobs")
        .select(
          `
          id,title,description,preferred_time,status,created_at,accepted_mechanic_id,customer_id,
          customer:profiles!jobs_customer_id_fkey(full_name, phone)
        `
        )
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
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const openChat = useCallback(() => {
    if (!job?.id) return;
    router.push(`/(mechanic)/messages/${job.id}` as any);
  }, [job?.id, router]);

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

      if (error) throw error;

      await notifyUser({
        userId: job.customer_id,
        title: nextStatus === "work_in_progress" ? "Job started 🔧" : "Job completed ✅",
        body:
          nextStatus === "work_in_progress"
            ? "Your mechanic started the job."
            : "Your mechanic marked the job as completed.",
        type: nextStatus === "work_in_progress" ? "job_started" : "job_completed",
        entityType: "job",
        entityId: job.id,
      });

      setJob((prev) => (prev ? { ...prev, status: (updated as any).status } : prev));
    } catch (e: any) {
      Alert.alert("Update error", e?.message ?? "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const canStart = useMemo(() => (job?.status || "").toLowerCase() === "accepted", [job?.status]);
  const canComplete = useMemo(
    () => (job?.status || "").toLowerCase() === "work_in_progress",
    [job?.status]
  );
  const chatUnlocked = !!job?.accepted_mechanic_id;

  const { c: statusC, hint } = statusMeta(job?.status ?? "");

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <ActivityIndicator color={colors.accent} />
        <Text style={{ ...text.muted }}>Loading job…</Text>
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
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          gap: spacing.md,
          paddingBottom: 80,
        }}
      >
        <View
          style={{
            padding: spacing.lg,
            borderRadius: 22,
            backgroundColor: colors.surface,
            overflow: "hidden",
          }}
        >
            {/* subtle “pop” stripe */}
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 6,
                backgroundColor: statusC,
                opacity: 0.9,
              }}
            />
            <Text style={[text.title, { marginLeft: 6 }]}>{job.title}</Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, marginLeft: 6 }}>
              <StatusPill status={job.status} />
              <Text style={{ ...text.muted }}>{hint}</Text>
            </View>

            <Text style={{ ...text.muted, marginTop: 10, marginLeft: 6 }}>
              Created {fmt(job.created_at)}
            </Text>
          </View>

        <Card title="Customer" icon="👤">
          <Text style={text.body}>
            Name:{" "}
            <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>
              {job.customer?.full_name ?? "Customer"}
            </Text>
          </Text>
          {job.customer?.phone ? (
            <Text style={text.body}>
              Phone: <Text style={{ fontWeight: "700" }}>{job.customer.phone}</Text>
            </Text>
          ) : (
            <Text style={text.muted}>No phone on file.</Text>
          )}
        </Card>

        <Card title="Job details" icon="🧾">
          {job.preferred_time ? (
            <View style={{ gap: 6 }}>
              <Text style={text.muted}>Preferred time</Text>
              <Text style={{ ...text.body, fontWeight: "800" }}>{job.preferred_time}</Text>
              <Divider />
            </View>
          ) : null}

          <Text style={text.muted}>Description</Text>
          {job.description ? (
            <Text style={{ ...text.body, opacity: 0.95, lineHeight: 20 }}>{job.description}</Text>
          ) : (
            <Text style={text.muted}>No description provided.</Text>
          )}
        </Card>
      


        <View
          style={[
            card,
            {
              borderRadius: 22,
              padding: spacing.lg,
              backgroundColor: colors.surface,
              gap: spacing.sm,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ ...text.section, flex: 1 }}>Actions</Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: statusC + "1f",
                borderWidth: 1,
                borderColor: statusC + "55",
              }}
            >
              <Text style={{ fontWeight: "900", color: statusC, fontSize: 12 }}>
                {(job.status || "unknown").toUpperCase()}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={openChat}
            disabled={!chatUnlocked}
            style={({ pressed }) => [
              {
                backgroundColor: colors.accent,
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: "center",
                opacity: chatUnlocked ? (pressed ? 0.85 : 1) : 0.55,
              },
            ]}
          >
            <Text style={{ fontWeight: "900", color: "#fff" }}>
              {chatUnlocked ? "Open Chat 💬" : "Chat Locked"}
            </Text>
          </Pressable>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => updateStatus("work_in_progress")}
              disabled={!canStart || saving}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: colors.accent,
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: "center",
                  opacity: !canStart || saving ? 0.55 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ fontWeight: "900", color: "#000" }}>
                {saving && canStart ? "UPDATING…" : canStart ? "START JOB 🔧" : "START JOB"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => updateStatus("completed")}
              disabled={!canComplete || saving}
              style={({ pressed }) => [
                {
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: "center",
                  opacity: !canComplete || saving ? 0.55 : pressed ? 0.9 : 1,
                },
              ]}
            >
              <Text style={{ fontWeight: "900", color: colors.textPrimary }}>
                {saving && canComplete ? "UPDATING…" : canComplete ? "COMPLETE ✅" : "COMPLETE"}
              </Text>
            </Pressable>
          </View>

          <Text style={{ ...text.muted, marginTop: 2 }}>
            Tip: Starting + completing sends a notification to the customer.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
