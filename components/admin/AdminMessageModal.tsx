import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminSendMessage, SendAdminMessageParams } from '../../src/lib/admin-messages';

interface RecipientInfo {
  id: string;
  name: string;
  role?: string;
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

  const handleSend = async () => {
    if (!body.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setSending(true);
    try {
      const params: SendAdminMessageParams = {
        recipientId: recipient.id,
        body: body.trim(),
        relatedJobId: relatedJobId,
        supportRequestId: supportRequestId,
        disputeId: disputeId,
      };

      await adminSendMessage(params);
      Alert.alert('Success', 'Message sent successfully');
      setBody('');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (body.trim() && !sending) {
      Alert.alert(
        'Discard Message?',
        'Your message will not be saved.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => { setBody(''); onClose(); } },
        ]
      );
    } else {
      setBody('');
      onClose();
    }
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
            <Text style={{ color: colors.accent, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>
            Send Message
          </Text>
          <TouchableOpacity onPress={handleSend} disabled={sending || !body.trim()}>
            {sending ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text
                style={{
                  color: body.trim() ? colors.accent : colors.textMuted,
                  fontSize: 16,
                  fontWeight: '600',
                }}
              >
                Send
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ padding: spacing.lg }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.lg,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                TO
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.accent + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing.sm,
                  }}
                >
                  <Ionicons name="person" size={18} color={colors.accent} />
                </View>
                <View>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary, fontSize: 15 }}>
                    {recipient.name}
                  </Text>
                  {recipient.role && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {recipient.role}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {(relatedJobTitle || supportRequestId || disputeId) && (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                  CONTEXT
                </Text>
                {relatedJobTitle && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="construct-outline" size={16} color={colors.accent} />
                    <Text style={{ marginLeft: 6, color: colors.textPrimary, fontSize: 14 }}>
                      Job: {relatedJobTitle}
                    </Text>
                  </View>
                )}
                {supportRequestId && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="help-circle-outline" size={16} color={colors.accent} />
                    <Text style={{ marginLeft: 6, color: colors.textPrimary, fontSize: 14 }}>
                      Support Request
                    </Text>
                  </View>
                )}
                {disputeId && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="warning-outline" size={16} color="#EF4444" />
                    <Text style={{ marginLeft: 6, color: colors.textPrimary, fontSize: 14 }}>
                      Dispute
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: spacing.md,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>
                MESSAGE
              </Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Type your message here..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={4000}
                style={{
                  color: colors.textPrimary,
                  fontSize: 15,
                  minHeight: 150,
                  textAlignVertical: 'top',
                }}
                editable={!sending}
              />
              <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: spacing.sm }}>
                {body.length}/4000
              </Text>
            </View>

            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }}>
              This message will appear in the user's Support inbox
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
