import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
} from "react-native";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";
import { notifyUser } from "../../../src/lib/notify"; // ✅ adjust if your path differs

type Lead = {
  id: string;
  status: "pending" | "quoted" | "accepted" | "rejected";
  created_at: string;
  proposed_price_cents: number | null;
  proposed_time_text: string | null;
  note: string | null;
  job: {
    id: string;
    title: string;
    description: string | null;
    preferred_time: string | null;
    status: string;
    customer_id: string; // ✅ needed for notifications
    customer: { full_name: string | null } | null;
  } | null;
};

const pillColor = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "pending") return colors.textSecondary;
  if (s === "quoted") return colors.brand;
  if (s === "accepted") return colors.accent;
  if (s === "rejected") return colors.textMuted;
  return colors.textSecondary;
};

const Pill = ({ label }: { label: string }) => {
  const c = pillColor(label);
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: c + "22",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "800", color: c }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
};

export default function Leads() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  // inputs per lead
  const [priceMap, setPriceMap] = useState<Record<string, string>>({});
  const [timeMap, setTimeMap] = useState<Record<string, string>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  const [showQuoted, setShowQuoted] = useState(false);

  const visibleLeads = useMemo(() => {
    return showQuoted
      ? leads.filter((l) => l.status === "pending" || l.status === "quoted")
      : leads.filter((l) => l.status === "pending");
  }, [leads, showQuoted]);

  const load = async () => {
    try {
      setLoading(true);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const mechanicId = userData.user?.id;
      if (!mechanicId) return;

      const { data, error } = await supabase
        .from("quote_requests")
        .select(`
          id,status,created_at,proposed_price_cents,proposed_time_text,note,
          job:jobs(
            id,title,description,preferred_time,status,customer_id,
            customer:profiles!jobs_customer_id_fkey(full_name)
          )
        `)
        .eq("mechanic_id", mechanicId)
        .in("status", ["pending", "quoted"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const list = ((data as any) ?? []) as Lead[];
      setLeads(list);

      // seed inputs
      const p: Record<string, string> = {};
      const t: Record<string, string> = {};
      const n: Record<string, string> = {};
      for (const l of list) {
        p[l.id] =
          l.proposed_price_cents != null
            ? (l.proposed_price_cents / 100).toFixed(2)
            : "";
        t[l.id] = l.proposed_time_text ?? "";
        n[l.id] = l.note ?? "";
      }
      setPriceMap(p);
      setTimeMap(t);
      setNoteMap(n);
    } catch (e: any) {
      Alert.alert("Leads error", e?.message ?? "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sendQuote = async (lead: Lead) => {
    try {
      setSavingId(lead.id);

      const priceStr = (priceMap[lead.id] ?? "").trim();
      const timeStr = (timeMap[lead.id] ?? "").trim();
      const noteStr = (noteMap[lead.id] ?? "").trim();

      if (!priceStr) {
        Alert.alert("Missing price", "Enter a price (example: 120.00).");
        return;
      }

      const price = Number(priceStr);
      if (!Number.isFinite(price) || price <= 0) {
        Alert.alert("Invalid price", "Enter a valid number like 120.00");
        return;
      }

      // ✅ 1) update quote request
      const { error } = await supabase
        .from("quote_requests")
        .update({
          status: "quoted",
          proposed_price_cents: Math.round(price * 100),
          proposed_time_text: timeStr || null,
          note: noteStr || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", lead.id);

      if (error) throw error;

      // ✅ 2) notify customer (AFTER update succeeds)
      const customerId = lead.job?.customer_id;
      if (customerId) {
        await notifyUser({
          userId: customerId,
          title: "New quote received",
          body: `A mechanic quoted your job: ${lead.job?.title ?? "Job"}`,
          type: "quote_sent",
          entityType: "job",
          entityId: lead.job?.id ?? null,
        });
      }

      // ✅ 3) reload -> removes from Pending automatically
      await load();
    } catch (e: any) {
      Alert.alert("Send quote error", e?.message ?? "Failed to send quote.");
    } finally {
      setSavingId(null);
    }
  };

  const decline = async (leadId: string) => {
    try {
      setSavingId(leadId);

      const { error } = await supabase
        .from("quote_requests")
        .update({ status: "rejected", updated_at: new Date().toISOString() } as any)
        .eq("id", leadId);

      if (error) throw error;

      await load();
    } catch (e: any) {
      Alert.alert("Decline error", e?.message ?? "Failed to decline.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.md }}>
      {/* Header */}
      <View style={{ gap: 6 }}>
        <Text style={text.title}>Leads</Text>
        <Text style={text.muted}>
          {showQuoted ? "Pending + Quoted" : "Pending only"} • Action-focused
        </Text>

        <Pressable
          onPress={() => setShowQuoted((v) => !v)}
          style={{
            marginTop: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "800", color: colors.textPrimary }}>
            {showQuoted ? "HIDE QUOTED" : "SHOW QUOTED (READ‑ONLY)"}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ marginTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ marginTop: 10, ...text.muted }}>Loading…</Text>
        </View>
      ) : visibleLeads.length === 0 ? (
        <View style={{ marginTop: 18 }}>
          <Text style={text.section}>No leads</Text>
          <Text style={{ marginTop: 6, ...text.body }}>
            {showQuoted ? "No pending/quoted leads right now." : "No pending leads right now."}
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ marginTop: spacing.lg }}
          data={visibleLeads}
          keyExtractor={(l) => l.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => {
            const busy = savingId === item.id;
            const isPending = item.status === "pending";
            const isQuoted = item.status === "quoted";

            const customerName = item.job?.customer?.full_name ?? "Customer";
            const jobTitle = item.job?.title ?? "Job";
            const desc = item.job?.description ?? null;

            return (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: spacing.sm,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={text.section}>{jobTitle}</Text>
                  <Pill label={item.status} />
                </View>

                <Text style={text.body}>From: {customerName}</Text>
                {item.job?.preferred_time ? (
                  <Text style={text.muted}>Preferred: {item.job.preferred_time}</Text>
                ) : null}
                {desc ? <Text style={{ ...text.body, opacity: 0.9 }}>{desc}</Text> : null}

                {/* QUOTED = read-only */}
                {isQuoted ? (
                  <View style={{ gap: 6, marginTop: spacing.sm }}>
                    <Text style={{ ...text.section, fontSize: 14 }}>Quote sent</Text>
                    <Text style={text.body}>
                      Price:{" "}
                      <Text style={{ color: colors.accent, fontWeight: "800" }}>
                        {item.proposed_price_cents != null
                          ? `$${(item.proposed_price_cents / 100).toFixed(2)}`
                          : "—"}
                      </Text>
                    </Text>
                    <Text style={text.body}>
                      Time:{" "}
                      <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                        {item.proposed_time_text ?? "—"}
                      </Text>
                    </Text>
                    {item.note ? <Text style={text.muted}>Note: {item.note}</Text> : null}
                    <Text style={text.muted}>Waiting for customer to accept…</Text>
                  </View>
                ) : (
                  <>
                    <Text style={{ ...text.section, fontSize: 14, marginTop: spacing.sm }}>
                      Your quote
                    </Text>

                    <Text style={text.muted}>Price (USD)</Text>
                    <TextInput
                      value={priceMap[item.id] ?? ""}
                      onChangeText={(v) => setPriceMap((p) => ({ ...p, [item.id]: v }))}
                      placeholder="120.00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: 12,
                        color: colors.textPrimary,
                      }}
                    />

                    <Text style={text.muted}>Time / availability</Text>
                    <TextInput
                      value={timeMap[item.id] ?? ""}
                      onChangeText={(v) => setTimeMap((p) => ({ ...p, [item.id]: v }))}
                      placeholder="Today 3pm / Tomorrow morning / ASAP…"
                      placeholderTextColor={colors.textMuted}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: 12,
                        color: colors.textPrimary,
                      }}
                    />

                    <Text style={text.muted}>Note (optional)</Text>
                    <TextInput
                      value={noteMap[item.id] ?? ""}
                      onChangeText={(v) => setNoteMap((p) => ({ ...p, [item.id]: v }))}
                      placeholder="Parts needed, estimate details, etc."
                      placeholderTextColor={colors.textMuted}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: 12,
                        color: colors.textPrimary,
                      }}
                    />

                    <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.sm }}>
                      <Pressable
                        onPress={() => sendQuote(item)}
                        disabled={busy || !isPending}
                        style={{
                          flex: 1,
                          backgroundColor: colors.accent,
                          paddingVertical: 14,
                          borderRadius: 14,
                          alignItems: "center",
                          opacity: busy ? 0.7 : 1,
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: "#000" }}>
                          {busy ? "SAVING…" : "SEND QUOTE"}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => decline(item.id)}
                        disabled={busy || !isPending}
                        style={{
                          flex: 1,
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingVertical: 14,
                          borderRadius: 14,
                          alignItems: "center",
                          opacity: 0.95,
                        }}
                      >
                        <Text style={{ fontWeight: "800", color: colors.textPrimary }}>
                          DECLINE
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
