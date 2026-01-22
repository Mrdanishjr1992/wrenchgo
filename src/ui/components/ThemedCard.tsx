import React from "react";
import {
  View,
  ViewProps,
  StyleSheet,
  ViewStyle,
  Pressable,
  PressableProps,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme-context";

type CardVariant = "default" | "elevated" | "outlined" | "filled";

interface ThemedCardProps extends ViewProps {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
  pressable?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ThemedCard({
  variant = "default",
  padding = "md",
  pressable = false,
  onPress,
  disabled = false,
  style,
  children,
  ...props
}: ThemedCardProps) {
  const { colors, radius, spacing, shadows, animation } = useTheme();
  const scale = useSharedValue(1);

  const paddingMap = {
    none: 0,
    sm: spacing.sm,
    md: spacing.lg,
    lg: spacing.xl,
  };

  const variantStyles: Record<CardVariant, ViewStyle> = {
    default: {
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...shadows.sm,
    },
    elevated: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 0,
      ...shadows.md,
    },
    outlined: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.border,
    },
    filled: {
      backgroundColor: colors.surface2,
      borderWidth: 0,
    },
  };

  const baseStyle: ViewStyle = {
    borderRadius: radius.lg,
    padding: paddingMap[padding],
    overflow: "hidden",
    ...variantStyles[variant],
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (pressable && !disabled) {
      scale.value = withSpring(animation.pressScale, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  if (pressable && onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[baseStyle, animatedStyle, disabled && { opacity: 0.6 }, style]}
        {...(props as PressableProps)}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View style={[baseStyle, style]} {...props}>
      {children}
    </View>
  );
}

export default ThemedCard;
