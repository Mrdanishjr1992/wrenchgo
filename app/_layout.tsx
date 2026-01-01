// app/_layout.tsx
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform, StatusBar } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { StripeProvider } from "@stripe/stripe-react-native";

import { ThemeProvider } from "../src/ui/theme-context";
import { configureGoogleSignIn } from "../src/lib/googleAuth";

export default function RootLayout() {
  useEffect(() => {
    // Configure Google Sign-In (avoid running this on web if it uses native modules)
    if (Platform.OS !== "web") configureGoogleSignIn();

    (async () => {
      try {
        // Lock to portrait (prevents landscape)
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );
      } catch (e) {
        console.warn("Screen orientation lock failed", e);
      }
    })();

    if (Platform.OS === "android") {
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor("transparent");
    }
  }, []);

  const pk = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  return (
    <SafeAreaProvider>
      {pk ? (
        <StripeProvider
          publishableKey={pk}
          merchantIdentifier="merchant.com.wrenchgo.app"
        >
          <ThemeProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </StripeProvider>
      ) : (
        <>
          {console.warn("Missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY")}
          <ThemeProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </>
      )}
    </SafeAreaProvider>
  );
}
