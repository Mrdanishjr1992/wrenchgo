// app/(customer)/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "../../src/ui/theme-context";

export default function CustomerLayout() {
  const { colors, spacing, text, radius } = useTheme();
  return (
    <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg }, // if you can access theme here
          }}
        >
      {/* Tabs */}
      <Stack.Screen name="(tabs)" />

      {/* Top-level screens */}
      <Stack.Screen name="education" />
      
      {/* ✅ FORCE header ON for Legal */}
      <Stack.Screen
        name="legal"
        options={{
          headerShown: true,
          title: "Legal",
        }}
      />
      <Stack.Screen
        name="inbox"
        options={{
          headerShown: true,
          title: "Inbox",
        }}
      />

      <Stack.Screen name="request-service" />
      <Stack.Screen name="garage" />

      {/* Dynamic routes */}
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="messages/[jobId]" />
      <Stack.Screen name="payment/[jobId]" />
    </Stack>
  );
}
