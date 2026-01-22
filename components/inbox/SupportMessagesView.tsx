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
  type SupportThread,
  listMySupportThreads,
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
  onThreadPress?: (thread: SupportThread) => void;
}

function ThreadCard({
  thread,
  onPress,
  index,
}: {
  thread: SupportThread;
  onPress: () => void;
  index: number;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const hasUnread = thread.unread_count > 0;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getLastMessagePreview = () => {
    const prefix = thread.last_message_sender_type === 'user' ? 'You: ' : '';
    const body = thread.last_message_body || '';
    return prefix + (body.length > 60 ? body.slice(0, 60) + '...' : body);
  };

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
          backgroundColor: hasUnread ? withAlpha(colors.info, 0.08) : colors.surface,
          borderRadius: radius.xl,
          borderLeftWidth: hasUnread ? 3 : 0,
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
              flex: 1,
            }} numberOfLines={1}>
              {thread.subject}
            </Text>
            <Text style={{
              fontSize: 12,
              color: hasUnread ? colors.info : colors.textMuted,
              fontWeight: hasUnread ? '600' : '400',
              marginLeft: spacing.sm,
            }}>
              {formatTimeAgo(thread.last_message_at)}
            </Text>
          </View>

          {thread.related_job_title && (
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
              }} numberOfLines={1}>
                {thread.related_job_title}
              </Text>
            </View>
          )}

          <Text
            numberOfLines={2}
            style={{
              color: hasUnread ? colors.textPrimary : colors.textMuted,
              fontSize: 14,
              lineHeight: 20,
              fontWeight: hasUnread ? '500' : '400',
            }}
          >
            {getLastMessagePreview()}
          </Text>
        </View>

        {hasUnread && (
          <View style={{
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.info,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: spacing.sm,
            paddingHorizontal: 6,
          }}>
            <Text style={{
              color: colors.white,
              fontSize: 11,
              fontWeight: '700',
            }}>
              {thread.unread_count > 99 ? '99+' : thread.unread_count}
            </Text>
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

function EmptyState({ onContactSupport }: { onContactSupport?: () => void }) {
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
      }}>No support conversations</Text>

      <Text style={{
        fontSize: 15,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.lg,
      }}>
        Need help? Start a conversation with our support team.
      </Text>

      {onContactSupport && (
        <Pressable
          onPress={onContactSupport}
          style={({ pressed }) => ({
            backgroundColor: pressed ? withAlpha(colors.info, 0.8) : colors.info,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          })}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.white} />
          <Text style={{
            color: colors.white,
            fontSize: 16,
            fontWeight: '600',
          }}>Contact Support</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

function LoadingSkeleton() {
  const { colors, spacing, radius, withAlpha } = useTheme();

  const shimmer = {
    backgroundColor: withAlpha(colors.textMuted, 0.08),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            marginHorizontal: spacing.md,
            marginBottom: spacing.sm,
            padding: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
          }}
        >
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            ...shimmer,
          }} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <View style={{
              height: 16,
              width: '60%',
              borderRadius: radius.sm,
              marginBottom: 8,
              ...shimmer,
            }} />
            <View style={{
              height: 14,
              width: '90%',
              borderRadius: radius.sm,
              marginBottom: 4,
              ...shimmer,
            }} />
            <View style={{
              height: 14,
              width: '70%',
              borderRadius: radius.sm,
              ...shimmer,
            }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SupportMessagesView({ onThreadPress }: Props) {
  const { colors, spacing, shadows, withAlpha } = useTheme();
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchThreads = useCallback(async () => {
    try {
      const data = await listMySupportThreads(50, 0);
      setThreads(data);
    } catch (error) {
      console.error('Error fetching support threads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchThreads();
    }, [fetchThreads])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchThreads();
  };

  const handleNewSupportThread = () => {
    onThreadPress?.({
      thread_id: 'new',
      subject: 'New Conversation',
      last_message_body: '',
      last_message_at: new Date().toISOString(),
      last_message_sender_type: 'user',
      unread_count: 0,
      total_messages: 0,
      related_job_id: null,
      related_job_title: null,
      created_at: new Date().toISOString(),
    });
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (threads.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <EmptyState onContactSupport={handleNewSupportThread} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.thread_id}
        renderItem={({ item, index }) => (
          <ThreadCard
            thread={item}
            onPress={() => onThreadPress?.(item)}
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
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        onPress={handleNewSupportThread}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: spacing.xl,
          right: spacing.lg,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: pressed ? withAlpha(colors.info, 0.8) : colors.info,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.lg,
        })}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>
    </View>
  );
}
