// app/(customer)/_layout.tsx
import React from "react";
import { Stack } from "expo-router";

export default function CustomerLayout() {
  
  return (
    
    <Stack
      screenOptions={{
        headerShown: false,
        
      }}
    >
      {/* Tabs */}
      <Stack.Screen name="(tabs)" />

      {/* Top-level screens */}
      <Stack.Screen name="education" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="request-service" />
      <Stack.Screen name="garage" />

      {/* Dynamic routes (must match your actual filenames) */}
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="messages/[jobId]" />
      <Stack.Screen name="payment/[jobId]" />
    </Stack>
  );
}
