import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { colors, spacing, text } from "../../../src/ui/theme";
import { card } from "../../../src/ui/styles";

type Msg = {
  id: string;
  job_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function JobChat() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Msg[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      setMe(userData.user?.id ?? null);

      if (!jobId) return;

      // RLS will enforce "only after accepted + only customer/accepted mechanic"
      const { data, error } = await supabase
        .from("messages")
        .select("id,job_id,sender_id,body,created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setItems((data as Msg[]) ?? []);
    } catch (e: any) {
      Alert.alert("Chat error", e?.message ?? "Failed to load chat.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime updates for this job's messages
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel("job-chat-" + jobId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `job_id=eq.${jobId}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, load]);

  const send = useCallback(async () => {
    if (!jobId || !me) return;
    const body = input.trim();
    if (!body) return;

    try {
      setSending(true);

      const { error } = await supabase.from("messages").insert({
        job_id: jobId,
        sender_id: me,
        body,
      });

      if (error) throw error;

      setInput("");
      // load() will be triggered by realtime INSERT too, but this keeps it snappy
      await load();
    } catch (e: any) {
      // If RLS blocks it, you’ll see a permission error here (expected if quote not accepted)
      Alert.alert("Send failed", e?.message ?? "You can’t chat until a quote is accepted.");
    } finally {
      setSending(false);
    }
  }, [jobId, me, input, load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <View style={{ padding: spacing.md, paddingTop: spacing.lg }}>
<Pressable
  onPress={() => (router.canGoBack() ? router.back() : router.replace("/(customer)/(tabs)/inbox"))}
  hitSlop={12}
  style={{ paddingVertical: 8, zIndex: 10 }}
>
  <Text style={{ color: colors.accent, fontWeight: "900" }}>← Back</Text>
</Pressable>



        <Text style={[text.title, { marginTop: spacing.sm }]}>Chat</Text>
        <Text style={{ ...text.muted, marginTop: 4 }}>
          Messaging unlocks after a quote is accepted.
        </Text>
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        data={items}
        keyExtractor={(m) => m.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => {
          const mine = item.sender_id === me;
          return (
            <View
              style={[
                card,
                {
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: spacing.md,
                  backgroundColor: mine ? "rgba(20,184,166,0.10)" : colors.surface,
                  borderColor: mine ? "rgba(20,184,166,0.35)" : colors.border,
                },
              ]}
            >
              <Text style={{ ...text.body, color: colors.text }}>{item.body}</Text>
              <Text style={{ ...text.muted, marginTop: 6 }}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[card, { padding: spacing.md }]}>
            <Text style={text.section}>No messages yet</Text>
            <Text style={{ ...text.muted, marginTop: 6 }}>
              Say hi to get started (only works after quote is accepted).
            </Text>
          </View>
        }
      />

      {/* Composer */}
      <View style={{ padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message…"
            placeholderTextColor={colors.Muted}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.text,
              backgroundColor: colors.bg,
            }}
          />
          <Pressable
            onPress={send}
            disabled={!canSend}
            style={{
              backgroundColor: colors.accent,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 14,
              opacity: canSend ? 1 : 0.6,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>{sending ? "…" : "Send"}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
