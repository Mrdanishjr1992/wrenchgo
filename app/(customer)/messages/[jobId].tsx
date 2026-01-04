import React, { useCallback, useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import { AppButton } from "../../../src/ui/components/AppButton";

type Message = {
  id: string;
  job_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
};

export default function JobMessages() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user?.id;

      if (!currentUserId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      setUserId(currentUserId);

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        Alert.alert("Error", "Failed to load messages. Please try again.");
        return;
      }

      setMessages(data || []);
      
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error("Messages load error:", error);
      Alert.alert("Error", error?.message ?? "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }, [jobId, router]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages])
  );

  useEffect(() => {
    if (!jobId || !userId) return;

    const channel = supabase
      .channel(`job-messages-${jobId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `job_id=eq.${jobId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, userId]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !jobId || !userId) return;

    try {
      setSending(true);

      const { data: job } = await supabase
        .from("jobs")
        .select("customer_id, mechanic_id")
        .eq("id", jobId)
        .maybeSingle();

      if (!job) {
        Alert.alert("Error", "Job not found.");
        return;
      }

      const recipientId = job.customer_id === userId ? job.mechanic_id : job.customer_id;

      if (!recipientId) {
        Alert.alert("Error", "No recipient found for this job.");
        return;
      }

      const { error } = await supabase.from("messages").insert({
        job_id: jobId,
        sender_id: userId,
        recipient_id: recipientId,
        content: newMessage.trim(),
      });

      if (error) {
        console.error("Error sending message:", error);
        Alert.alert("Error", "Failed to send message. Please try again.");
        return;
      }

      setNewMessage("");
    } catch (error: any) {
      console.error("Send message error:", error);
      Alert.alert("Error", error?.message ?? "Failed to send message.");
    } finally {
      setSending(false);
    }
  }, [newMessage, jobId, userId]);

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
      keyboardVerticalOffset={100}
    >
      <View style={{ flex: 1 }}>
        <ScrollView 
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
        >
          {messages.length === 0 ? (
            <View style={[card, { padding: spacing.lg, alignItems: "center" }]}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
              <Text style={[text.body, { marginTop: spacing.md, textAlign: "center" }]}>
                No messages yet. Start the conversation!
              </Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === userId;
              return (
                <View
                  key={msg.id}
                  style={{
                    marginBottom: spacing.md,
                    alignSelf: isMe ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                  }}
                >
                  <View
                    style={[
                      card,
                      {
                        padding: spacing.md,
                        backgroundColor: isMe ? colors.accent + "22" : colors.cardBg,
                        borderColor: isMe ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={text.body}>{msg.content}</Text>
                    <Text style={[text.muted, { fontSize: 12, marginTop: spacing.xs }]}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View
          style={{
            padding: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
          }}
        >
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput
              style={[
                card,
                {
                  flex: 1,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  minHeight: 44,
                },
              ]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textSecondary}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={500}
            />
            <AppButton
              title={sending ? "..." : "Send"}
              variant="primary"
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
              style={{ minWidth: 80 }}
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
