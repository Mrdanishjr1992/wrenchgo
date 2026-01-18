import React from "react";
import { View, TextInput, TextInputProps, StyleSheet, ViewStyle, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { useTheme } from "../theme-context";

interface ThemedInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function ThemedInput({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}: ThemedInputProps) {
  const { colors, radius, spacing, fontSize, fontWeight, animation } = useTheme();
  const focused = useSharedValue(0);

  const handleFocus = (e: any) => {
    focused.value = withTiming(1, { duration: animation.fast });
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    focused.value = withTiming(0, { duration: animation.fast });
    onBlur?.(e);
  };

  const animatedBorderStyle = useAnimatedStyle(() => {
    const borderColor = error
      ? colors.error
      : interpolateColor(
          focused.value,
          [0, 1],
          [colors.inputBorder, colors.inputBorderFocused]
        );
    return { borderColor };
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: error ? colors.error : colors.textSecondary,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              marginBottom: spacing.xs,
            },
          ]}
        >
          {label}
        </Text>
      )}
      <AnimatedView
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.inputBg,
            borderRadius: radius.md,
            borderWidth: 1,
            paddingHorizontal: spacing.md,
          },
          animatedBorderStyle,
          error && { borderColor: colors.error },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              fontSize: fontSize.base,
              paddingVertical: spacing.md,
            },
            style,
          ]}
          placeholderTextColor={colors.inputPlaceholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </AnimatedView>
      {(error || hint) && (
        <Text
          style={[
            styles.helperText,
            {
              color: error ? colors.error : colors.textMuted,
              fontSize: fontSize.xs,
              marginTop: spacing.xs,
            },
          ]}
        >
          {error || hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {},
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  helperText: {},
});

export default ThemedInput;
