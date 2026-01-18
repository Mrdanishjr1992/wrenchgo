import React from "react";
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme-context";

type ChipVariant = "default" | "primary" | "success" | "warning" | "error";

interface ThemedChipProps {
  label: string;
  variant?: ChipVariant;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ThemedChip({
  label,
  variant = "default",
  selected = false,
  onPress,
  onRemove,
  icon,
  disabled = false,
  style,
}: ThemedChipProps) {
  const { colors, radius, spacing, fontSize, fontWeight, animation } = useTheme();
  const scale = useSharedValue(1);

  const variantStyles: Record<ChipVariant, { bg: string; bgSelected: string; text: string; textSelected: string; border: string }> = {
    default: {
      bg: colors.surface2,
      bgSelected: colors.primaryBg,
      text: colors.textSecondary,
      textSelected: colors.primary,
      border: colors.border,
    },
    primary: {
      bg: colors.primaryBg,
      bgSelected: colors.primary,
      text: colors.primary,
      textSelected: colors.buttonText,
      border: colors.primary,
    },
    success: {
      bg: colors.successBg,
      bgSelected: colors.success,
      text: colors.success,
      textSelected: colors.white,
      border: colors.success,
    },
    warning: {
      bg: colors.warningBg,
      bgSelected: colors.warning,
      text: colors.warning,
      textSelected: colors.white,
      border: colors.warning,
    },
    error: {
      bg: colors.errorBg,
      bgSelected: colors.error,
      text: colors.error,
      textSelected: colors.white,
      border: colors.error,
    },
  };

  const currentVariant = variantStyles[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && onPress) {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const content = (
    <>
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? currentVariant.textSelected : currentVariant.text}
          style={{ marginRight: spacing.xs }}
        />
      )}
      <Text
        style={{
          color: selected ? currentVariant.textSelected : currentVariant.text,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} style={{ marginLeft: spacing.xs }}>
          <Ionicons
            name="close-circle"
            size={16}
            color={selected ? currentVariant.textSelected : currentVariant.text}
          />
        </Pressable>
      )}
    </>
  );

  const chipStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: selected ? currentVariant.bgSelected : currentVariant.bg,
    borderWidth: selected ? 1 : 0,
    borderColor: currentVariant.border,
    opacity: disabled ? 0.5 : 1,
  };

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[chipStyle, animatedStyle, style]}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return <View style={[chipStyle, style]}>{content}</View>;
}

export default ThemedChip;
