import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  SlideInLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { scanMessageBeforeSend, getChatStatus, logMessageAudit } from "../../src/lib/chat-moderation";
import { ChatModerationWarning } from "./ChatModerationWarning";
import { ChatStatusBanner } from "./ChatStatusBanner";
import { ChatPolicyModal } from "./ChatPolicyModal";
import type { ScanMessageResponse, ChatStatusResponse } from "../../src/types/chat-moderation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Msg = {
  id: string;
  job_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: "image" | "file" | null;
};

type MessageGroup = {
  date: string;
  messages: Msg[];
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

function ChatHeader({
  name,
  role,
  onBack,
}: {
  name: string | null;
  role: "customer" | "mechanic";
  onBack: () => void;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();
  const initials = getInitials(name);
  const avatarColor = role === "customer" ? colors.primary : colors.accent;

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
          backgroundColor: avatarColor,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: spacing.sm,
        }}>
          <Text style={{
            color: colors.white,
            fontWeight: "700",
            fontSize: 16,
          }}>{initials}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={{
            fontSize: 17,
            fontWeight: "700",
            color: colors.textPrimary,
          }} numberOfLines={1}>
            {name || (role === "customer" ? "Mechanic" : "Customer")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.success,
            }} />
            <Text style={{
              fontSize: 13,
              color: colors.textMuted,
            }}>Online</Text>
          </View>
        </View>

        <Pressable
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
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function DateSeparator({ date }: { date: string }) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(300)}
      style={{
        alignItems: "center",
        marginVertical: spacing.lg,
      }}
    >
      <View style={{
        backgroundColor: colors.surface2,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
      }}>
        <Text style={{
          fontSize: 12,
          fontWeight: "600",
          color: colors.textMuted,
        }}>{fmtDate(date)}</Text>
      </View>
    </Animated.View>
  );
}

function MessageBubble({
  message,
  isMine,
  isFirst,
  isLast,
  index,
  onImagePress,
}: {
  message: Msg;
  isMine: boolean;
  isFirst: boolean;
  isLast: boolean;
  index: number;
  onImagePress: (url: string) => void;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const hasImage = message.attachment_type === "image" && message.attachment_url;
  const hasTextContent = message.body && message.body !== "📷 Image";

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bubbleRadius = {
    borderTopLeftRadius: isMine ? 20 : (isFirst ? 20 : 6),
    borderTopRightRadius: isMine ? (isFirst ? 20 : 6) : 20,
    borderBottomLeftRadius: isMine ? 20 : (isLast ? 20 : 6),
    borderBottomRightRadius: isMine ? (isLast ? 20 : 6) : 20,
  };

  return (
    <Animated.View
      entering={isMine ? SlideInRight.delay(index * 30).duration(300).springify() : SlideInLeft.delay(index * 30).duration(300).springify()}
      style={[animatedStyle, {
        alignSelf: isMine ? "flex-end" : "flex-start",
        maxWidth: "80%",
        marginBottom: isLast ? spacing.sm : 2,
      }]}
    >
      <AnimatedPressable
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[
          {
            paddingVertical: hasImage && !hasTextContent ? 4 : spacing.sm,
            paddingHorizontal: hasImage && !hasTextContent ? 4 : spacing.md,
            backgroundColor: isMine ? colors.primary : colors.surface,
            borderWidth: isMine ? 0 : 1,
            borderColor: colors.border,
            overflow: "hidden",
          },
          bubbleRadius,
        ]}
      >
        {hasImage && (
          <Pressable onPress={() => onImagePress(message.attachment_url!)}>
            <Image
              source={{ uri: message.attachment_url! }}
              style={{
                width: 220,
                height: 165,
                borderRadius: radius.lg,
                marginBottom: hasTextContent ? spacing.xs : 0,
              }}
              resizeMode="cover"
            />
          </Pressable>
        )}

        {hasTextContent && (
          <Text style={{
            fontSize: 15,
            lineHeight: 21,
            color: isMine ? colors.white : colors.textPrimary,
          }}>{message.body}</Text>
        )}

        {isLast && (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 4,
            marginTop: 4,
          }}>
            <Text style={{
              fontSize: 11,
              color: isMine ? withAlpha(colors.white, 0.7) : colors.textMuted,
            }}>{fmtTime(message.created_at)}</Text>
            {isMine && (
              <Ionicons
                name="checkmark-done"
                size={14}
                color={withAlpha(colors.white, 0.7)}
              />
            )}
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

function EmptyChat() {
  const { colors, spacing, radius, withAlpha } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(200).duration(400)}
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
        backgroundColor: withAlpha(colors.primary, 0.1),
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
      }}>
        <Ionicons name="chatbubbles" size={36} color={colors.primary} />
      </View>

      <Text style={{
        fontSize: 20,
        fontWeight: "700",
        color: colors.textPrimary,
        marginBottom: spacing.xs,
      }}>Start the conversation</Text>

      <Text style={{
        fontSize: 15,
        color: colors.textMuted,
        textAlign: "center",
        lineHeight: 22,
      }}>Send a message to connect with your {"\n"}service provider</Text>
    </Animated.View>
  );
}

function ChatSkeleton() {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  const shimmer = {
    backgroundColor: withAlpha(colors.textMuted, 0.08),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}>
        <View style={[shimmer, { width: 40, height: 40, borderRadius: 20 }]} />
        <View style={[shimmer, { width: 44, height: 44, borderRadius: 22 }]} />
        <View style={{ flex: 1 }}>
          <View style={[shimmer, { width: 120, height: 18, borderRadius: radius.sm, marginBottom: 6 }]} />
          <View style={[shimmer, { width: 60, height: 14, borderRadius: radius.sm }]} />
        </View>
      </View>

      <View style={{ flex: 1, padding: spacing.lg }}>
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <View style={[shimmer, { width: 80, height: 24, borderRadius: radius.full }]} />
        </View>

        <View style={{ alignSelf: "flex-start", marginBottom: spacing.sm }}>
          <View style={[shimmer, { width: 200, height: 60, borderRadius: 20 }]} />
        </View>
        <View style={{ alignSelf: "flex-start", marginBottom: spacing.lg }}>
          <View style={[shimmer, { width: 150, height: 40, borderRadius: 20 }]} />
        </View>

        <View style={{ alignSelf: "flex-end", marginBottom: spacing.sm }}>
          <View style={[shimmer, { width: 180, height: 50, borderRadius: 20 }]} />
        </View>
        <View style={{ alignSelf: "flex-end", marginBottom: spacing.lg }}>
          <View style={[shimmer, { width: 220, height: 70, borderRadius: 20 }]} />
        </View>

        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <View style={[shimmer, { width: 80, height: 24, borderRadius: radius.full }]} />
        </View>

        <View style={{ alignSelf: "flex-start", marginBottom: spacing.sm }}>
          <View style={[shimmer, { width: 160, height: 45, borderRadius: 20 }]} />
        </View>
      </View>

      <View style={{
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        backgroundColor: colors.surface,
        gap: spacing.sm,
      }}>
        <View style={[shimmer, { width: 44, height: 44, borderRadius: 22 }]} />
        <View style={[shimmer, { flex: 1, height: 48, borderRadius: 24 }]} />
        <View style={[shimmer, { width: 48, height: 48, borderRadius: 24 }]} />
      </View>
    </View>
  );
}

function ComposerBar({
  value,
  onChangeText,
  onSend,
  onAttach,
  canSend,
  sending,
  disabled,
  selectedImage,
  onRemoveImage,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttach: () => void;
  canSend: boolean;
  sending: boolean;
  disabled: boolean;
  selectedImage: string | null;
  onRemoveImage: () => void;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const sendScale = useSharedValue(1);

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
        paddingBottom: insets.bottom + spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      {selectedImage && (
        <View style={{
          marginBottom: spacing.sm,
          position: "relative",
          alignSelf: "flex-start",
        }}>
          <Image
            source={{ uri: selectedImage }}
            style={{
              width: 80,
              height: 80,
              borderRadius: radius.lg,
            }}
            resizeMode="cover"
          />
          <Pressable
            onPress={onRemoveImage}
            style={{
              position: "absolute",
              top: -8,
              right: -8,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: colors.error,
              alignItems: "center",
              justifyContent: "center",
              ...shadows.sm,
            }}
          >
            <Ionicons name="close" size={14} color={colors.white} />
          </Pressable>
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
        <Pressable
          onPress={onAttach}
          disabled={disabled}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: pressed ? withAlpha(colors.primary, 0.1) : "transparent",
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.4 : 1,
          })}
        >
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </Pressable>

        <View style={{
          flex: 1,
          backgroundColor: colors.bg,
          borderRadius: radius.xl,
          borderWidth: 2,
          borderColor: focused ? colors.primary : colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          minHeight: 48,
          justifyContent: "center",
        }}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={disabled ? "Chat is restricted" : "Type a message..."}
            placeholderTextColor={colors.textMuted}
            style={{
              fontSize: 16,
              color: colors.textPrimary,
              maxHeight: 100,
              minHeight: 24,
            }}
            multiline
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={!disabled}
          />
        </View>

        <AnimatedPressable
          onPress={onSend}
          disabled={!canSend}
          onPressIn={() => { sendScale.value = withSpring(0.9, { damping: 15 }); }}
          onPressOut={() => { sendScale.value = withSpring(1, { damping: 15 }); }}
          style={[sendAnimatedStyle, {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: canSend ? colors.primary : withAlpha(colors.primary, 0.3),
            alignItems: "center",
            justifyContent: "center",
            ...shadows.sm,
          }]}
        >
          {sending ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: colors.white,
                borderTopColor: "transparent",
              }}
            />
          ) : (
            <Ionicons name="arrow-up" size={22} color={colors.white} />
          )}
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

function AttachmentModal({
  visible,
  onClose,
  onPickCamera,
  onPickLibrary,
}: {
  visible: boolean;
  onClose: () => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: withAlpha(colors.black, 0.5),
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.lg,
          }}
        >
          <View style={{
            width: 40,
            height: 4,
            backgroundColor: colors.border,
            borderRadius: 2,
            alignSelf: "center",
            marginBottom: spacing.lg,
          }} />

          <Text style={{
            fontSize: 18,
            fontWeight: "700",
            color: colors.textPrimary,
            marginBottom: spacing.lg,
          }}>Add Attachment</Text>

          <Pressable
            onPress={onPickCamera}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: withAlpha(colors.primary, 0.1),
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Ionicons name="camera" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: "600",
                color: colors.textPrimary,
              }}>Take Photo</Text>
              <Text style={{
                fontSize: 14,
                color: colors.textMuted,
                marginTop: 2,
              }}>Use your camera</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>

          <View style={{
            height: 1,
            backgroundColor: colors.border,
            marginVertical: spacing.xs,
          }} />

          <Pressable
            onPress={onPickLibrary}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: withAlpha(colors.info, 0.1),
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Ionicons name="images" size={24} color={colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 16,
                fontWeight: "600",
                color: colors.textPrimary,
              }}>Photo Library</Text>
              <Text style={{
                fontSize: 14,
                color: colors.textMuted,
                marginTop: 2,
              }}>Choose from gallery</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              marginTop: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: colors.bg,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.textPrimary,
            }}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function ImagePreviewModal({
  imageUrl,
  onClose,
}: {
  imageUrl: string | null;
  onClose: () => void;
}) {
  const { colors, withAlpha } = useTheme();

  return (
    <Modal
      visible={!!imageUrl}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: withAlpha(colors.black, 0.95),
        justifyContent: "center",
        alignItems: "center",
      }}>
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 60,
            right: 20,
            zIndex: 10,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: withAlpha(colors.white, 0.2),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={28} color={colors.white} />
        </Pressable>
        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_WIDTH,
            }}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );
}

export function ChatRoom({ jobId, role, headerTitle = "Chat", headerSubtitle, backRoute }: ChatRoomProps) {
  const router = useRouter();
  const { colors, spacing, radius, withAlpha } = useTheme();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Msg[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [otherPartyName, setOtherPartyName] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);

  const [moderationWarning, setModerationWarning] = useState<ScanMessageResponse | null>(null);
  const [chatStatus, setChatStatus] = useState<ChatStatusResponse | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  const listRef = useRef<FlatList<MessageGroup>>(null);
  const canSend = useMemo(
    () => (input.trim().length > 0 || !!selectedImage) && !sending && !!me && !!jobId && !!recipientId && chatStatus?.can_send !== false,
    [input, sending, me, jobId, recipientId, chatStatus, selectedImage]
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

        const status = await getChatStatus(jobId, jobId);
        setChatStatus(status);
      }

      const { data, error } = await supabase
        .from("messages")
        .select("id,job_id,sender_id,recipient_id,body,created_at,attachment_url,attachment_type")
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

  const pickImage = useCallback(async (source: "camera" | "library") => {
    setShowAttachmentOptions(false);

    const permissionResult = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("Permission Required", `Please allow access to your ${source === "camera" ? "camera" : "photo library"}.`);
      return;
    }

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  }, []);

  const uploadImage = async (uri: string): Promise<string | null> => {
    if (!me) return null;

    try {
      const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${me}/${Date.now()}.${fileExt}`;
      const mimeType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      const { data, error } = await supabase.storage
        .from("chat-attachments")
        .upload(fileName, decode(base64), {
          contentType: mimeType,
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (e: any) {
      console.error("Upload error:", e);
      return null;
    }
  };

  const send = useCallback(async () => {
    if (!jobId || !me || !recipientId) return;

    const content = input.trim();
    const hasImage = !!selectedImage;

    if (!content && !hasImage) return;

    let attachmentUrl: string | null = null;

    if (hasImage) {
      setUploadingImage(true);
      attachmentUrl = await uploadImage(selectedImage!);
      setUploadingImage(false);

      if (!attachmentUrl) {
        Alert.alert("Upload Failed", "Failed to upload image. Please try again.");
        return;
      }
    }

    if (content) {
      const scanResult = await scanMessageBeforeSend(content, recipientId, jobId);

      if (scanResult.action === 'blocked') {
        setModerationWarning(scanResult);
        Alert.alert(
          'Message Blocked',
          scanResult.message || 'This message contains contact information and cannot be sent.',
          [
            { text: 'Learn More', onPress: () => setShowPolicyModal(true) },
            { text: 'OK', style: 'cancel' },
          ]
        );
        return;
      }

      if (scanResult.action === 'warned') {
        setModerationWarning(scanResult);
      }

      if (scanResult.action === 'masked') {
        setModerationWarning(scanResult);
      }
    }

    setSending(true);
    setInput("");
    setSelectedImage(null);

    const finalContent = content || (hasImage ? "📷 Image" : "");

    const tempId = `temp-${Date.now()}`;
    const temp: Msg = {
      id: tempId,
      job_id: jobId,
      sender_id: me,
      recipient_id: recipientId,
      body: finalContent,
      created_at: new Date().toISOString(),
      attachment_url: attachmentUrl,
      attachment_type: hasImage ? "image" : null,
    };
    setItems((prev) => [...prev, temp]);

    const { data: insertedMessage, error } = await supabase.from("messages").insert({
      job_id: jobId,
      sender_id: me,
      recipient_id: recipientId,
      body: finalContent,
      attachment_url: attachmentUrl,
      attachment_type: hasImage ? "image" : null,
    }).select('id').single();

    if (error) {
      setItems((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
      if (hasImage) setSelectedImage(selectedImage);
      Alert.alert("Send failed", error.message ?? "Failed to send message.");
    } else {
      setItems((prev) => prev.filter((m) => m.id !== tempId));
    }

    setSending(false);
  }, [jobId, me, recipientId, input, selectedImage]);

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

  if (loading) {
    return <ChatSkeleton />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ChatHeader
        name={otherPartyName}
        role={role}
        onBack={handleBack}
      />

      <FlatList<MessageGroup>
        ref={listRef}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.lg,
          flexGrow: items.length === 0 ? 1 : undefined,
        }}
        data={groupedMessages}
        keyExtractor={(item) => item.date}
        renderItem={({ item: group, index: groupIndex }) => (
          <View>
            <DateSeparator date={group.date} />
            {group.messages.map((msg, idx) => {
              const mine = msg.sender_id === me;
              const isFirst = idx === 0 || group.messages[idx - 1].sender_id !== msg.sender_id;
              const isLast = idx === group.messages.length - 1 || group.messages[idx + 1].sender_id !== msg.sender_id;

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMine={mine}
                  isFirst={isFirst}
                  isLast={isLast}
                  index={groupIndex * 10 + idx}
                  onImagePress={setPreviewImage}
                />
              );
            })}
          </View>
        )}
        ListEmptyComponent={<EmptyChat />}
      />

      {chatStatus && chatStatus.chat_state !== 'open' && (
        <ChatStatusBanner
          chatState={chatStatus.chat_state}
          restrictionType={chatStatus.restriction_type}
          message={chatStatus.message}
          expiresAt={chatStatus.expires_at}
          showButtons={chatStatus.show_buttons}
          buttonActions={chatStatus.button_actions}
          onButtonPress={(action) => {
            setInput(action);
          }}
        />
      )}

      {moderationWarning && moderationWarning.show_soft_warning && (
        <ChatModerationWarning
          action={moderationWarning.action}
          message={moderationWarning.warning_message}
          detectedPatterns={moderationWarning.patterns_detected}
          onDismiss={() => setModerationWarning(null)}
          onLearnMore={() => setShowPolicyModal(true)}
        />
      )}

      <ComposerBar
        value={input}
        onChangeText={setInput}
        onSend={send}
        onAttach={() => setShowAttachmentOptions(true)}
        canSend={canSend}
        sending={sending || uploadingImage}
        disabled={chatStatus?.can_send === false}
        selectedImage={selectedImage}
        onRemoveImage={() => setSelectedImage(null)}
      />

      <AttachmentModal
        visible={showAttachmentOptions}
        onClose={() => setShowAttachmentOptions(false)}
        onPickCamera={() => pickImage("camera")}
        onPickLibrary={() => pickImage("library")}
      />

      <ImagePreviewModal
        imageUrl={previewImage}
        onClose={() => setPreviewImage(null)}
      />

      <ChatPolicyModal visible={showPolicyModal} onClose={() => setShowPolicyModal(false)} />
    </KeyboardAvoidingView>
  );
}
