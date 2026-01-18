import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../src/ui/theme-context';
import {
  AdminMessage,
  listMyAdminMessages,
  markAdminMessageRead,
} from '../../src/lib/admin-messages';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface Props {
  onMessagePress?: (message: AdminMessage) => void;
}

function MessageCard({
  message,
  onPress,
  index,
}: {
  message: AdminMessage;
  onPress: () => void;
  index: number;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const isUnread = !message.read_at;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          padding: spacing.md,
          backgroundColor: isUnread ? withAlpha(colors.info, 0.08) : colors.surface,
          borderRadius: radius.xl,
          borderLeftWidth: isUnread ? 3 : 0,
          borderLeftColor: colors.info,
          ...shadows.sm,
        }]}
      >
        <View style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: withAlpha(colors.info, 0.15),
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name="headset" size={22} color={colors.info} />
        </View>

        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}>
            <Text style={{
              fontWeight: '700',
              color: colors.textPrimary,
              fontSize: 15,
            }}>
              {message.sender_name || 'Support Team'}
            </Text>
            <Text style={{
              fontSize: 12,
              color: isUnread ? colors.info : colors.textMuted,
              fontWeight: isUnread ? '600' : '400',
            }}>
              {formatTimeAgo(message.created_at)}
            </Text>
          </View>

          {message.related_job_title && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginBottom: 4,
            }}>
              <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
              <Text style={{
                fontSize: 12,
                color: colors.primary,
                fontWeight: '500',
              }}>
                {message.related_job_title}
              </Text>
            </View>
          )}

          <Text
            numberOfLines={2}
            style={{
              color: isUnread ? colors.textPrimary : colors.textMuted,
              fontSize: 14,
              lineHeight: 20,
              fontWeight: isUnread ? '500' : '400',
            }}
          >
            {message.body}
          </Text>

          {message.attachment_url && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: spacing.xs,
              gap: 4,
            }}>
              <Ionicons
                name={message.attachment_type === 'image' ? 'image' : 'document'}
                size={14}
                color={colors.textMuted}
              />
              <Text style={{
                fontSize: 12,
                color: colors.textMuted,
              }}>
                Attachment
              </Text>
            </View>
          )}
        </View>

        {isUnread && (
          <View style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.info,
            marginLeft: spacing.sm,
            marginTop: 4,
          }} />
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

function EmptyState() {
  const { colors, spacing, radius, withAlpha } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(400)}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xxxl,
      }}
    >
      <View style={{
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: withAlpha(colors.info, 0.1),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
      }}>
        <Ionicons name="headset" size={48} color={colors.info} />
      </View>

      <Text style={{
        fontSize: 22,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.sm,
      }}>No support messages</Text>

      <Text style={{
        fontSize: 15,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
      }}>
        Messages from our support team will appear here
      </Text>
    </Animated.View>
  );
}

function MessageSkeleton() {
  const { colors, spacing, radius, withAlpha } = useTheme();

  const shimmer = {
    backgroundColor: withAlpha(colors.textMuted, 0.08),
  };

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
    }}>
      <View style={[shimmer, { width: 48, height: 48, borderRadius: 24 }]} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={[shimmer, { width: 120, height: 16, borderRadius: radius.sm, marginBottom: 8 }]} />
        <View style={[shimmer, { width: '100%', height: 14, borderRadius: radius.sm, marginBottom: 4 }]} />
        <View style={[shimmer, { width: '70%', height: 14, borderRadius: radius.sm }]} />
      </View>
    </View>
  );
}

function LoadingSkeleton() {
  const { colors, spacing } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: spacing.md }}>
      <MessageSkeleton />
      <MessageSkeleton />
      <MessageSkeleton />
      <MessageSkeleton />
    </View>
  );
}

export function SupportMessagesView({ onMessagePress }: Props) {
  const { colors, spacing } = useTheme();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await listMyAdminMessages(50, 0);
      setMessages(data);
    } catch (error) {
      console.error('Error fetching admin messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMessages();
    }, [fetchMessages])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const handleMessagePress = async (message: AdminMessage) => {
    if (!message.read_at) {
      try {
        await markAdminMessageRead(message.id);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id ? { ...m, read_at: new Date().toISOString() } : m
          )
        );
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
    onMessagePress?.(message);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (messages.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState />
      </View>
    );
  }

  return (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <MessageCard
          message={item}
          onPress={() => handleMessagePress(item)}
          index={index}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={{
        paddingTop: spacing.md,
        paddingBottom: spacing.xxxl,
        flexGrow: 1,
      }}
      style={{ flex: 1, backgroundColor: colors.bg }}
      showsVerticalScrollIndicator={false}
    />
  );
}
