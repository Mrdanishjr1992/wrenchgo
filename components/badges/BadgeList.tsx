import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../src/ui/theme-context';

type Badge = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  tier: number;
};

type BadgeListProps = {
  badges: Badge[];
  maxVisible?: number;
  size?: 'small' | 'medium' | 'large';
};

export default function BadgeList({ badges, maxVisible = 3, size = 'medium' }: BadgeListProps) {
  const { colors, text, spacing } = useTheme();

  const visibleBadges = badges.slice(0, maxVisible);
  const remainingCount = badges.length - maxVisible;

  const sizeConfig = {
    small: { iconSize: 16, fontSize: 10, padding: 4 },
    medium: { iconSize: 20, fontSize: 12, padding: 6 },
    large: { iconSize: 24, fontSize: 14, padding: 8 },
  };

  const config = sizeConfig[size];

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1:
        return '#CD7F32';
      case 2:
        return '#C0C0C0';
      case 3:
        return '#FFD700';
      default:
        return colors.textSecondary;
    }
  };

  if (badges.length === 0) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {visibleBadges.map((badge) => (
        <View
          key={badge.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: getTierColor(badge.tier),
            borderRadius: 12,
            paddingHorizontal: config.padding,
            paddingVertical: config.padding / 2,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: config.iconSize }}>{badge.icon}</Text>
          <Text
            style={{
              fontSize: config.fontSize,
              fontWeight: '600',
              color: colors.text,
            }}
          >
            {badge.title}
          </Text>
        </View>
      ))}
      {remainingCount > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: config.padding,
            paddingVertical: config.padding / 2,
          }}
        >
          <Text
            style={{
              fontSize: config.fontSize,
              fontWeight: '600',
              color: colors.textSecondary,
            }}
          >
            +{remainingCount}
          </Text>
        </View>
      )}
    </View>
  );
}
