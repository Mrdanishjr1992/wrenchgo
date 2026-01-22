import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { useTheme } from "../theme-context";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "info" | "outline";
type BadgeSize = "sm" | "md" | "lg";

interface ThemedBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function ThemedBadge({
  label,
  variant = "default",
  size = "md",
  icon,
  style,
  textStyle,
}: ThemedBadgeProps) {
  const { colors, radius, spacing, fontSize, fontWeight } = useTheme();

  const sizeStyles: Record<BadgeSize, { paddingV: number; paddingH: number; fontSize: number }> = {
    sm: { paddingV: spacing.xxs, paddingH: spacing.xs, fontSize: fontSize.xs },
    md: { paddingV: spacing.xs, paddingH: spacing.sm, fontSize: fontSize.sm },
    lg: { paddingV: spacing.sm, paddingH: spacing.md, fontSize: fontSize.base },
  };

  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border?: string }> = {
    default: { bg: colors.surface2, text: colors.textSecondary },
    primary: { bg: colors.primaryBg, text: colors.primary },
    success: { bg: colors.successBg, text: colors.success },
    warning: { bg: colors.warningBg, text: colors.warning },
    error: { bg: colors.errorBg, text: colors.error },
    info: { bg: colors.infoBg, text: colors.info },
    outline: { bg: "transparent", text: colors.textSecondary, border: colors.border },
  };

  const currentSize = sizeStyles[size];
  const currentVariant = variantStyles[variant];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: currentVariant.bg,
          paddingVertical: currentSize.paddingV,
          paddingHorizontal: currentSize.paddingH,
          borderRadius: radius.full,
          borderWidth: currentVariant.border ? 1 : 0,
          borderColor: currentVariant.border,
        },
        style,
      ]}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[
          {
            color: currentVariant.text,
            fontSize: currentSize.fontSize,
            fontWeight: fontWeight.semibold,
          },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  icon: {
    marginRight: 4,
  },
});

export default ThemedBadge;
