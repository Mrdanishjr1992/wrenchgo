import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { ThemedText } from './ThemedText';
import { AppButton } from './AppButton';
import Animated, { FadeIn } from 'react-native-reanimated';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  iconColor?: string;
  style?: ViewStyle;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  iconColor,
  style,
}: EmptyStateProps) {
  const { colors, spacing } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.lg,
      }, style]}
    >
      <View style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primaryBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
      }}>
        <Ionicons 
          name={icon} 
          size={36} 
          color={iconColor || colors.primary} 
        />
      </View>
      
      <ThemedText 
        variant="title" 
        align="center" 
        style={{ marginBottom: spacing.xs }}
      >
        {title}
      </ThemedText>
      
      {subtitle && (
        <ThemedText 
          variant="body" 
          color="muted" 
          align="center"
          style={{ marginBottom: spacing.lg, maxWidth: 280 }}
        >
          {subtitle}
        </ThemedText>
      )}
      
      {actionLabel && onAction && (
        <AppButton
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          style={{ marginBottom: secondaryActionLabel ? spacing.sm : 0 }}
        />
      )}
      
      {secondaryActionLabel && onSecondaryAction && (
        <AppButton
          title={secondaryActionLabel}
          onPress={onSecondaryAction}
          variant="ghost"
        />
      )}
    </Animated.View>
  );
}

export default EmptyState;