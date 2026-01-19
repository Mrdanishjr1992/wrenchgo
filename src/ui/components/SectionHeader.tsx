import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../theme-context';
import { ThemedText } from './ThemedText';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  style,
}: SectionHeaderProps) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    }, style]}>
      <View style={{ flex: 1 }}>
        <ThemedText 
          variant="label" 
          style={{ 
            color: colors.textMuted, 
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      {action}
    </View>
  );
}

export default SectionHeader;