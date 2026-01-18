import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useTheme } from './theme-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function LoadingScreen({
  message = 'Loading...',
  submessage,
}: {
  message?: string;
  submessage?: string;
}) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000 }),
      -1,
      false
    );
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    }}>
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{
          alignItems: 'center',
        }}
      >
        <Animated.View style={[spinStyle, {
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 3,
          borderColor: withAlpha(colors.primary, 0.2),
          borderTopColor: colors.primary,
          marginBottom: spacing.lg,
        }]} />

        <Text style={{
          fontSize: 17,
          fontWeight: '600',
          color: colors.textPrimary,
          marginBottom: spacing.xs,
        }}>{message}</Text>

        {submessage && (
          <Text style={{
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
          }}>{submessage}</Text>
        )}
      </Animated.View>
    </View>
  );
}

export function ErrorScreen({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    }}>
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={{ alignItems: 'center' }}
      >
        <View style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: withAlpha(colors.error, 0.1),
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
        </View>

        <Text style={{
          fontSize: 22,
          fontWeight: '700',
          color: colors.textPrimary,
          marginBottom: spacing.sm,
          textAlign: 'center',
        }}>{title}</Text>

        <Text style={{
          fontSize: 15,
          color: colors.textMuted,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: spacing.xl,
        }}>{message}</Text>

        {onRetry && (
          <AnimatedPressable
            onPress={onRetry}
            onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
            onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
            style={[buttonStyle, {
              backgroundColor: colors.primary,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.xl,
              ...shadows.sm,
            }]}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: colors.white,
            }}>{retryLabel}</Text>
          </AnimatedPressable>
        )}
      </Animated.View>
    </View>
  );
}

export function OfflineScreen({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    }}>
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={{ alignItems: 'center' }}
      >
        <View style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: withAlpha(colors.warning, 0.1),
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}>
          <Ionicons name="cloud-offline" size={48} color={colors.warning} />
        </View>

        <Text style={{
          fontSize: 22,
          fontWeight: '700',
          color: colors.textPrimary,
          marginBottom: spacing.sm,
          textAlign: 'center',
        }}>You're offline</Text>

        <Text style={{
          fontSize: 15,
          color: colors.textMuted,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: spacing.xl,
        }}>Please check your internet connection and try again.</Text>

        {onRetry && (
          <AnimatedPressable
            onPress={onRetry}
            onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
            onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
            style={[buttonStyle, {
              backgroundColor: colors.primary,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.xl,
              ...shadows.sm,
            }]}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: colors.white,
            }}>Retry</Text>
          </AnimatedPressable>
        )}
      </Animated.View>
    </View>
  );
}

export function PermissionDeniedScreen({
  title = 'Permission Required',
  message = 'This feature requires additional permissions to work properly.',
  icon = 'lock-closed' as keyof typeof Ionicons.glyphMap,
  onRequestPermission,
  permissionLabel = 'Grant Permission',
}: {
  title?: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onRequestPermission?: () => void;
  permissionLabel?: string;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    }}>
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={{ alignItems: 'center' }}
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
          <Ionicons name={icon} size={48} color={colors.info} />
        </View>

        <Text style={{
          fontSize: 22,
          fontWeight: '700',
          color: colors.textPrimary,
          marginBottom: spacing.sm,
          textAlign: 'center',
        }}>{title}</Text>

        <Text style={{
          fontSize: 15,
          color: colors.textMuted,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: spacing.xl,
        }}>{message}</Text>

        {onRequestPermission && (
          <AnimatedPressable
            onPress={onRequestPermission}
            onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
            onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
            style={[buttonStyle, {
              backgroundColor: colors.primary,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.xl,
              ...shadows.sm,
            }]}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: colors.white,
            }}>{permissionLabel}</Text>
          </AnimatedPressable>
        )}
      </Animated.View>
    </View>
  );
}

export function EmptyStateView({
  icon = 'folder-open' as keyof typeof Ionicons.glyphMap,
  title,
  message,
  actionLabel,
  onAction,
  iconColor,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  iconColor?: string;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const color = iconColor || colors.primary;

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(400)}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xxxl,
      }}
    >
      <View style={{
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: withAlpha(color, 0.1),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
      }}>
        <Ionicons name={icon} size={48} color={color} />
      </View>

      <Text style={{
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.xs,
        textAlign: 'center',
      }}>{title}</Text>

      {message && (
        <Text style={{
          fontSize: 15,
          color: colors.textMuted,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: spacing.lg,
        }}>{message}</Text>
      )}

      {actionLabel && onAction && (
        <AnimatedPressable
          onPress={onAction}
          onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
          style={[buttonStyle, {
            backgroundColor: colors.primary,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            borderRadius: radius.xl,
            ...shadows.sm,
          }]}
        >
          <Text style={{
            fontSize: 15,
            fontWeight: '700',
            color: colors.white,
          }}>{actionLabel}</Text>
        </AnimatedPressable>
      )}
    </Animated.View>
  );
}

export function SkeletonBox({
  width,
  height,
  borderRadius,
  style,
}: {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}) {
  const { colors, radius, withAlpha } = useTheme();
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          width: width || '100%',
          height: height || 20,
          borderRadius: borderRadius ?? radius.md,
          backgroundColor: withAlpha(colors.textMuted, 0.15),
        },
        style,
      ]}
    />
  );
}
