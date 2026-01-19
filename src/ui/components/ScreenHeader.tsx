import React from 'react';
import { View, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme-context';
import { ThemedText } from './ThemedText';
import { LinearGradient } from 'expo-linear-gradient';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  variant?: 'default' | 'gradient' | 'transparent';
  style?: ViewStyle;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  rightAction,
  variant = 'default',
  style,
}: ScreenHeaderProps) {
  const { colors, spacing, shadows } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const content = (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      paddingTop: insets.top + spacing.sm,
      gap: spacing.sm,
    }}>
      {showBack && (
        <Pressable
          onPress={handleBack}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: variant === 'gradient' 
              ? 'rgba(255,255,255,0.2)' 
              : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons 
            name="arrow-back" 
            size={22} 
            color={variant === 'gradient' ? colors.white : colors.textPrimary} 
          />
        </Pressable>
      )}
      
      <View style={{ flex: 1 }}>
        <ThemedText 
          variant="title" 
          style={{ 
            color: variant === 'gradient' ? colors.white : colors.textPrimary 
          }}
        >
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText 
            variant="caption" 
            style={{ 
              color: variant === 'gradient' 
                ? 'rgba(255,255,255,0.8)' 
                : colors.textMuted 
            }}
          >
            {subtitle}
          </ThemedText>
        )}
      </View>
      
      {rightAction}
    </View>
  );

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={[colors.primary, colors.primaryDark || colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ ...shadows.sm }, style]}
      >
        {content}
      </LinearGradient>
    );
  }

  return (
    <View style={[{
      backgroundColor: variant === 'transparent' ? 'transparent' : colors.surface,
      borderBottomWidth: variant === 'transparent' ? 0 : 1,
      borderBottomColor: colors.border,
      ...shadows.sm,
    }, style]}>
      {content}
    </View>
  );
}

export default ScreenHeader;