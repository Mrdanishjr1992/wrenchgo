// src/ui/styles.ts
import { Platform } from "react-native";
import { radius, normalize } from "./theme";
import { lightColors, darkColors } from "./theme";

type ThemeColors = typeof lightColors | typeof darkColors;

export const createCard = (colors: ThemeColors) => ({
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.lg,
  ...(Platform.OS === "ios"
    ? {
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: normalize(4) },
        shadowOpacity: 0.08,
        shadowRadius: normalize(10),
      }
    : {
        elevation: 4,
      }),
});

export const cardPressed = {
  transform: [{ scale: 0.985 }],
  elevation: 1,
};

export const createPill = (colors: any) => ({
  paddingHorizontal: normalize(10),
  paddingVertical: normalize(6),
  borderRadius: 999,
  borderWidth: 1,
  borderColor: colors.border,
});
