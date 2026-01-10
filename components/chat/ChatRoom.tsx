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
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { scanMessageBeforeSend, getChatStatus, logMessageAudit } from "../../src/lib/chat-moderation";
import { ChatModerationWarning } from "./ChatModerationWarning";
import { ChatStatusBanner } from "./ChatStatusBanner";
import { ChatPolicyModal } from "./ChatPolicyModal";
import type { ScanMessageResponse, ChatStatusResponse } from "../../src/types/chat-moderation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);

  const [moderationWarning, setModerationWarning] = useState<ScanMessageResponse | null>(null);
  const [chatStatus, setChatStatus] = useState<ChatStatusResponse | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  const listRef = useRef<FlatList<MessageGroup>>(null);
  const canSend = useMemo(
    () => (input.trim().length > 0 || selectedImage) && !sending && !!me && !!jobId && !!recipientId && chatStatus?.can_send !== false,
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
      <FlatList<MessageGroup>
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
              const hasImage = msg.attachment_type === "image" && msg.attachment_url;
              const hasTextContent = msg.body && msg.body !== "📷 Image";

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
                        hasImage && styles.bubbleWithImage,
                      ]}
                    >
                      {hasImage && (
                        <Pressable onPress={() => setPreviewImage(msg.attachment_url!)}>
                          <Image
                            source={{ uri: msg.attachment_url! }}
                            style={styles.messageImage}
                            resizeMode="cover"
                          />
                        </Pressable>
                      )}
                      {hasTextContent && <Text style={styles.bubbleTextMine}>{msg.body}</Text>}
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
                        hasImage && styles.bubbleWithImage,
                      ]}
                    >
                      {hasImage && (
                        <Pressable onPress={() => setPreviewImage(msg.attachment_url!)}>
                          <Image
                            source={{ uri: msg.attachment_url! }}
                            style={styles.messageImage}
                            resizeMode="cover"
                          />
                        </Pressable>
                      )}
                      {hasTextContent && <Text style={[styles.bubbleText, { color: colors.textPrimary }]}>{msg.body}</Text>}
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

      {/* Selected Image Preview */}
      {selectedImage && (
        <View style={[styles.selectedImageContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Image source={{ uri: selectedImage }} style={styles.selectedImagePreview} resizeMode="cover" />
          <Pressable
            onPress={() => setSelectedImage(null)}
            style={[styles.removeImageButton, { backgroundColor: colors.bg }]}
          >
            <Ionicons name="close" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>
      )}

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => setShowAttachmentOptions(true)}
          disabled={chatStatus?.can_send === false}
          style={({ pressed }) => [
            styles.attachButton,
            { opacity: chatStatus?.can_send === false ? 0.4 : pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.accent} />
        </Pressable>

        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: colors.bg, borderColor: focused ? colors.accent : colors.border },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={chatStatus?.can_send === false ? "Chat is restricted" : "Type a message..."}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary }]}
            multiline
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={chatStatus?.can_send !== false}
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
          {sending || uploadingImage ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Ionicons name="arrow-up" size={22} color="#000" />
          )}
        </Pressable>
      </View>

      {/* Attachment Options Modal */}
      <Modal
        visible={showAttachmentOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachmentOptions(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAttachmentOptions(false)}>
          <View style={[styles.attachmentSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[text.section, { marginBottom: 16 }]}>Add Attachment</Text>

            <Pressable
              onPress={() => pickImage("camera")}
              style={({ pressed }) => [styles.attachmentOption, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.attachmentIconContainer, { backgroundColor: colors.accent + "20" }]}>
                <Ionicons name="camera" size={24} color={colors.accent} />
              </View>
              <View style={styles.attachmentOptionText}>
                <Text style={[text.body, { fontWeight: "600" }]}>Take Photo</Text>
                <Text style={text.muted}>Use your camera</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => pickImage("library")}
              style={({ pressed }) => [styles.attachmentOption, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.attachmentIconContainer, { backgroundColor: "#8B5CF620" }]}>
                <Ionicons name="images" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.attachmentOptionText}>
                <Text style={[text.body, { fontWeight: "600" }]}>Photo Library</Text>
                <Text style={text.muted}>Choose from gallery</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setShowAttachmentOptions(false)}
              style={({ pressed }) => [
                styles.cancelButton,
                { backgroundColor: colors.bg, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[text.body, { fontWeight: "600" }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewCloseButton} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <ChatPolicyModal visible={showPolicyModal} onClose={() => setShowPolicyModal(false)} />
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
    gap: 8,
  },
  attachButton: {
    padding: 4,
    marginBottom: 8,
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
  bubbleWithImage: {
    padding: 4,
    overflow: "hidden",
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 16,
    marginBottom: 4,
  },
  selectedImageContainer: {
    padding: 12,
    borderTopWidth: 1,
    position: "relative",
  },
  selectedImagePreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    left: 76,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  attachmentSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  attachmentOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 16,
  },
  attachmentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentOptionText: {
    flex: 1,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewCloseButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
});