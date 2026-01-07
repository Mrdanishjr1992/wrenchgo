import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';

type TrustScoreProps = {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
};

export default function TrustScore({ score, size = 'medium', showLabel = true }: TrustScoreProps) {
  const { colors, text, spacing } = useTheme();

  const sizeConfig = {
    small: { iconSize: 16, fontSize: 12, containerSize: 32 },
    medium: { iconSize: 20, fontSize: 14, containerSize: 40 },
    large: { iconSize: 24, fontSize: 16, containerSize: 48 },
  };

  const config = sizeConfig[size];

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    if (score >= 40) return '#F97316';
    return '#EF4444';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  const scoreColor = getScoreColor(score);

  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <View
        style={{
          width: config.containerSize,
          height: config.containerSize,
          borderRadius: config.containerSize / 2,
          backgroundColor: scoreColor + '20',
          borderWidth: 2,
          borderColor: scoreColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontSize: config.fontSize,
            fontWeight: '700',
            color: scoreColor,
          }}
        >
          {score}
        </Text>
      </View>
      {showLabel && (
        <Text
          style={{
            fontSize: config.fontSize - 2,
            fontWeight: '600',
            color: colors.textSecondary,
          }}
        >
          {getScoreLabel(score)}
        </Text>
      )}
    </View>
  );
}
