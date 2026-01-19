import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { supabase } from '../../src/lib/supabase';

interface RecipientInfo {
  id: string;
  name: string;
  role?: string;
}

interface Message {
  id: string;
  sender_name: string;
  sender_type: string;
  body: string;
  created_at: string;
  related_job_title?: string;
}

interface AdminMessageModalProps {
  visible: boolean;
  onClose: () => void;
  recipient: RecipientInfo;
  relatedJobId?: string;
  relatedJobTitle?: string;
  supportRequestId?: string;
  disputeId?: string;
  onSuccess?: () => void;
}

export function AdminMessageModal({
  visible,
  onClose,
  recipient,
  relatedJobId,
  relatedJobTitle,
  supportRequestId,
  disputeId,
  onSuccess,
}: AdminMessageModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible && recipient.id) {
      loadMessageHistory();
    }
  }, [visible, recipient.id]);

  const loadMessageHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_user_messages', {
        p_user_id: recipient.id,
        p_limit: 50,
      });
      if (error) throw error;
      const sorted = (data || []).sort(
        (a: Message, b: Message) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(sorted);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (error: any) {
      console.error('Failed to load message history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async () => {
    if (!body.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.rpc('admin_send_message', {
        p_recipient_id: recipient.id,
        p_body: body.trim(),
        p_related_job_id: relatedJobId || null,
        p_support_request_id: supportRequestId || null,
        p_dispute_id: disputeId || null,
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Failed to send');

      setBody('');
      await loadMessageHistory();
      onSuccess?.();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (body.trim() && !sending) {
      Alert.alert('Discard Message?', 'Your message will not be saved.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setBody('');
            setMessages([]);
            onClose();
          },
        },
      ]);
    } else {
      setBody('');
      setMessages([]);
      onClose();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isAdmin = item.sender_type === 'admin';
    return (
      <View
        style={{
          alignSelf: isAdmin ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          marginVertical: 4,
          marginHorizontal: spacing.md,
        }}
      >
        <View
          style={{
            backgroundColor: isAdmin ? colors.accent : colors.surface,
            borderRadius: 16,
            borderBottomRightRadius: isAdmin ? 4 : 16,
            borderBottomLeftRadius: isAdmin ? 16 : 4,
            padding: spacing.sm,
            paddingHorizontal: spacing.md,
          }}
        >
          <Text
            style={{
              color: isAdmin ? '#FFFFFF' : colors.textPrimary,
              fontSize: 15,
            }}
          >
            {item.body}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 11,
            color: colors.textMuted,
            marginTop: 2,
            alignSelf: isAdmin ? 'flex-end' : 'flex-start',
            marginHorizontal: 4,
          }}
        >
          {formatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: insets.top + spacing.md,
            paddingBottom: spacing.md,
            paddingHorizontal: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <TouchableOpacity onPress={handleClose} disabled={sending}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '600',
                color: colors.textPrimary,
              }}
            >
              {recipient.name}
            </Text>
            {recipient.role && (
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {recipient.role}
              </Text>
            )}
          </View>
          <View style={{ width: 24 }} />
        </View>

        {(relatedJobTitle || supportRequestId || disputeId) && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            {relatedJobTitle && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons
                  name="construct-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text
                  style={{
                    marginLeft: 4,
                    fontSize: 12,
                    color: colors.textSecondary,
                  }}
                >
                  {relatedJobTitle}
                </Text>
              </View>
            )}
            {disputeId && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginLeft: relatedJobTitle ? spacing.md : 0,
                }}
              >
                <Ionicons name="warning-outline" size={14} color="#EF4444" />
                <Text style={{ marginLeft: 4, fontSize: 12, color: '#EF4444' }}>
                  Dispute
                </Text>
              </View>
            )}
          </View>
        )}

        {loadingHistory ? (
          <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : messages.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.xl,
            }}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={colors.textMuted}
            />
            <Text
              style={{
                marginTop: spacing.md,
                color: colors.textSecondary,
                textAlign: 'center',
              }}
            >
              No previous messages with this user
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingVertical: spacing.md }}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
            style={{
              flex: 1,
              backgroundColor: colors.background,
              borderRadius: 20,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.textPrimary,
              fontSize: 15,
              maxHeight: 100,
            }}
            editable={!sending}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !body.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: body.trim() ? colors.accent : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: spacing.sm,
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
