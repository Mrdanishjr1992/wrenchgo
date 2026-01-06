import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "../../../src/ui/theme-context";

export default function GarageLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
