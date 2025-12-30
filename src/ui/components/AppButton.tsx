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
    borderRadius: 999,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const buttonTextColor = colors.bg === "#121212" ? "#121212" : "#FFFFFF";

  const v =
    variant === "primary"
      ? {
          backgroundColor: colors.accent,
          borderWidth: 0,
          borderColor: "transparent",
          color: buttonTextColor,
        }
      : variant === "outline"
      ? {
          backgroundColor: "transparent",
          borderWidth: 2,
          borderColor: colors.accent,
          color: colors.accent,
        }
      : {
          backgroundColor: "transparent",
          borderWidth: 0,
          borderColor: "transparent",
          color: colors.accent,
        };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        base,
        {
          backgroundColor: v.backgroundColor,
          borderWidth: v.borderWidth,
          borderColor: v.borderColor,
          opacity: isDisabled ? 0.6 : 1,
        },
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
