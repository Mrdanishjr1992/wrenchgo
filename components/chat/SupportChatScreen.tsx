import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInRight,
  SlideInLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "../../src/ui/theme-context";
import {
  getSupportThread,
  userReplyToSupport,
  markSupportThreadRead,
  type ThreadMessage,
} from "../../src/lib/admin-messages";
import { supabase } from "../../src/lib/supabase";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

function SupportHeader({ onBack }: { onBack: () => void }) {
  const { colors, spacing, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: pressed ? withAlpha(colors.textMuted, 0.1) : "transparent",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>

        <View style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.info,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: spacing.sm,
        }}>
          <Ionicons name="headset" size={22} color={colors.white} />
        </View>

        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={{
            fontSize: 17,
            fontWeight: "700",
            color: colors.textPrimary,
          }}>
            Support Team
          </Text>
          <Text style={{
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 2,
          }}>
            We typically respond within 24 hours
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function DateSeparator({ date }: { date: string }) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(200)}
      style={{
        alignItems: "center",
        marginVertical: spacing.md,
      }}
    >
      <View style={{
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
      }}>
        <Text style={{
          fontSize: 12,
          color: colors.textMuted,
          fontWeight: "500",
        }}>{date}</Text>
      </View>
    </Animated.View>
  );
}

function MessageBubble({
  message,
  isFromUser,
  index,
}: {
  message: ThreadMessage;
  isFromUser: boolean;
  index: number;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();

  return (
    <Animated.View
      entering={isFromUser ? SlideInRight.delay(index * 30).duration(250) : SlideInLeft.delay(index * 30).duration(250)}
      style={{
        alignSelf: isFromUser ? "flex-end" : "flex-start",
        maxWidth: "80%",
        marginBottom: spacing.sm,
        marginHorizontal: spacing.md,
      }}
    >
      {!isFromUser && (
        <Text style={{
          fontSize: 12,
          color: colors.textMuted,
          marginBottom: 4,
          marginLeft: 4,
        }}>
          {message.sender_name}
        </Text>
      )}
      <View style={{
        backgroundColor: isFromUser ? colors.primary : colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.xl,
        borderBottomRightRadius: isFromUser ? radius.xs : radius.xl,
        borderBottomLeftRadius: isFromUser ? radius.xl : radius.xs,
        ...shadows.sm,
      }}>
        <Text style={{
          fontSize: 15,
          color: isFromUser ? colors.white : colors.textPrimary,
          lineHeight: 22,
        }}>
          {message.body}
        </Text>
      </View>
      <Text style={{
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 4,
        alignSelf: isFromUser ? "flex-end" : "flex-start",
        marginHorizontal: 4,
      }}>
        {fmtTime(message.created_at)}
      </Text>
    </Animated.View>
  );
}

function EmptyState() {
  const { colors, spacing, withAlpha } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(400)}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: withAlpha(colors.info, 0.1),
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
      }}>
        <Ionicons name="chatbubbles-outline" size={36} color={colors.info} />
      </View>
      <Text style={{
        fontSize: 18,
        fontWeight: "600",
        color: colors.textPrimary,
        marginBottom: spacing.sm,
        textAlign: "center",
      }}>
        Start a conversation
      </Text>
      <Text style={{
        fontSize: 14,
        color: colors.textMuted,
        textAlign: "center",
        lineHeight: 20,
      }}>
        Send us a message and we'll get back to you as soon as possible.
      </Text>
    </Animated.View>
  );
}

export function SupportChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ threadId?: string }>();
  const threadId = params.threadId;
  const isNewThread = threadId === 'new';

  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(!isNewThread);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(isNewThread ? null : threadId || null);

  const sendScale = useSharedValue(1);
  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!threadId || isNewThread) {
      setLoading(false);
      return;
    }

    try {
      const data = await getSupportThread(threadId);
      setMessages(data);

      // Mark entire thread as read
      await markSupportThreadRead(threadId).catch(() => {});
    } catch (error) {
      console.error("Error fetching support thread:", error);
    } finally {
      setLoading(false);
    }
  }, [threadId, isNewThread]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText("");

    // Optimistic update
    const optimisticMessage: ThreadMessage = {
      id: `temp-${Date.now()}`,
      sender_id: userId || "",
      sender_name: "You",
      sender_type: "user",
      body: text,
      related_job_id: null,
      related_job_title: null,
      attachment_url: null,
      attachment_type: null,
      read_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMessage]);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const result = await userReplyToSupport({
        body: text,
        threadId: currentThreadId || undefined,
      });

      // Update current thread ID if this was a new thread
      if (!currentThreadId && result.thread_id) {
        setCurrentThreadId(result.thread_id);
      }

      // Replace optimistic message with real one
      setMessages(prev => prev.map(m =>
        m.id === optimisticMessage.id
          ? { ...optimisticMessage, id: result.id }
          : m
      ));
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const groupedMessages = React.useMemo(() => {
    const groups: { date: string; messages: ThreadMessage[] }[] = [];
    let currentDate = "";

    for (const msg of messages) {
      const msgDate = fmtDate(msg.created_at);
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }

    return groups;
  }, [messages]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(customer)/(tabs)/inbox");
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SupportHeader onBack={handleBack} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <SupportHeader onBack={handleBack} />

      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          ref={flatListRef}
          data={groupedMessages}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <View>
              <DateSeparator date={item.date} />
              {item.messages.map((msg: ThreadMessage, idx: number) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isFromUser={msg.sender_type === "user"}
                  index={idx}
                />
              ))}
            </View>
          )}
          contentContainerStyle={{
            paddingVertical: spacing.md,
            flexGrow: 1,
          }}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Animated.View
        entering={FadeInDown.duration(300)}
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.sm,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          ...shadows.sm,
        }}
      >
        <View style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.sm,
        }}>
          <View style={{
            flex: 1,
            backgroundColor: colors.bg,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: Platform.OS === "ios" ? spacing.sm : 0,
            minHeight: 44,
            maxHeight: 120,
          }}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                fontSize: 16,
                color: colors.textPrimary,
                maxHeight: 100,
                paddingVertical: Platform.OS === "android" ? spacing.sm : 0,
              }}
            />
          </View>

          <AnimatedPressable
            onPress={handleSend}
            onPressIn={() => { sendScale.value = withSpring(0.9); }}
            onPressOut={() => { sendScale.value = withSpring(1); }}
            disabled={!inputText.trim() || sending}
            style={[
              sendAnimatedStyle,
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: inputText.trim() ? colors.primary : withAlpha(colors.primary, 0.3),
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="send" size={20} color={colors.white} />
            )}
          </AnimatedPressable>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
