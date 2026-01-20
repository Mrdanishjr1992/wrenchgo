import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useRatingPromptContext } from "@/src/components/RatingPromptProvider";
import { useTheme } from "@/src/ui/theme-context";

export default function RatePage() {
  const router = useRouter();
  const { colors } = useTheme();
  const { triggerPrompt, handleRateApp, promptState } = useRatingPromptContext();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (promptState?.eligible) {
        triggerPrompt();
      } else {
        handleRateApp();
      }
      router.back();
    }, 100);
    return () => clearTimeout(timer);
  }, [triggerPrompt, handleRateApp, promptState, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
