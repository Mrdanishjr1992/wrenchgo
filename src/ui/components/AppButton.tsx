import { Pressable, Text, ViewStyle } from "react-native";
import { colors, spacing, radius, text } from "../theme";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline"| "link";
  loading?: boolean;
  style?: ViewStyle;
  disabled?: boolean;
};

export function AppButton({
  title,
  onPress,
  variant = "primary" ,
  style,
  loading,
  disabled,
}: Props) {
    
  const isDisabled = disabled || loading;
  const base = {
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const v =
    variant === "primary"
      ? {
          backgroundColor: colors.accent, 
          borderWidth: 0,
          borderColor: "transparent",
          color: "#fff",
        }
      : variant === "outline"
      ? {
          backgroundColor: "transparent",
          borderWidth: 2,
          borderColor: colors.text,
          color: colors.text,
        }:{
            backgroundColor: "transparent",
            borderWidth: 0,
            borderColor: "transparent",
            color: colors.accent,
        };

  const labelColor =
    variant === "outline" ? colors.accent : colors.textOnAccent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        base,
        { backgroundColor: v.backgroundColor, borderWidth: v.borderWidth, borderColor: v.borderColor, opacity: isDisabled ? 0.6 : 1 },
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
