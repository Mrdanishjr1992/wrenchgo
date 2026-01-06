import { StripeProvider } from "@stripe/stripe-react-native";
import { Slot } from "expo-router";
import { ThemeProvider } from "../src/ui/theme-context";
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
        <Slot />
      </ThemeProvider>
    </StripeProvider>
  );
}
