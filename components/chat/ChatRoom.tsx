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
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";

type Msg = {
  id: string;
  job_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

type ChatRoomProps = {
  jobId: string;
  role: "customer" | "mechanic";
  headerTitle?: string;
  headerSubtitle?: string;
  backRoute?: string;
};

const fmtTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};

const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const getInitials = (name: string | null) => {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

export function ChatRoom({ jobId, role, headerTitle = "Chat", headerSubtitle, backRoute }: ChatRoomProps) {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Msg[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [otherPartyName, setOtherPartyName] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const listRef = useRef<FlatList<Msg>>(null);
  const canSend = useMemo(
    () => input.trim().length > 0 && !sending && !!me && !!jobId && !!recipientId,
    [input, sending, me, jobId, recipientId]
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

      const { data: jobData } = await supabase
        .from("jobs")
        .select("customer_id, accepted_mechanic_id")
        .eq("id", jobId)
        .single();

      if (jobData && uid) {
        const recipientIdVal = role === "customer" ? jobData.accepted_mechanic_id : jobData.customer_id;
        setRecipientId(recipientIdVal);

        if (recipientIdVal) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", recipientIdVal)
            .single();
          setOtherPartyName(profile?.full_name || null);
        }
      }

      const { data, error } = await supabase
        .from("messages")
        .select("id,job_id,sender_id,recipient_id,body,created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setItems((data as Msg[]) ?? []);
    } catch (e: any) {
      Alert.alert("Chat error", e?.message ?? "Failed to load chat.");
    } finally {
      setLoading(false);
    }
  }, [jobId, role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel("chat-" + jobId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `job_id=eq.${jobId}` },
        (payload: { new: Msg }) => {
          const m = payload.new as Msg;
          setItems((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  useEffect(() => {
    if (items.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [items.length]);

  const send = useCallback(async () => {
    if (!jobId || !me || !recipientId) return;

    const content = input.trim();
    if (!content) return;

    setSending(true);
    setInput("");

    const tempId = `temp-${Date.now()}`;
    const temp: Msg = {
      id: tempId,
      job_id: jobId,
      sender_id: me,
      recipient_id: recipientId,
      body: content,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, temp]);

    const { error } = await supabase.from("messages").insert({
      job_id: jobId,
      sender_id: me,
      recipient_id: recipientId,
      body: content,
    });

    if (error) {
      setItems((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
      Alert.alert("Send failed", error.message ?? "Failed to send message.");
    }

    setSending(false);
  }, [jobId, me, recipientId, input]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (backRoute) {
      router.replace(backRoute as any);
    } else {
      router.replace(role === "customer" ? "/(customer)/(tabs)/inbox" : "/(mechanic)/(tabs)/inbox" as any);
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Msg[] }[] = [];
    let currentDate = "";

    items.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.created_at, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  }, [items]);

  const initials = getInitials(otherPartyName);
  const avatarColors = role === "customer" ? "#14b8a6" : "#3b82f6";

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[text.muted, { marginTop: 12 }]}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>

        <View style={[styles.headerAvatar, { backgroundColor: avatarColors }]}>
          <Text style={styles.headerAvatarText}>{initials}</Text>
        </View>

        <View style={styles.headerInfo}>
          <Text style={[text.body, { fontWeight: "700", fontSize: 17 }]} numberOfLines={1}>
            {otherPartyName || (role === "customer" ? "Mechanic" : "Customer")}
          </Text>
          <View style={styles.onlineStatus}>
            <View style={styles.onlineDot} />
            <Text style={[text.muted, { fontSize: 13 }]}>Online</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        contentContainerStyle={styles.messageList}
        data={groupedMessages}
        keyExtractor={(item) => item.date}
        renderItem={({ item: group }) => (
          <View>
            <View style={styles.dateSeparator}>
              <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dateText, { color: colors.textMuted, backgroundColor: colors.bg }]}>
                {fmtDate(group.date)}
              </Text>
              <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            </View>

            {group.messages.map((msg, idx) => {
              const mine = msg.sender_id === me;
              const isFirst = idx === 0 || group.messages[idx - 1].sender_id !== msg.sender_id;
              const isLast = idx === group.messages.length - 1 || group.messages[idx + 1].sender_id !== msg.sender_id;

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.bubbleContainer,
                    { alignSelf: mine ? "flex-end" : "flex-start" },
                    !isLast && { marginBottom: 2 },
                  ]}
                >
                  {mine ? (
                    <LinearGradient
                      colors={[colors.accent, colors.accent + "dd"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.bubble,
                        styles.bubbleMine,
                        isFirst && styles.bubbleFirstMine,
                        isLast && styles.bubbleLastMine,
                      ]}
                    >
                      <Text style={styles.bubbleTextMine}>{msg.body}</Text>
                      {isLast && (
                        <View style={styles.bubbleMeta}>
                          <Text style={styles.bubbleTimeMine}>{fmtTime(msg.created_at)}</Text>
                          <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" />
                        </View>
                      )}
                    </LinearGradient>
                  ) : (
                    <View
                      style={[
                        styles.bubble,
                        styles.bubbleTheirs,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        isFirst && styles.bubbleFirstTheirs,
                        isLast && styles.bubbleLastTheirs,
                      ]}
                    >
                      <Text style={[styles.bubbleText, { color: colors.textPrimary }]}>{msg.body}</Text>
                      {isLast && (
                        <Text style={[styles.bubbleTime, { color: colors.textMuted }]}>
                          {fmtTime(msg.created_at)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accent + "15" }]}>
              <Ionicons name="chatbubble-outline" size={32} color={colors.accent} />
            </View>
            <Text style={[text.body, { fontWeight: "600", marginTop: 12 }]}>Start the conversation</Text>
            <Text style={[text.muted, { textAlign: "center", marginTop: 4 }]}>
              Send a message to get started
            </Text>
          </View>
        }
      />

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: colors.bg, borderColor: focused ? colors.accent : colors.border },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary }]}
            multiline
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </View>

        <Pressable
          onPress={send}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: colors.accent, opacity: !canSend ? 0.4 : pressed ? 0.8 : 1 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Ionicons name="arrow-up" size={22} color="#000" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  headerAvatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  onlineStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  messageList: {
    padding: 16,
    paddingBottom: 20,
  },
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
  },
  dateText: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 12,
  },
  bubbleContainer: {
    maxWidth: "80%",
    marginBottom: 8,
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  bubbleMine: {
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  bubbleFirstMine: {
    borderTopRightRadius: 20,
  },
  bubbleLastMine: {
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    borderWidth: 1,
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  bubbleFirstTheirs: {
    borderTopLeftRadius: 20,
  },
  bubbleLastTheirs: {
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: "#000",
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
  },
  bubbleTimeMine: {
    fontSize: 11,
    color: "rgba(0,0,0,0.6)",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 48,
    justifyContent: "center",
  },
  input: {
    fontSize: 16,
    maxHeight: 100,
    minHeight: 24,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});