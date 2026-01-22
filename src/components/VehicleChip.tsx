import React from "react";
import { View, Text, Pressable } from "react-native";
import { useTheme } from "../ui/theme-context";

type VehicleChipProps = {
  year: string;
  make: string;
  model: string;
  nickname?: string;
  onPress?: () => void;
  showEdit?: boolean;
};

export function VehicleChip({ year, make, model, nickname, onPress, showEdit = true }: VehicleChipProps) {
  const { colors, spacing } = useTheme();

  const displayText = nickname ? `"${nickname}"` : `${year} ${make} ${model}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.accent,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View 
      style={{ 
        flexDirection: "row", 
        alignItems: "center", 
        gap: spacing.sm, 
        flex: 1 }}>
        <Text style={{ fontSize: 18 }}>🚗</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.accent,
            }}
            numberOfLines={1}
          >
            {displayText}
          </Text>
          {nickname && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.textMuted,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {year} {make} {model}
            </Text>
          )}
        </View>
      </View>
      {showEdit && onPress && (
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.accent }}>Change</Text>
      )}
    </Pressable>
  );
}
