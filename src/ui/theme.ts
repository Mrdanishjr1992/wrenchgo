// src/ui/theme.ts
import { Dimensions, Platform, PixelRatio } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const screenSizes = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmallDevice: SCREEN_WIDTH < 375,
  isMediumDevice: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414,
  isLargeDevice: SCREEN_WIDTH >= 414,
  isTablet: SCREEN_WIDTH >= 768,
};

const scale = SCREEN_WIDTH / 375;

export const normalize = (size: number): number => {
  const newSize = size * scale;
  if (Platform.OS === "ios") {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  }
};

export const responsiveSize = (small: number, medium: number, large: number): number => {
  if (screenSizes.isSmallDevice) return small;
  if (screenSizes.isMediumDevice) return medium;
  return large;
};

export const lightColors = {
  bg: "#FAFBFC",
  surface: "#FFFFFF",
  surface2: "#F7F9FA",
  textPrimary: "#1A202C",
  textSecondary: "#4A5568",
  textMuted: "#718096",
  text: "#1A202C",
  muted: "#718096",
  border: "#E2E8F0",
  divider: "#EDF2F7",
  accent: "#3B82F6",
  overlay: "rgba(0, 0, 0, 0.5)",
  black: "#000000",
  primary: "#FF6B35",
  primaryLight: "#F7931E",
  primaryBg: "#FFF5F0",
  blue: "#3B82F6",
  blueBg: "#EFF6FF",
  green: "#10B981",
  greenBg: "#F0FDF4",
  gray: "#E5E7EB",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
};

export const darkColors = {
  bg: "#121212",
  surface: "#1E1E1E",
  surface2: "#252525",
  textPrimary: "#E8E8E8",
  textSecondary: "#B8B8B8",
  textMuted: "#8A8A8A",
  text: "#E8E8E8",
  muted: "#8A8A8A",
  border: "#2C2C2C",
  divider: "#222222",
  accent: "#60A5FA",
  overlay: "rgba(0, 0, 0, 0.7)",
  primary: "#FF8C5A",
  primaryLight: "#FFB347",
  primaryBg: "#2D1810",
  blue: "#60A5FA",
  blueBg: "#1E3A5F",
  green: "#34D399",
  greenBg: "#1A3A2E",
  gray: "#374151",
  success: "#34D399",
  error: "#F87171",
  warning: "#FBBF24",
};

export const spacing = {
  xs: normalize(6),
  sm: normalize(10),
  md: normalize(14),
  lg: normalize(20),
  xl: normalize(28),
};

export const radius = {
  sm: normalize(12),
  md: normalize(16),
  lg: normalize(20),
  xl: normalize(28),
};

export const withAlpha = (color: string, alpha: number): string => {
  if (color.startsWith("rgba")) return color;
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
};

export const createText = (colors: typeof lightColors) => ({
  title: {
    fontSize: normalize(24),
    fontWeight: "900" as const,
    color: colors.textPrimary,
  },
  section: {
    fontSize: normalize(16),
    fontWeight: "800" as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: normalize(14),
    fontWeight: "600" as const,
    color: colors.textPrimary,
  },
  bodySecondary: {
    fontSize: normalize(14),
    fontWeight: "600" as const,
    color: colors.textSecondary,
  },
  muted: {
    fontSize: normalize(13),
    fontWeight: "600" as const,
    color: colors.textMuted,
  },
  button: {
    fontSize: normalize(15),
    fontWeight: "900" as const,
    color: colors.textPrimary,
  },
});
