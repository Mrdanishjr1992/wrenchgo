// app/_layout.tsx
import { Stack } from "expo-router";
import { useEffect } from "react";
import { ThemeProvider } from "../src/ui/theme-context";
import { StripeProvider } from "@stripe/stripe-react-native";
import { configureGoogleSignIn } from "../src/lib/googleAuth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform, StatusBar } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";

export default function RootLayout() {
  useEffect(() => {
    configureGoogleSignIn();

    // Allow portrait rotation (normal + upside down) but prevent landscape
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);

    // Set translucent status bar for Android edge-to-edge
    if (Platform.OS === "android") {
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor("transparent");
    }
  }, []);

  const pk = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!pk) {
    console.warn("Missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY");
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={pk} merchantIdentifier="merchant.com.wrenchgo.app">
        <ThemeProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              // Ensure content respects safe areas
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
        </ThemeProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
