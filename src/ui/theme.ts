// src/ui/theme.ts
import { Dimensions, PixelRatio } from "react-native";

/**
 * Base guideline width (iPhone X / 11 Pro)
 */
const BASE_WIDTH = 375;

/**
 * Get current screen dimensions
 * (kept as a function for future orientation support)
 */
export const getScreen = () => {
  const { width, height } = Dimensions.get("window");

  return {
    width,
    height,
    isSmallDevice: width < 375,
    isMediumDevice: width >= 375 && width < 414,
    isLargeDevice: width >= 414 && width < 768,
    isTablet: width >= 768,
  };
};

/**
 * Static snapshot (useful for theme/constants)
 */
export const screenSizes = getScreen();

/**
 * Scale value based on screen width
 */
const scale = screenSizes.width / BASE_WIDTH;

/**
 * Normalize sizes (fonts, spacing, icons)
 */
export const normalize = (size: number): number => {
  const scaledSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(scaledSize));
};

/**
 * Responsive size helper
 */
export const responsiveSize = (
  small: number,
  medium: number,
  large: number,
  tablet?: number
): number => {
  if (screenSizes.isTablet && tablet !== undefined) return tablet;
  if (screenSizes.isSmallDevice) return small;
  if (screenSizes.isMediumDevice) return medium;
  return large;
};

export type Colors = {
  [K in keyof typeof lightColors]: string;
};

export const lightColors = {
  // Backgrounds
  bg: "#F6FAFA", // very light teal-tinted white
  background: "#F6FAFA", // alias for bg
  surface: "#FFFFFF",
  surface2: "#EEF6F6",

  // Text
  textPrimary: "#0F172A", // near-black
  textSecondary: "#334155",
  textMuted: "#64748B",
  text: "#0F172A",
  muted: "#64748B",

  // Borders & dividers
  border: "#D6E4E5",
  divider: "#E2F0F0",

  // Brand / Accent (TEAL) — lighter
  primary: "#2DD4BF", // was #14B8A6
  primaryLight: "#99F6E4", // was #5EEAD4
  primaryBg: "#F0FDFA", // was #ECFEFF
  accent: "#14B8A6", // was #0D9488

  // Utility colors — aligned to lighter teal
  blue: "#2DD4BF", // was #0EA5A4
  blueBg: "#F0FDFA", // was #E6FFFB
  green: "#2DD4BF", // was #14B8A6
  greenBg: "#F0FDFA", // was #ECFEFF
  gray: "#E5E7EB",

  // Status
  success: "#2DD4BF",
  warning: "#F59E0B",
  error: "#EF4444",

  // Misc
  overlay: "rgba(0, 0, 0, 0.45)",
  black: "#000000",
};

export const darkColors: Colors = {
  // Backgrounds
  bg: "#0B1220", // deep blue-black
  background: "#0B1220", // alias for bg
  surface: "#101826",
  surface2: "#162032",

  // Text
  textPrimary: "#E6FDFC", // very light teal-white
  textSecondary: "#B3E6E3",
  textMuted: "#7CCFC9",
  text: "#E6FDFC",
  muted: "#7CCFC9",

  // Borders & dividers
  border: "#1F2F3A",
  divider: "#182635",

  // Brand / Accent (TEAL) — lighter
  primary: "#5EEAD4", // was #2DD4BF
  primaryLight: "#99F6E4",
  primaryBg: "#123C3A", // was #0F2E2C
  accent: "#5EEAD4", // was #2DD4BF

  // Utility colors
  blue: "#5EEAD4",
  blueBg: "#0F4A47",
  green: "#5EEAD4",
  greenBg: "#123C3A",
  gray: "#1F2937",

  // Status
  success: "#5EEAD4",
  warning: "#FBBF24",
  error: "#F87171",

  // Misc
  overlay: "rgba(0, 0, 0, 0.7)",
  black: "#000000",
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

export const createText = (colors: Colors) => ({
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
  xs: {
    fontSize: normalize(11),
    fontWeight: "500" as const,
    color: colors.textMuted,
  },
  sm: {
    fontSize: normalize(13),
    fontWeight: "600" as const,
    color: colors.textSecondary,
  },
  base: {
    fontSize: normalize(14),
    fontWeight: "600" as const,
    color: colors.textPrimary,
  },
});
