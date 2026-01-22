import React from 'react';
import { View, Pressable, Switch, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { ThemedText } from './ThemedText';

interface SettingsRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
  disabled?: boolean;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
}

export function SettingsRow({
  icon,
  iconColor,
  label,
  subtitle,
  value,
  onPress,
  showChevron = true,
  toggle,
  toggleValue,
  onToggle,
  danger = false,
  disabled = false,
  rightElement,
  style,
}: SettingsRowProps) {
  const { colors, spacing, radius } = useTheme();

  const textColor = danger ? colors.error : disabled ? colors.textMuted : colors.textPrimary;
  const finalIconColor = iconColor || (danger ? colors.error : colors.primary);

  const content = (
    <View style={[{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      gap: spacing.md,
      opacity: disabled ? 0.5 : 1,
    }, style]}>
      {icon && (
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${finalIconColor}15`,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={20} color={finalIconColor} />
        </View>
      )}
      
      <View style={{ flex: 1 }}>
        <ThemedText 
          variant="body" 
          style={{ color: textColor, fontWeight: '500' }}
        >
          {label}
        </ThemedText>
        {subtitle && (
          <ThemedText variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      
      {value && (
        <ThemedText variant="body" style={{ color: colors.textMuted }}>
          {value}
        </ThemedText>
      )}
      
      {toggle && (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
          disabled={disabled}
        />
      )}
      
      {rightElement}
      
      {showChevron && !toggle && !rightElement && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable 
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

export default SettingsRow;