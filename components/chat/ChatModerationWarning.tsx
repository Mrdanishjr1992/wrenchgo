import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import type { MessageAction } from '../../src/types/chat-moderation';

interface ChatModerationWarningProps {
  action: MessageAction;
  message?: string;
  detectedPatterns?: Array<{ type: string; pattern: string }>;
  onDismiss?: () => void;
  onLearnMore?: () => void;
}

export function ChatModerationWarning({
  action,
  message,
  detectedPatterns,
  onDismiss,
  onLearnMore,
}: ChatModerationWarningProps) {
  const { colors, text } = useTheme();

  if (action === 'allowed') return null;

  const getWarningConfig = () => {
    switch (action) {
      case 'blocked':
        return {
          icon: 'shield-checkmark' as const,
          color: '#ef4444',
          bgColor: '#fef2f2',
          title: 'Message Blocked',
          defaultMessage: 'This message contains contact information and cannot be sent. Keep all communication on WrenchGo for your protection.',
        };
      case 'masked':
        return {
          icon: 'eye-off' as const,
          color: '#f59e0b',
          bgColor: '#fffbeb',
          title: 'Contact Info Hidden',
          defaultMessage: 'Contact information has been masked to protect both parties. Use WrenchGo for secure communication.',
        };
      case 'warned':
        return {
          icon: 'warning' as const,
          color: '#f59e0b',
          bgColor: '#fffbeb',
          title: 'Reminder',
          defaultMessage: 'Please keep all communication on WrenchGo. This protects your payments, job history, and gives you access to support if needed.',
        };
      default:
        return null;
    }
  };

  const config = getWarningConfig();
  if (!config) return null;

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor, borderColor: config.color }]}>
      <View style={styles.header}>
        <Ionicons name={config.icon} size={20} color={config.color} />
        <Text style={[styles.title, { color: config.color }]}>{config.title}</Text>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismissButton}>
            <Ionicons name="close" size={18} color={config.color} />
          </Pressable>
        )}
      </View>

      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {message || config.defaultMessage}
      </Text>

      {detectedPatterns && detectedPatterns.length > 0 && (
        <View style={styles.patternsContainer}>
          <Text style={[styles.patternsLabel, { color: colors.textMuted }]}>
            Detected: {detectedPatterns.map(p => p.type).join(', ')}
          </Text>
        </View>
      )}

      {onLearnMore && (
        <Pressable onPress={onLearnMore} style={styles.learnMoreButton}>
          <Text style={[styles.learnMoreText, { color: config.color }]}>Why is this important?</Text>
          <Ionicons name="chevron-forward" size={16} color={config.color} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  dismissButton: {
    padding: 2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  patternsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  patternsLabel: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  learnMoreText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
});
