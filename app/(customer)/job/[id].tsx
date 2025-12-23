import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Alert, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";
import { notifyUser } from "../../../src/lib/notify";

type Quote = {
  id: string;
  job_id: string;
  mechanic_id: string;
  status: "pending" | "quoted" | "accepted" | "rejected";
  proposed_price_cents: number | null;
  proposed_time_text: string | null;
  note: string | null;
  created_at: string;
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
    <Text style={text.section}>{title}</Text>
    {children}
  </View>
);

export default function CustomerJobDetails() {
  const router = useRouter();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [job, setJob] = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const customerId = userData.user?.id;
      if (!customerId) return;

      // ✅ job (must belong to this customer)
      const { data: j, error: jErr } = await supabase
        .from("jobs")
        .select(`
          id,title,description,preferred_time,status,created_at,accepted_mechanic_id,
          accepted_mechanic:profiles!jobs_accepted_mechanic_id_fkey(full_name, phone)
        `)
        .eq("id", jobId)
        .eq("customer_id", customerId)
        .single();

      if (jErr) throw jErr;
      setJob(j as any as Job);

      // ✅ quotes for this job
      const { data: q, error: qErr } = await supabase
        .from("quote_requests")
        .select(`
          id,job_id,mechanic_id,status,proposed_price_cents,proposed_time_text,note,created_at,
          mechanic:profiles!quote_requests_mechanic_id_fkey(full_name, phone)
        `)
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

  // ✅ realtime refresh
  useEffect(() => {
    let channel: any;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const customerId = userData.user?.id;
      if (!customerId) return;

      channel = supabase
        .channel("customer-job-" + jobId)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
          () => load()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "quote_requests", filter: `job_id=eq.${jobId}` },
          () => load()
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [jobId, load]);

  const acceptQuote = async (quoteId: string) => {
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

      if (quote.customer_id !== customerId) {
        Alert.alert("Not allowed", "This quote is not yours.");
        return;
      }
      if (quote.job_id !== jobId) {
        Alert.alert("Mismatch", "This quote is not for this job.");
        return;
      }
      if (quote.status !== "quoted" || quote.proposed_price_cents == null) {
        Alert.alert("Quote not ready", "Wait for the mechanic to send a quote before accepting.");
        return;
      }

      // mark this accepted
      const { data: acceptedQuote, error: qAccErr } = await supabase
        .from("quote_requests")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", quoteId)
        .select("id,mechanic_id,job_id")
        .single();
        // notify mechanic
        await notifyUser({
          userId: acceptedQuote.mechanic_id,
          title: "Quote accepted 🎉",
          body: "Your quote was accepted. The job is now assigned to you.",
          type: "quote_accepted",
          entityType: "job",
          entityId: jobId as any,
        });

      if (qAccErr) throw qAccErr;

      // reject others
      await supabase
        .from("quote_requests")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .neq("id", quoteId);

      // update job
      const { error: jErr } = await supabase
        .from("jobs")
        .update({
          accepted_mechanic_id: acceptedQuote.mechanic_id,
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (jErr) throw jErr;

      Alert.alert("Accepted!", "You accepted a quote.");
      await load();
    } catch (e: any) {
      Alert.alert("Accept error", e?.message ?? "Failed to accept quote.");
    } finally {
      setBusy(false);
    }
  };

  const quotedCount = useMemo(
    () => quotes.filter((q) => q.status === "quoted").length,
    [quotes]
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 140 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(customer)/(tabs)/jobs"))}
        style={{ alignSelf: "flex-start" }}>
          <Text style={{ color: colors.accent, fontWeight: "900" }}>← Back</Text>
        </Pressable>

        <View style={{ gap: 10 }}>
          <Text style={text.title}>{job.title}</Text>
          <StatusPill status={job.status} />
          <Text style={text.muted}>Created {new Date(job.created_at).toLocaleString()}</Text>
        </View>

        <Card title="Job Details">
          {job.preferred_time ? <Text style={text.body}>Preferred: {job.preferred_time}</Text> : null}
          {job.description ? (
            <Text style={{ ...text.body, opacity: 0.95 }}>{job.description}</Text>
          ) : (
            <Text style={text.muted}>No description provided.</Text>
          )}
        </Card>

        {job.accepted_mechanic_id ? (
          <Card title="Assigned Mechanic">
            <Text style={text.body}>
              Name:{" "}
              <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>
                {job.accepted_mechanic?.full_name ?? "Mechanic"}
              </Text>
            </Text>
            {job.accepted_mechanic?.phone ? <Text style={text.body}>Phone: {job.accepted_mechanic.phone}</Text> : null}
            <Text style={text.muted}>This job is assigned. The mechanic will update progress here.</Text>
          </Card>
        ) : (
          <Card title="Quotes">
            <Text style={text.body}>
              Quotes ready:{" "}
              <Text style={{ color: colors.accent, fontWeight: "900" }}>{quotedCount}</Text>
            </Text>
            <Text style={text.muted}>
              Only “QUOTED” entries can be accepted.
            </Text>
          </Card>
        )}

        {/* Quotes List */}
        <View style={{ gap: spacing.md }}>
          {quotes.map((q) => {
            const canAccept = q.status === "quoted" && q.proposed_price_cents != null && !job.accepted_mechanic_id;
            const price =
              q.proposed_price_cents != null ? `$${(q.proposed_price_cents / 100).toFixed(2)}` : "—";

            return (
              <View
                key={q.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={text.section}>{q.mechanic?.full_name ?? "Mechanic"}</Text>
                  <StatusPill status={q.status} />
                </View>

                <Text style={text.body}>
                  Price:{" "}
                  <Text style={{ color: colors.accent, fontWeight: "900" }}>{price}</Text>
                </Text>

                <Text style={text.body}>
                  Time:{" "}
                  <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                    {q.proposed_time_text ?? "—"}
                  </Text>
                </Text>

                {q.note ? <Text style={text.muted}>Note: {q.note}</Text> : null}

                {canAccept ? (
                  <Pressable
                    onPress={() => acceptQuote(q.id)}
                    disabled={busy}
                    style={{
                      marginTop: spacing.sm,
                      backgroundColor: colors.accent,
                      paddingVertical: 14,
                      borderRadius: 14,
                      alignItems: "center",
                      opacity: busy ? 0.65 : 1,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: "#000" }}>
                      {busy ? "ACCEPTING…" : "ACCEPT QUOTE"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
