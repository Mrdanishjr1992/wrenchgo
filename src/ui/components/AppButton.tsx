import React from "react";
import {
  Pressable,
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../theme-context";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md" | "lg";

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AppButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}: AppButtonProps) {
  const { colors, radius, spacing, animation, fontSize, fontWeight } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const isDisabled = disabled || loading;

  const sizeStyles: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
    sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: fontSize.sm },
    md: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg, fontSize: fontSize.md },
    lg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, fontSize: fontSize.lg },
  };

  const variantStyles: Record<ButtonVariant, { bg: string; border: string; borderWidth: number; textColor: string }> = {
    primary: {
      bg: colors.primary,
      border: "transparent",
      borderWidth: 0,
      textColor: colors.buttonText,
    },
    secondary: {
      bg: colors.primaryBg,
      border: colors.border,
      borderWidth: 1,
      textColor: colors.accent,
    },
    outline: {
      bg: "transparent",
      border: colors.primary,
      borderWidth: 2,
      textColor: colors.primary,
    },
    ghost: {
      bg: "transparent",
      border: "transparent",
      borderWidth: 0,
      textColor: colors.primary,
    },
    danger: {
      bg: colors.error,
      border: "transparent",
      borderWidth: 0,
      textColor: colors.white,
    },
    link: {
      bg: "transparent",
      border: "transparent",
      borderWidth: 0,
      textColor: colors.primary,
    },
  };

  const currentSize = sizeStyles[size];
  const currentVariant = variantStyles[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (!isDisabled) {
      scale.value = withSpring(animation.pressScale, { damping: 15, stiffness: 400 });
      opacity.value = withTiming(animation.pressOpacity, { duration: animation.fast });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(1, { duration: animation.fast });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          backgroundColor: currentVariant.bg,
          borderColor: currentVariant.border,
          borderWidth: currentVariant.borderWidth,
          paddingVertical: currentSize.paddingVertical,
          paddingHorizontal: currentSize.paddingHorizontal,
          borderRadius: radius.full,
          opacity: isDisabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        animatedStyle,
        style,
      ]}
    >
      {leftIcon && <>{leftIcon}</>}
      {loading ? (
        <ActivityIndicator color={currentVariant.textColor} size="small" />
      ) : (
        <Text
          style={[
            {
              color: currentVariant.textColor,
              fontSize: currentSize.fontSize,
              fontWeight: fontWeight.black,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
      {rightIcon && <>{rightIcon}</>}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fullWidth: {
    width: "100%",
  },
});

export default AppButton;
