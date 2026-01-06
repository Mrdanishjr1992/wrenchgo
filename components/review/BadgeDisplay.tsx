import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../../src/ui/theme-context';
import type { UserBadge, Badge } from '../../src/types/trust-system';
import { getBadgeTierColor } from '../../src/types/trust-system';

interface BadgeDisplayProps {
  badge: Badge;
  size?: 'small' | 'medium' | 'large';
  showDescription?: boolean;
  onPress?: () => void;
}

export function BadgeDisplay({
  badge,
  size = 'medium',
  showDescription = false,
  onPress,
}: BadgeDisplayProps) {
  const { colors, text, radius } = useTheme();

  const sizeConfig = {
    small: { iconSize: 24, fontSize: 10, padding: 6 },
    medium: { iconSize: 32, fontSize: 12, padding: 10 },
    large: { iconSize: 48, fontSize: 14, padding: 14 },
  }[size];

  const tierColor = getBadgeTierColor(badge.tier);

  const content = (
    <View
      style={{
        alignItems: 'center',
        padding: sizeConfig.padding,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: tierColor + '44',
        minWidth: size === 'large' ? 100 : undefined,
      }}
    >
      <View
        style={{
          width: sizeConfig.iconSize + 16,
          height: sizeConfig.iconSize + 16,
          borderRadius: (sizeConfig.iconSize + 16) / 2,
          backgroundColor: tierColor + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: sizeConfig.iconSize }}>{badge.icon || '🏆'}</Text>
      </View>
      <Text
        style={{
          fontSize: sizeConfig.fontSize,
          fontWeight: '700',
          color: colors.textPrimary,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {badge.title}
      </Text>
      {showDescription && badge.description && (
        <Text
          style={{
            ...text.muted,
            fontSize: sizeConfig.fontSize - 2,
            textAlign: 'center',
            marginTop: 2,
          }}
          numberOfLines={2}
        >
          {badge.description}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

interface BadgeListProps {
  badges: UserBadge[];
  maxDisplay?: number;
  onViewAll?: () => void;
}

export function BadgeList({ badges, maxDisplay = 5, onViewAll }: BadgeListProps) {
  const { colors, text, spacing } = useTheme();

  if (badges.length === 0) {
    return null;
  }

  const displayBadges = badges.slice(0, maxDisplay);
  const remaining = badges.length - maxDisplay;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {displayBadges.map((ub) =>
            ub.badge ? (
              <BadgeDisplay key={ub.id} badge={ub.badge} size="small" />
            ) : null
          )}
          {remaining > 0 && onViewAll && (
            <Pressable
              onPress={onViewAll}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 12,
                backgroundColor: colors.surface,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ ...text.muted, fontWeight: '600' }}>+{remaining}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

interface BadgeGridProps {
  badges: UserBadge[];
  columns?: number;
}

export function BadgeGrid({ badges, columns = 3 }: BadgeGridProps) {
  const { spacing } = useTheme();

  if (badges.length === 0) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {badges.map((ub) =>
        ub.badge ? (
          <View key={ub.id} style={{ width: `${100 / columns - 2}%` }}>
            <BadgeDisplay badge={ub.badge} size="medium" showDescription />
          </View>
        ) : null
      )}
    </View>
  );
}
