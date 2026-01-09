import { StripeProvider } from "@stripe/stripe-react-native";
import { Slot } from "expo-router";
import { ThemeProvider } from "../src/ui/theme-context";
import { OnboardingProvider } from "../src/onboarding";
import { RatingPromptProvider } from "../src/components/RatingPromptProvider";
import React from "react";

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!;

  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.wrenchgo.app"
      urlScheme="wrenchgo"
    >
      <ThemeProvider>
        <OnboardingProvider>
          <RatingPromptProvider>
            <Slot />
          </RatingPromptProvider>
        </OnboardingProvider>
      </ThemeProvider>
    </StripeProvider>
  );
}
