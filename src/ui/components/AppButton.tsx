import { Pressable, Text, ViewStyle, ActivityIndicator } from "react-native";
import { useTheme } from "../theme-context";
import React from "react";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "link";
  loading?: boolean;
  style?: ViewStyle;
  disabled?: boolean;
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  style,
  loading,
  disabled,
}: Props) {
  const { colors } = useTheme();

  const isDisabled = disabled || loading;
const base = {
  paddingVertical: 16,
  paddingHorizontal: 18,
  borderRadius: 999,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  flexDirection: "row" as const,
  gap: 10,
};

const v =
  variant === "primary"
    ? {
        backgroundColor: colors.primary,
        borderWidth: 0,
        borderColor: "transparent",
        color: colors.buttonText,
      }
    : variant === "secondary"
    ? {
        backgroundColor: colors.primaryBg,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.accent,
      }
    : variant === "outline"
    ? {
        backgroundColor: "transparent",
        borderWidth: 2,
        borderColor: colors.primary,
        color: colors.primary,
      }
    : {
        backgroundColor: "transparent",
        borderWidth: 0,
        borderColor: "transparent",
        color: colors.primary,
      };
      const pressedStyle =
  variant === "primary"
    ? { transform: [{ scale: 0.985 }], opacity: 0.92 }
    : { transform: [{ scale: 0.99 }], opacity: 0.85 };


  return (
<Pressable
  onPress={onPress}
  disabled={isDisabled}
  style={({ pressed }) => [
    base,
    {
      backgroundColor: v.backgroundColor,
      borderWidth: v.borderWidth,
      borderColor: v.borderColor,
      opacity: isDisabled ? 0.55 : 1,
    },
    pressed && !isDisabled && pressedStyle,
    style,
  ]}
>

      {loading ? (
        <ActivityIndicator color={v.color} />
      ) : (
        <Text style={{ fontWeight: "900", fontSize: 16, color: v.color }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
