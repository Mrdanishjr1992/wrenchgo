import React from 'react';
import { View, Text } from 'react-native';

type RiskLevel = 'high' | 'medium' | 'low';

type RiskBadgeProps = {
  riskLevel: string;
  size?: 'small' | 'medium';
};

const riskConfig: Record<RiskLevel, { color: string; label: string; bgColor: string }> = {
  high: {
    color: '#ef4444',
    bgColor: '#ef444415',
    label: 'High Risk',
  },
  medium: {
    color: '#f59e0b',
    bgColor: '#f59e0b15',
    label: 'Medium Risk',
  },
  low: {
    color: '#10b981',
    bgColor: '#10b98115',
    label: 'Low Risk',
  },
};

export function RiskBadge({ riskLevel, size = 'small' }: RiskBadgeProps) {
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
