// src/ui/styles.ts
import { Platform } from "react-native";
import { radius, normalize, lightColors, darkColors } from "./theme";

type ThemeColors = typeof lightColors | typeof darkColors;

export const createCard = (colors: ThemeColors) => {
  const isDarkMode = colors === darkColors;

  return {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: colors.black,
          shadowOffset: { width: 0, height: normalize(6) },
          shadowOpacity: isDarkMode ? 0.35 : 0.08,
          shadowRadius: normalize(14),
        }
      : {
          elevation: isDarkMode ? 6 : 4,
        }),
  };
};

export const cardPressed = {
  transform: [{ scale: 0.99 }],
  ...(Platform.OS === "android" ? { elevation: 2 } : {}),
};


export const createPill = (colors: ThemeColors, selected = false) => ({
  paddingHorizontal: normalize(12),
  paddingVertical: normalize(7),
  borderRadius: 999,
  borderWidth: 1,
  borderColor: selected ? colors.primary : colors.border,
  backgroundColor: selected ? colors.primaryBg : "transparent",
});
