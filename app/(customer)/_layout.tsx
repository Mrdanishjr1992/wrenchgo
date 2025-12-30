import { Stack } from "expo-router";
import React from "react";

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen
        name="education"
        options={{
          headerShown: true,
          presentation: "card",
        }}
      />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="job/[id]"  options={{headerTitle: ""}}/>
      <Stack.Screen name="job-detail/[id]" options={{headerTitle: ""}}/>
      <Stack.Screen name="job-details/[id]" options={{headerTitle: ""}}/>
      <Stack.Screen name="quote-composer/[id]" options={{headerTitle: ""}}/>
      <Stack.Screen name="quote-review" options={{headerTitle: ""}}/>
      <Stack.Screen name="quote-sent/[id]" options={{headerTitle: ""}}/>
      <Stack.Screen name="messages/[jobId]" options={{headerShown: false}}/>
    </Stack>
  );
}
