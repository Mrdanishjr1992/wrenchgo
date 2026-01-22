import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../src/ui/theme-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ProfileHeaderProps {
  avatarUrl?: string | null;
  name: string;
  subtitle?: string;
  badge?: {
    label: string;
    color: string;
  };
  stats?: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    value: string | number;
    label: string;
    color?: string;
  }>;
  onAvatarPress?: () => void;
  onEditPress?: () => void;
  isEditing?: boolean;
}

export function ProfileHeader({
  avatarUrl,
  name,
  subtitle,
  badge,
  stats,
  onAvatarPress,
  onEditPress,
  isEditing,
}: ProfileHeaderProps) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        ...shadows.md,
      }}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: stats ? spacing.lg : 0,
      }}>
        <Pressable
          onPress={onAvatarPress}
          disabled={!onAvatarPress}
          style={({ pressed }) => ({
            opacity: pressed && onAvatarPress ? 0.8 : 1,
          })}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: colors.surface2,
              }}
            />
          ) : (
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{
                fontSize: 24,
                fontWeight: '800',
                color: colors.white,
              }}>{initials}</Text>
            </View>
          )}
          {onAvatarPress && (
            <View style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: colors.surface,
            }}>
              <Ionicons name="camera" size={14} color={colors.white} />
            </View>
          )}
        </Pressable>

        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={{
            fontSize: 22,
            fontWeight: '800',
            color: colors.textPrimary,
            marginBottom: 2,
          }}>{name}</Text>

          {subtitle && (
            <Text style={{
              fontSize: 14,
              color: colors.textMuted,
              marginBottom: badge ? spacing.xs : 0,
            }}>{subtitle}</Text>
          )}

          {badge && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: withAlpha(badge.color, 0.1),
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radius.full,
              alignSelf: 'flex-start',
            }}>
              <Ionicons name="shield-checkmark" size={14} color={badge.color} />
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: badge.color,
              }}>{badge.label}</Text>
            </View>
          )}
        </View>

        {onEditPress && (
          <Pressable
            onPress={onEditPress}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: isEditing ? colors.primary : withAlpha(colors.textMuted, 0.1),
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons
              name={isEditing ? 'checkmark' : 'pencil'}
              size={20}
              color={isEditing ? colors.white : colors.textPrimary}
            />
          </Pressable>
        )}
      </View>

      {stats && stats.length > 0 && (
        <View style={{
          flexDirection: 'row',
          gap: spacing.sm,
        }}>
          {stats.map((stat, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                backgroundColor: withAlpha(stat.color || colors.primary, 0.08),
                borderRadius: radius.lg,
                padding: spacing.sm,
                alignItems: 'center',
              }}
            >
              <Ionicons name={stat.icon} size={18} color={stat.color || colors.primary} />
              <Text style={{
                fontSize: 18,
                fontWeight: '800',
                color: colors.textPrimary,
                marginTop: 4,
              }}>{stat.value}</Text>
              <Text style={{
                fontSize: 11,
                color: colors.textMuted,
                fontWeight: '500',
              }}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

export interface SettingsSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  children: React.ReactNode;
  action?: {
    label: string;
    onPress: () => void;
  };
  delay?: number;
}

export function SettingsSection({
  title,
  icon,
  iconColor,
  children,
  action,
  delay = 0,
}: SettingsSectionProps) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const color = iconColor || colors.primary;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(300)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        ...shadows.sm,
      }}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: radius.lg,
            backgroundColor: withAlpha(color, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <Text style={{
            fontSize: 16,
            fontWeight: '700',
            color: colors.textPrimary,
          }}>{title}</Text>
        </View>
        {action && (
          <Pressable onPress={action.onPress} hitSlop={10}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.primary,
            }}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </Animated.View>
  );
}

export interface SettingsRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value?: string | React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  badge?: string | number;
}

export function SettingsRow({
  icon,
  iconColor,
  label,
  value,
  onPress,
  showChevron = true,
  destructive,
  disabled,
  badge,
}: SettingsRowProps) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const scale = useSharedValue(1);
  const color = destructive ? colors.error : iconColor || colors.textMuted;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const content = (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      opacity: disabled ? 0.5 : 1,
    }}>
      {icon && (
        <View style={{
          width: 32,
          height: 32,
          borderRadius: radius.md,
          backgroundColor: withAlpha(color, 0.1),
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
        }}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      )}

      <Text style={{
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        color: destructive ? colors.error : colors.textPrimary,
      }}>{label}</Text>

      {badge !== undefined && (
        <View style={{
          backgroundColor: colors.error,
          borderRadius: 10,
          minWidth: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 6,
          marginRight: spacing.sm,
        }}>
          <Text style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.white,
          }}>{badge}</Text>
        </View>
      )}

      {typeof value === 'string' ? (
        <Text style={{
          fontSize: 14,
          color: colors.textMuted,
          marginRight: showChevron && onPress ? spacing.xs : 0,
        }}>{value}</Text>
      ) : value}

      {showChevron && onPress && (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      style={animatedStyle}
    >
      {content}
    </AnimatedPressable>
  );
}

export function SettingsDivider() {
  const { colors, spacing } = useTheme();

  return (
    <View style={{
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.xs,
    }} />
  );
}

export interface InfoRowProps {
  label: string;
  value: string | React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

export function InfoRow({ label, value, icon, iconColor }: InfoRowProps) {
  const { colors, spacing, radius, withAlpha } = useTheme();
  const color = iconColor || colors.textMuted;

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    }}>
      {icon && (
        <View style={{
          width: 28,
          height: 28,
          borderRadius: radius.sm,
          backgroundColor: withAlpha(color, 0.1),
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.sm,
        }}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
      )}
      <Text style={{
        flex: 1,
        fontSize: 14,
        color: colors.textMuted,
      }}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={{
          fontSize: 14,
          fontWeight: '600',
          color: colors.textPrimary,
        }}>{value}</Text>
      ) : value}
    </View>
  );
}
