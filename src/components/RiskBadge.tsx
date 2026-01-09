import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../ui/theme-context';

type RiskLevel = 'high' | 'medium' | 'low';

type RiskBadgeProps = {
  riskLevel: string;
  size?: 'small' | 'medium';
};

export function RiskBadge({ riskLevel, size = 'small' }: RiskBadgeProps) {
  const { colors } = useTheme();
  
  const riskConfig: Record<RiskLevel, { color: string; label: string; bgColor: string }> = {
    high: {
      color: colors.error,
      bgColor: colors.errorBg,
      label: 'High Risk',
    },
    medium: {
      color: colors.warning,
      bgColor: colors.warningBg,
      label: 'Medium Risk',
    },
    low: {
      color: colors.success,
      bgColor: colors.successBg,
      label: 'Low Risk',
    },
  };

  const normalizedLevel = riskLevel.toLowerCase() as RiskLevel;
  const config = riskConfig[normalizedLevel] || riskConfig.low;

  const isSmall = size === 'small';

  return (
    <View
      style={{
        paddingHorizontal: isSmall ? 8 : 10,
        paddingVertical: isSmall ? 4 : 6,
        borderRadius: isSmall ? 6 : 8,
        backgroundColor: config.bgColor,
        borderWidth: 1,
        borderColor: config.color + '40',
      }}
    >
      <Text
        style={{
          fontSize: isSmall ? 11 : 12,
          fontWeight: '700',
          color: config.color,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {config.label}
      </Text>
    </View>
  );
}
