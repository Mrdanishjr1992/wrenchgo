import React, { useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StripeProvider } from "@stripe/stripe-react-native";

import { ThemeProvider } from "../src/ui/theme-context";
import { OnboardingProvider } from "../src/onboarding";
import { RatingPromptProvider } from "../src/components/RatingPromptProvider";
import { MandatoryReviewProvider } from "../src/components/MandatoryReviewProvider";

// Ensure we can control the splash screen.
// expo-router may also control it internally; this is safe.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  // Hide splash as soon as root view lays out (even if something fails).
  const onLayoutRootView = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // If env var is missing, show a clear screen instead of hanging on splash forever.
  if (!publishableKey) {
    return (
      <View style={styles.container} onLayout={onLayoutRootView}>
        <Text style={styles.title}>Config missing</Text>
        <Text style={styles.body}>
          EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set.
          {"\n\n"}
          Add it in Expo Dashboard → Project → Environment Variables (Preview),
          then rebuild your APK.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StripeProvider
        publishableKey={publishableKey}
        merchantIdentifier="merchant.com.wrenchgo.app"
        urlScheme="wrenchgo"
      >
        <ThemeProvider>
          <OnboardingProvider>
            <RatingPromptProvider>
              <MandatoryReviewProvider>
                <Slot />
              </MandatoryReviewProvider>
            </RatingPromptProvider>
          </OnboardingProvider>
        </ThemeProvider>
      </StripeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    marginBottom: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
