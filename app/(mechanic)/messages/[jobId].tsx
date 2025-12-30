import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { createCard } from "../../../src/ui/styles";
import { useTheme } from "../../../src/ui/theme-context";


type Msg = {
  id: string;
  job_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const fmtTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
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
  const [focused, setFocused] = useState(false);

  const listRef = useRef<FlatList<Msg>>(null);
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);
  const canSend = useMemo(
    () => input.trim().length > 0 && !sending && !!me && !!jobId,
    [input, sending, me, jobId]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const uid = userData.user?.id ?? null;
      setMe(uid);

      if (!jobId) {
        setItems([]);
        return;
      }

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

  // realtime: append only
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel("job-chat-" + jobId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `job_id=eq.${jobId}` },
        (payload: { new: Msg; }) => {
          const m = payload.new as Msg;
          setItems((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  // auto-scroll to latest
  useEffect(() => {
    if (items.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [items.length]);

  const send = useCallback(async () => {
    if (!jobId || !me) return;

    const body = input.trim();
    if (!body) return;

    setSending(true);
    setInput("");

    const tempId = `temp-${Date.now()}`;
    const temp: Msg = {
      id: tempId,
      job_id: jobId,
      sender_id: me,
      body,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, temp]);

    const { error } = await supabase.from("messages").insert({
      job_id: jobId,
      sender_id: me,
      body,
    });

    if (error) {
      setItems((prev) => prev.filter((m) => m.id !== tempId));
      setInput(body);
      Alert.alert("Send failed", error.message ?? "You can’t chat until a quote is accepted.");
    }

    setSending(false);
  }, [jobId, me, input]);

  const Bubble = ({ item }: { item: Msg }) => {
    const mine = item.sender_id === me;

    return (
      <View
        style={{
          alignSelf: mine ? "flex-end" : "flex-start",
          maxWidth: "86%",
          marginVertical: 4,
          backgroundColor: mine ? colors.accent + "1A" : colors.surface,
          
        }}
      >
        <View
          style={[
            card,
            {
              paddingVertical: 12,
              paddingHorizontal: 12,
              backgroundColor: colors.surface,
              borderColor: mine ? colors.accent + "55" : colors.border,
              borderRadius: 18,
            },
          ]}
        >
          <Text style={{ ...text.body, color: colors.textPrimary, lineHeight: 20 }}>{item.body}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
            <Ionicons name={mine ? "checkmark-done" : "time-outline"} size={14} color={colors.textMuted} />
            <Text style={{ ...text.muted, fontSize: 12 }}>{fmtTime(item.created_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ marginTop: 10, ...text.muted }}>Opening chat…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <LinearGradient
        colors={["#14b8a6", "#0d9488"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: spacing.md,
          paddingTop: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.2)",
        }}
      >
        <View style={{ position: "absolute", top: 20, right: 30, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.1)" }} />
        <View style={{ position: "absolute", top: 60, left: 40, width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.08)" }} />

        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(mechanic)/(tabs)/jobs"))}
          hitSlop={12}
          style={{ paddingTop: 20, flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Ionicons name="chevron-back" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "900" }}>Back</Text>
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...text.title, color: "#fff" }}>Chat</Text>
            <Text style={{ ...text.muted, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>Fast updates with your customer.</Text>
          </View>

          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.2)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.89)",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: "#fff" }} />
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>Live</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Messages */}
      <FlatList
        ref={listRef}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        data={items}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Bubble item={item} />}
        ListEmptyComponent={
          <View style={[card, {  padding: spacing.lg, marginTop: spacing.md, alignItems: "center", gap: 8 }]}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                backgroundColor: colors.accent + "12",
                borderWidth: 1,
                borderColor: colors.accent + "33",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.accent} />
            </View>
            <Text style={text.section}>No messages yet</Text>
            <Text style={{ ...text.muted, textAlign: "center" }}>
              Send a quick “Hi” to get the conversation started.
            </Text>
          </View>
        }
      />

      {/* Composer */}
      <View
        style={{
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: focused ? colors.accent : colors.border,
              borderRadius: 18,
              backgroundColor: colors.bg,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message…"
              placeholderTextColor={colors.textMuted}
              style={{
                color: colors.textPrimary,
                minHeight: 22,
              }}
              multiline
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              returnKeyType="send"
              onSubmitEditing={() => {
                // keep: RN on iOS can fire submit on multiline; only send if short
                if (Platform.OS === "android") send();
              }}
            />
          </View>

          <Pressable
            onPress={send}
            disabled={!canSend}
            style={({ pressed }) => ({
              backgroundColor: colors.accent,
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              opacity: !canSend ? 0.55 : pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
