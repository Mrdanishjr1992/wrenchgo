import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import type { ChatState, ChatRestrictionType } from '../../src/types/chat-moderation';

interface ChatStatusBannerProps {
  chatState: ChatState;
  restrictionType?: ChatRestrictionType;
  message?: string;
  expiresAt?: string;
  showButtons?: boolean;
  buttonActions?: string[];
  onButtonPress?: (action: string) => void;
}

export function ChatStatusBanner({
  chatState,
  restrictionType,
  message,
  expiresAt,
  showButtons,
  buttonActions,
  onButtonPress,
}: ChatStatusBannerProps) {
  const { colors, text } = useTheme();

  if (chatState === 'open') return null;

  const getStatusConfig = () => {
    if (restrictionType === 'suspended') {
      return {
        icon: 'ban' as const,
        color: '#ef4444',
        bgColor: '#fef2f2',
        title: 'Chat Suspended',
        defaultMessage: 'Your chat access has been temporarily suspended due to policy violations.',
      };
    }

    if (restrictionType === 'templated_only') {
      return {
        icon: 'list' as const,
        color: '#f59e0b',
        bgColor: '#fffbeb',
        title: 'Limited Chat Access',
        defaultMessage: 'You can only send pre-approved messages. Use the quick reply buttons below.',
      };
    }

    switch (chatState) {
      case 'read_only':
        return {
          icon: 'eye' as const,
          color: '#6b7280',
          bgColor: '#f9fafb',
          title: 'Read-Only Mode',
          defaultMessage: 'This conversation is now read-only. You can view messages but cannot send new ones.',
        };
      case 'closed':
        return {
          icon: 'lock-closed' as const,
          color: '#6b7280',
          bgColor: '#f9fafb',
          title: 'Chat Closed',
          defaultMessage: 'This conversation has been closed. Start a new job to chat again.',
        };
      case 'restricted':
        return {
          icon: 'warning' as const,
          color: '#f59e0b',
          bgColor: '#fffbeb',
          title: 'Chat Restricted',
          defaultMessage: 'Chat access is currently restricted for this conversation.',
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const formatExpiryTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffHours > 24) {
        return `Expires in ${Math.floor(diffHours / 24)} days`;
      } else if (diffHours > 0) {
        return `Expires in ${diffHours}h ${diffMins}m`;
      } else if (diffMins > 0) {
        return `Expires in ${diffMins} minutes`;
      } else {
        return 'Expires soon';
      }
    } catch {
      return '';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor, borderColor: config.color }]}>
      <View style={styles.header}>
        <Ionicons name={config.icon} size={22} color={config.color} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: config.color }]}>{config.title}</Text>
          {expiresAt && (
            <Text style={[styles.expiryText, { color: colors.textMuted }]}>
              {formatExpiryTime(expiresAt)}
            </Text>
          )}
        </View>
      </View>

      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {message || config.defaultMessage}
      </Text>

      {showButtons && buttonActions && buttonActions.length > 0 && (
        <View style={styles.buttonsContainer}>
          {buttonActions.map((action, index) => (
            <Pressable
              key={index}
              onPress={() => onButtonPress?.(action)}
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: config.color }]}
            >
              <Text style={[styles.actionButtonText, { color: config.color }]}>{action}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  expiryText: {
    fontSize: 12,
    marginTop: 2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
