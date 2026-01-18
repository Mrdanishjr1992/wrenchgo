import React from "react";
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
} from "react-native";
import { useTheme } from "../theme-context";
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

type TextVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "title"
  | "section"
  | "subtitle"
  | "body"
  | "bodySecondary"
  | "bodySmall"
  | "muted"
  | "caption"
  | "label"
  | "button"
  | "buttonSmall"
  | "xs"
  | "sm"
  | "base"
  | "lg"
  | "link";

type TextColor =
  | "primary"
  | "secondary"
  | "muted"
  | "inverse"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "accent";

interface ThemedTextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  align?: "left" | "center" | "right";
  animated?: boolean;
}

const colorMap: Record<TextColor, keyof ReturnType<typeof useTheme>["colors"]> = {
  primary: "textPrimary",
  secondary: "textSecondary",
  muted: "textMuted",
  inverse: "textInverse",
  success: "success",
  warning: "warning",
  error: "error",
  info: "info",
  accent: "accent",
};

export function ThemedText({
  variant = "body",
  color,
  align,
  style,
  animated = false,
  children,
  ...props
}: ThemedTextProps) {
  const { text, colors } = useTheme();

  const textStyle = text[variant] || text.body;
  const colorStyle = color ? { color: colors[colorMap[color]] } : {};
  const alignStyle = align ? { textAlign: align } : {};

  const combinedStyle: TextStyle = {
    ...textStyle,
    ...colorStyle,
    ...alignStyle,
  };

  if (animated) {
    return (
      <Animated.Text style={[combinedStyle, style]} {...props}>
        {children}
      </Animated.Text>
    );
  }

  return (
    <RNText style={[combinedStyle, style]} {...props}>
      {children}
    </RNText>
  );
}

export default ThemedText;
