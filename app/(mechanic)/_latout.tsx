import { Stack } from "expo-router";

export default function MechanicLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      {/* your mechanic tabs */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* mechanic job details */}
      <Stack.Screen name="job/[id]" options={{ title: "Job" }} />
    </Stack>
  );
}
