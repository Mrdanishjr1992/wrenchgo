import React from "react";
import { View, ViewStyle } from "react-native";
import { useTheme } from "../theme-context";

interface ThemedDividerProps {
  orientation?: "horizontal" | "vertical";
  spacing?: "none" | "sm" | "md" | "lg";
  color?: string;
  style?: ViewStyle;
}

export function ThemedDivider({
  orientation = "horizontal",
  spacing: spacingProp = "md",
  color,
  style,
}: ThemedDividerProps) {
  const { colors, spacing } = useTheme();

  const spacingMap = {
    none: 0,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
  };

  const marginValue = spacingMap[spacingProp];

  const dividerStyle: ViewStyle =
    orientation === "horizontal"
      ? {
          height: 1,
          backgroundColor: color || colors.divider,
          marginVertical: marginValue,
        }
      : {
          width: 1,
          backgroundColor: color || colors.divider,
          marginHorizontal: marginValue,
        };

  return <View style={[dividerStyle, style]} />;
}

export default ThemedDivider;
